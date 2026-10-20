import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE KEY EXISTS:", !!supabaseAnonKey);

const authStorage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: async (key: string) => {
          const startedAt = Date.now();
          console.log('AUTH STORAGE: SecureStore read started');

          try {
            const value = await SecureStore.getItemAsync(key);
            console.log('AUTH STORAGE: SecureStore read resolved', {
              durationMs: Date.now() - startedAt,
              hasValue: value !== null,
            });
            return value;
          } catch (error) {
            console.error('AUTH STORAGE: SecureStore read failed', {
              durationMs: Date.now() - startedAt,
            });
            throw error;
          }
        },
        setItem: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    ...(authStorage ? { storage: authStorage } : {}),
  },
});