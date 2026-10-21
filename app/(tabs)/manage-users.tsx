
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AdminScreenFrame from '@/components/AdminScreenFrame';
import { COLORS } from '@/constants/colors';
import {
  changeAdminUserRole,
  getAdminUsers,
  type AssignableRole,
  type Profile,
} from '@/lib/profiles';
import { useAdminAccess } from '@/lib/useAdminAccess';

type ProfileRow = Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>;

type FeedbackDialog = {
  title: string;
  message: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return fallback;
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function ManageUsersScreen() {
  const access = useAdminAccess();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: ProfileRow;
    nextRole: AssignableRole;
  } | null>(null);

  const [dialog, setDialog] = useState<FeedbackDialog | null>(null);
  const submittingRoleChange = useRef(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setUsers(await getAdminUsers());
      return true;
    } catch (loadError) {
      console.error('LOAD ADMIN USERS ERROR:', loadError);
      setUsers([]);
      setError(
        `Unable to load users: ${getErrorMessage(
          loadError,
          'Check your connection and try again.'
        )}`
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmRoleChange = useCallback(
    (user: ProfileRow, nextRole: AssignableRole) => {
      setDialog(null);
      setPendingRoleChange({ user, nextRole });
    },
    []
  );

  const executeRoleChange = useCallback(async () => {
    if (!pendingRoleChange || submittingRoleChange.current) return;

    const { user, nextRole } = pendingRoleChange;

    submittingRoleChange.current = true;
    setSavingUserId(user.id);
    setPendingRoleChange(null);
    setDialog(null);

    try {
      await changeAdminUserRole(user.id, nextRole);

      const refreshed = await loadUsers();

      setDialog({
        title: refreshed
          ? 'Role updated'
          : 'Role updated; list not refreshed',
        message: refreshed
          ? `${user.full_name?.trim() || user.email} is now a ${roleLabel(
              nextRole
            )}.`
          : 'The role was saved, but the user list could not be refreshed. Please try again.',
      });
    } catch (changeError) {
      console.error('CHANGE ADMIN USER ROLE ERROR:', changeError);

      setDialog({
        title: 'Role not changed',
        message: getErrorMessage(
          changeError,
          'The role could not be changed. Please try again.'
        ),
      });
    } finally {
      submittingRoleChange.current = false;
      setSavingUserId(null);
    }
  }, [pendingRoleChange, loadUsers]);

  useFocusEffect(
    useCallback(() => {
      if (access.role === 'admin') {
        void loadUsers();
      }
    }, [access.role, loadUsers])
  );

  const availableRoles = useMemo(
    () => Array.from(new Set(users.map((user) => user.role))).sort(),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesSearch =
        !term ||
        (user.full_name ?? '').toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.id.toLowerCase().includes(term);

      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  return (
    <AdminScreenFrame
      access={access}
      title="Manage Users"
      subtitle="Search account profiles and change student or teacher roles."
      showBackButton
      refreshing={loading}
      onRefresh={() => void loadUsers()}
    >
    

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={20}
          color={COLORS.textSecondary}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholder="Search name, email, or user ID"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search users by name, email, or user ID"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear user search"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {['all', ...availableRoles].map((role) => {
          const active = roleFilter === role;
          const label = role === 'all' ? 'All roles' : role;

          return (
            <Pressable
              key={role}
              onPress={() => setRoleFilter(role)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && users.length === 0 ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading user profiles...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={COLORS.danger}
          />
          <Text style={styles.stateTitle}>Users could not be loaded</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            onPress={() => void loadUsers()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="people-outline"
            size={28}
            color={COLORS.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {users.length === 0 ? 'No users available' : 'No matching users'}
          </Text>
          <Text style={styles.stateText}>
            {users.length === 0
              ? 'There are no profiles available to display.'
              : 'Try another name, email, user ID, or role filter.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.resultCount}>
            {filteredUsers.length}{' '}
            {filteredUsers.length === 1 ? 'user' : 'users'}
          </Text>

          {filteredUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.full_name?.trim().charAt(0) || user.email.charAt(0))
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {user.full_name?.trim() || 'Name not provided'}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userId} numberOfLines={1}>
                  ID: {user.id}
                </Text>
              </View>

              <View style={styles.roleActions}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {roleLabel(user.role)}
                  </Text>
                </View>

                {user.id !== access.userId &&
                (user.role === 'student' || user.role === 'teacher') ? (
                  <Pressable
                    onPress={() =>
                      confirmRoleChange(
                        user,
                        user.role === 'student' ? 'teacher' : 'student'
                      )
                    }
                    disabled={savingUserId !== null}
                    style={({ pressed }) => [
                      styles.changeRoleButton,
                      (pressed || savingUserId !== null) &&
                        styles.changeRoleButtonMuted,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Change ${
                      user.full_name?.trim() || user.email
                    } to ${
                      user.role === 'student' ? 'Teacher' : 'Student'
                    }`}
                    accessibilityState={{
                      disabled: savingUserId !== null,
                    }}
                  >
                    {savingUserId === user.id ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={styles.changeRoleButtonText}>
                        Change to{' '}
                        {user.role === 'student' ? 'Teacher' : 'Student'}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {pendingRoleChange && (
        <View style={styles.dialogOverlay}>
          <View
            style={styles.dialogCard}
            accessibilityRole="alert"
            accessibilityLabel="Confirm role change"
          >
            <Text style={styles.dialogTitle}>Confirm role change</Text>

            <Text style={styles.dialogMessage}>
              Change{' '}
              {pendingRoleChange.user.full_name?.trim() ||
                pendingRoleChange.user.email}{' '}
              from {roleLabel(pendingRoleChange.user.role)} to{' '}
              {roleLabel(pendingRoleChange.nextRole)}?
            </Text>

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setPendingRoleChange(null)}
                style={styles.dialogCancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => void executeRoleChange()}
                style={styles.dialogConfirmButton}
                accessibilityRole="button"
              >
                <Text style={styles.dialogConfirmText}>Change role</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {dialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard} accessibilityRole="alert">
            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setDialog(null)}
                style={styles.dialogConfirmButton}
                accessibilityRole="button"
              >
                <Text style={styles.dialogConfirmText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AdminScreenFrame>
  );
}

const styles = StyleSheet.create({
  
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 11,
  },
  filters: {
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  resultCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  avatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  userId: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  roleBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  roleActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  changeRoleButton: {
    minHeight: 32,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  changeRoleButtonMuted: {
    opacity: 0.6,
  },
  changeRoleButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  stateCard: {
    alignItems: 'center',
    padding: 22,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  stateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  dialogMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  dialogCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dialogCancelText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  dialogConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  dialogConfirmText: {
    color: COLORS.textOnPrimary,
    fontWeight: '600',
  },
});
