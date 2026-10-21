
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';
export type AssignableRole = Exclude<Role, 'admin'>;

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  avatar_path: string | null;
};

export async function getAdminUsers(): Promise<
  Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]
> {
  const { data, error } = await supabase.rpc('admin_list_users');

  if (error) throw error;

  return (data ?? []) as Pick<
    Profile,
    'id' | 'full_name' | 'email' | 'role'
  >[];
}

export async function changeAdminUserRole(
  targetUserId: string,
  newRole: AssignableRole
): Promise<void> {
  if (newRole !== 'student' && newRole !== 'teacher') {
    throw new Error('The requested role is not supported.');
  }

  const { error } = await supabase.rpc('admin_change_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) throw error;
}

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const startedAt = Date.now();
  console.log('PROFILE LOOKUP: Primary query started');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_path')
    .eq('id', userId)
    .maybeSingle();

  console.log('PROFILE LOOKUP: Primary query resolved', {
    durationMs: Date.now() - startedAt,
    hasData: !!data,
    hasError: !!error,
  });

  if (error) {
    const fallbackStartedAt = Date.now();
    console.log('PROFILE LOOKUP: Legacy fallback started');

    const { data: legacyData, error: legacyError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .maybeSingle();

    console.log('PROFILE LOOKUP: Legacy fallback resolved', {
      durationMs: Date.now() - fallbackStartedAt,
      hasData: !!legacyData,
      hasError: !!legacyError,
    });

    if (!legacyError && legacyData) {
      return {
        ...(legacyData as Omit<Profile, 'avatar_path'>),
        avatar_path: null,
      };
    }

    console.log('GET PROFILE ERROR:', error);
    return null;
  }

  if (!data) {
    console.log('GET PROFILE ERROR:', error);
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    avatar_path?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return {
    error: error?.message ?? null,
  };
}

const PROFILE_PHOTO_BUCKET = 'profile-photos';
const PROFILE_PHOTO_URL_TTL_SECONDS = 60 * 60;
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function getProfilePhotoUrl(
  avatarPath: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(avatarPath, PROFILE_PHOTO_URL_TTL_SECONDS);

  return {
    url: data?.signedUrl ?? null,
    error: error?.message ?? null,
  };
}

export async function uploadProfilePhoto(
  userId: string,
  imageUri: string,
  mimeType: string | null
): Promise<{
  avatarPath: string | null;
  photoUrl: string | null;
  error: string | null;
}> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || authData.user?.id !== userId) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: 'Your account could not be verified. Please sign in again.',
    };
  }

  const contentType = mimeType ?? 'image/jpeg';
  const extension = imageExtensions[contentType];

  if (!extension) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: 'Choose a JPEG, PNG, or WebP image.',
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: profileError?.message ?? 'Your profile could not be found.',
    };
  }

  let imageData: ArrayBuffer;

  try {
    const response = await fetch(imageUri);
    imageData = await response.arrayBuffer();
  } catch {
    return {
      avatarPath: null,
      photoUrl: null,
      error: 'The selected image could not be read.',
    };
  }

  if (imageData.byteLength === 0) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: 'The selected image is empty.',
    };
  }

  if (imageData.byteLength > MAX_PROFILE_PHOTO_BYTES) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: 'Choose an image smaller than 5 MB.',
    };
  }

  const objectPath = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;
  const storage = supabase.storage.from(PROFILE_PHOTO_BUCKET);
  const { error: uploadError } = await storage.upload(
    objectPath,
    imageData,
    {
      contentType,
      cacheControl: '3600',
      upsert: false,
    }
  );

  if (uploadError) {
    return {
      avatarPath: null,
      photoUrl: null,
      error: uploadError.message,
    };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_path: objectPath })
    .eq('id', userId);

  if (updateError) {
    await storage.remove([objectPath]);
    return {
      avatarPath: null,
      photoUrl: null,
      error: updateError.message,
    };
  }

  const { data: signedUrlData, error: signedUrlError } =
    await storage.createSignedUrl(
      objectPath,
      PROFILE_PHOTO_URL_TTL_SECONDS
    );

  if (signedUrlError || !signedUrlData?.signedUrl) {
    await supabase
      .from('profiles')
      .update({ avatar_path: profile.avatar_path })
      .eq('id', userId);
    await storage.remove([objectPath]);

    return {
      avatarPath: null,
      photoUrl: null,
      error: signedUrlError?.message ?? 'The saved image could not be displayed.',
    };
  }

  if (profile.avatar_path && profile.avatar_path !== objectPath) {
    const { error: removeError } = await storage.remove([
      profile.avatar_path,
    ]);

    if (removeError) {
      console.log('REMOVE OLD PROFILE PHOTO ERROR:', removeError);
    }
  }

  return {
    avatarPath: objectPath,
    photoUrl: signedUrlData.signedUrl,
    error: null,
  };
}
