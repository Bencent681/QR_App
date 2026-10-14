
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  getProfile,
  getProfilePhotoUrl,
  uploadProfilePhoto,
  updateProfile,
  type Profile,
} from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    mimeType: string | null;
  } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  const loadProfile = useCallback(async (isActive: () => boolean) => {
    if (!user) {
      console.log('PROFILE DEBUG: No logged-in user');
      setProfile(null);
      setPhotoUrl(null);
      setPendingPhoto(null);
      return;
    }

    setProfile(null);
    setPhotoUrl(null);
    setPendingPhoto(null);
    setPhotoLoadFailed(false);

    try {
      const p = await getProfile(user.id);

      if (!isActive()) return;

      setProfile(p);
      setDraftName(p?.full_name ?? '');

      if (p?.avatar_path) {
        const { url, error } = await getProfilePhotoUrl(p.avatar_path);

        if (!isActive()) return;

        if (error) {
          console.log('LOAD PROFILE PHOTO ERROR:', error);
        }

        setPhotoUrl(url);
      }
    } catch (error) {
      console.log('PROFILE DEBUG - Loading error:', error);

      if (isActive()) {
        Alert.alert('Error', 'Could not load your profile.');
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProfile(() => active);

      return () => {
        active = false;
      };
    }, [loadProfile])
  );

  const handleChoosePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access to choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setPhotoLoadFailed(false);
      setPendingPhoto({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? null,
      });
    } catch (error) {
      console.log('CHOOSE PROFILE PHOTO ERROR:', error);
      Alert.alert('Error', 'Could not open your photo library.');
    }
  };

  const handleSavePhoto = async () => {
    if (!user || !pendingPhoto || photoUploading) return;

    setPhotoUploading(true);

    try {
      const result = await uploadProfilePhoto(
        user.id,
        pendingPhoto.uri,
        pendingPhoto.mimeType
      );

      if (result.error || !result.avatarPath || !result.photoUrl) {
        Alert.alert(
          'Photo not saved',
          result.error ?? 'Please try selecting the photo again.'
        );
        return;
      }

      setProfile((current) =>
        current
          ? { ...current, avatar_path: result.avatarPath }
          : current
      );
      setPhotoUrl(result.photoUrl);
      setPhotoLoadFailed(false);
      setPendingPhoto(null);
      Alert.alert('Profile photo updated', 'Your new photo has been saved.');
    } catch (error) {
      console.log('SAVE PROFILE PHOTO ERROR:', error);
      Alert.alert('Photo not saved', 'Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;

    const name = draftName.trim();

    if (!name) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: name,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: name,
            }
          : prev
      );

      setEditing(false);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Failed to update your name.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  const displayName = profile?.full_name || 'Your Name';

  const role =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'teacher'
        ? 'Teacher'
        : profile?.role === 'student'
          ? 'Student'
          : 'Unknown';

  const canChangePhoto = Boolean(user && profile?.id === user.id);
  const displayedPhoto = pendingPhoto?.uri ?? photoUrl;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* PAGE HEADER */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>My Profile</Text>
            <Text style={styles.pageSubtitle}>
              Manage your account information
            </Text>
          </View>
        </View>

        {user && (
          <>
            {/* PROFILE HEADER CARD */}
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                {displayedPhoto && !photoLoadFailed ? (
                  <Image
                    source={{ uri: displayedPhoto }}
                    style={styles.avatarImage}
                    onError={() => setPhotoLoadFailed(true)}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons
                      name="person-outline"
                      size={34}
                      color={COLORS.textSecondary}
                    />
                  </View>
                )}
              </View>

              <View style={styles.profileMain}>
                <Text
                  style={styles.profileName}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>

                <Text
                  style={styles.profileEmail}
                  numberOfLines={1}
                >
                  {profile?.email || user.email}
                </Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {role.toUpperCase()}
                  </Text>
                </View>

                {canChangePhoto && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleChoosePhoto}
                    disabled={photoUploading}
                    style={styles.changePhotoButton}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={15}
                      color={COLORS.primary}
                    />
                    <Text style={styles.changePhotoText}>
                      Change Profile Picture
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {pendingPhoto && canChangePhoto && (
              <View style={styles.photoConfirmation}>
                <View style={styles.photoConfirmationTextRow}>
                  {photoUploading && (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary}
                    />
                  )}
                  <Text style={styles.photoConfirmationText}>
                    {photoUploading
                      ? 'Saving profile picture...'
                      : 'Preview selected. Save this picture?'}
                  </Text>
                </View>
                <View style={styles.photoConfirmationActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPendingPhoto(null)}
                    disabled={photoUploading}
                    style={styles.photoCancelButton}
                  >
                    <Text style={styles.photoCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSavePhoto}
                    disabled={photoUploading}
                    style={[
                      styles.photoSaveButton,
                      photoUploading && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.photoSaveText}>Save Photo</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* PERSONAL INFORMATION */}
            <Text style={styles.sectionTitle}>
              Personal Information
            </Text>

            <View style={styles.infoCard}>
              {/* FULL NAME */}
              <View style={styles.infoHeader}>
                <Text style={styles.infoLabel}>
                  FULL NAME
                </Text>

                {!editing && (
                  <Pressable
                    onPress={() => {
                      setDraftName(profile?.full_name ?? '');
                      setEditing(true);
                    }}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                )}
              </View>

              {editing ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Enter your full name"
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="words"
                    editable={!saving}
                  />

                  <View style={styles.editActions}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => {
                        setDraftName(profile?.full_name ?? '');
                        setEditing(false);
                      }}
                      disabled={saving}
                    >
                      <Text style={styles.cancelText}>
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.saveButton,
                        saving && styles.disabledButton,
                      ]}
                      onPress={handleSaveName}
                      disabled={saving}
                    >
                      <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={styles.infoValue}>
                  {profile?.full_name || 'Tap Edit to add your name'}
                </Text>
              )}

              <View style={styles.divider} />

              {/* EMAIL */}
              <Text style={styles.infoLabel}>
                EMAIL ADDRESS
              </Text>

              <Text style={styles.infoValue}>
                {profile?.email || user.email}
              </Text>

              <View style={styles.divider} />

              {/* ACCOUNT TYPE */}
              <Text style={styles.infoLabel}>
                ACCOUNT TYPE
              </Text>

              <View style={styles.accountTypeRow}>
                <View style={styles.smallRoleIcon}>
                  <Text style={styles.smallRoleIconText}>
                    {role === 'Admin'
                      ? 'A'
                      : role === 'Teacher'
                        ? 'T'
                        : role === 'Student'
                          ? 'S'
                          : '?'}
                  </Text>
                </View>

                <Text style={styles.infoValue}>
                  {role}
                </Text>
              </View>
            </View>

            {/* ACCOUNT INFORMATION */}
            <Text style={styles.sectionTitle}>
              Account Information
            </Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>USER ID</Text>

              <View style={styles.userIdBox}>
                <Text style={styles.userId} selectable>
                  {user.id}
                </Text>
              </View>

              <Text style={styles.userIdHint}>
                Your unique account identifier
              </Text>
            </View>

            {/* SIGN OUT */}
            <View style={styles.signOutSection}>
              <Text style={styles.sectionTitle}>Account</Text>

              <AppButton
                title={loading ? 'Signing Out...' : 'Sign Out'}
                icon="log-out-outline"
                onPress={handleSignOut}
                disabled={loading}
              />

              <Text style={styles.signOutHint}>
                You can sign back in anytime using your
                account credentials.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 35,
  },

  pageHeader: {
    marginBottom: 22,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 27,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 22,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#3A3F45',
    overflow: 'hidden',
  },

  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },

  profileMain: {
    flex: 1,
  },

  profileName: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  profileEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 9,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#292C30',
    borderWidth: 1,
    borderColor: '#3A3F45',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  roleBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#FFD33D',
  },

  changePhotoButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },

  changePhotoText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 5,
  },

  photoConfirmation: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: -15,
    marginBottom: 22,
  },

  photoConfirmationTextRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },

  photoConfirmationText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },

  photoConfirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },

  photoCancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: '#292C30',
  },

  photoCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  photoSaveButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },

  photoSaveText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 11,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 25,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD33D',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  editContainer: {
    marginTop: 2,
  },

  nameInput: {
    backgroundColor: COLORS.background,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 9,
    gap: 8,
  },

  cancelButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#292C30',
  },

  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#FFD33D',
  },

  saveButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#151719',
  },

  disabledButton: {
    opacity: 0.5,
  },

  accountTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  smallRoleIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#292C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  smallRoleIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD33D',
  },

  userIdBox: {
    backgroundColor: '#151719',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
    marginTop: 3,
  },

  userId: {
    fontSize: 10,
    lineHeight: 16,
    color: '#C8CDD2',
  },

  userIdHint: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 7,
  },

  signOutSection: {
    marginTop: 1,
  },

  signOutHint: {
    fontSize: 10,
    lineHeight: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
});
