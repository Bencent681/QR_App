import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

type ProfileAccessState = {
  userId: string | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
};

export type AdminAccess = {
  userId: string | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
};

export function useAdminAccess(): AdminAccess {
  const { user } = useAuth();
  const [profileState, setProfileState] = useState<ProfileAccessState>({
    userId: null,
    role: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) {
        setProfileState({
          userId: null,
          role: null,
          loading: false,
          error: null,
        });
        return;
      }

      setProfileState({
        userId: user.id,
        role: null,
        loading: true,
        error: null,
      });

      try {
        const profile = await getProfile(user.id);

        if (!profile) {
          throw new Error('Unable to load your account profile.');
        }

        if (active) {
          setProfileState({
            userId: user.id,
            role: profile.role,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('LOAD ADMIN ACCESS ERROR:', error);

        if (active) {
          setProfileState({
            userId: user.id,
            role: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to verify your account role.',
          });
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const userId = user?.id ?? null;
  const profileMatchesUser = profileState.userId === userId;

  return {
    userId,
    role: profileMatchesUser ? profileState.role : null,
    loading: !!userId && (!profileMatchesUser || profileState.loading),
    error: profileMatchesUser ? profileState.error : null,
  };
}
