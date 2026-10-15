import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function TabLayout() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      setLoading(true);
      setRole(null);

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getProfile(user.id);

        if (active) {
          setRole(profile?.role ?? null);
        }
      } catch (error) {
        console.log('LOAD ROLE ERROR:', error);

        if (active) {
          setRole(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!role) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color={COLORS.danger}
        />
      </View>
    );
  }

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#64748B',
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
        },
      }}
    >
      {/* ADMIN DASHBOARD */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarLabel: 'Admin',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: isTeacher ? 'Teacher Dashboard' : 'Home',
          tabBarLabel: 'Home',
          href: isStudent || isTeacher ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home-sharp' : 'home-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* STUDENT AVAILABLE EVENTS */}
      <Tabs.Screen
        name="available-events"
        options={{
          title: 'Available Events',
          tabBarLabel: 'Events',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* TEACHER EVENT MANAGEMENT */}
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'My Events',
          tabBarLabel: 'My Events',
          href: isTeacher ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* STUDENT QR SCANNER */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan QR Code',
          tabBarLabel: 'Scan',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* ATTENDANCE HISTORY */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          href: isStudent || isTeacher ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />

      {/* PROFILE — ALWAYS LAST */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}