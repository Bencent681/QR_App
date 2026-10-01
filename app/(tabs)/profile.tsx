import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  getProfile,
  updateProfile,
  type Profile,
} from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const p = await getProfile(user.id);

    setProfile(p);
    setDraftName(p?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      {user && (
        <View style={styles.infoCard}>
          {/* ROLE */}
          {profile?.role === 'teacher' ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                Teacher
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.roleBadge,
                styles.roleBadgeStudent,
              ]}
            >
              <Text style={styles.roleBadgeText}>
                Student
              </Text>
            </View>
          )}

          {/* FULL NAME */}
          <Text style={styles.label}>Full Name</Text>

          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
                editable={!saving}
              />

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
          ) : (
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setDraftName(profile?.full_name ?? '');
                setEditing(true);
              }}
            >
              <Text style={styles.value}>
                {profile?.full_name ||
                  'Tap to add your name'}
              </Text>

              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          {/* EMAIL */}
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>
            {profile?.email || user.email}
          </Text>

          {/* USER ID */}
          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>
            {user.id}
          </Text>
        </View>
      )}

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },

  roleBadgeStudent: {
    backgroundColor: COLORS.border,
  },

  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.background,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  editHint: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  nameInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  saveButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '700',
  },
});