import { useCallback, useMemo, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { useAdminAccess } from '@/lib/useAdminAccess';

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

export default function ManageUsersScreen() {
  const access = useAdminAccess();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name', { ascending: true, nullsFirst: false });

      if (queryError) throw queryError;
      setUsers((data ?? []) as ProfileRow[]);
    } catch (loadError) {
      console.error('LOAD ADMIN USERS ERROR:', loadError);
      setUsers([]);
      setError(
        loadError instanceof Error
          ? `Unable to load users: ${loadError.message}`
          : 'Unable to load users. Check profile-table access and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
      subtitle="Search account profiles. Role changes are unavailable until a secure backend operation is verified."
      showBackButton
      refreshing={loading}
      onRefresh={() => void loadUsers()}
    >
      <View style={styles.readOnlyNotice}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={COLORS.warning}
        />
        <Text style={styles.noticeText}>
          Read-only: the repository does not define a verified role-management
          operation. Do not change profiles.role directly from the client.
          Self-role protection must also be confirmed in Supabase before role
          controls can be enabled.
        </Text>
      </View>

      <View style={styles.policyNotice}>
        <Ionicons
          name="information-circle-outline"
          size={19}
          color={COLORS.primary}
        />
        <Text style={styles.policyNoticeText}>
          The checked-in profile SELECT policy is owner-only. Until Supabase
          confirms an administrator read policy, this list may contain only
          profiles the signed-in account is allowed to read.
        </Text>
      </View>

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
              ? 'Profiles will appear here only when permitted by the deployed profile policies.'
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
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{user.role}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </AdminScreenFrame>
  );
}

const styles = StyleSheet.create({
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warning,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  policyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  policyNoticeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
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
    textTransform: 'uppercase',
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
});
