
import { useState, useEffect } from 'react';

import { supabase } from './supabase';

import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;

const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => {
      forceRender((n) => n + 1);
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const normalizedEmail = email.trim();
  const fullName = profile?.full_name?.trim() ?? '';
  const role = profile?.role ?? 'student';

  console.log('SIGNUP START');
  console.log('EMAIL:', normalizedEmail);
  console.log('PROFILE:', { full_name: fullName, role });

  try {
    if (!fullName) {
      return {
        data: null,
        error: new Error('Please enter your full name.'),
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    console.log('SIGNUP DATA:', data);
    console.log('SIGNUP ERROR:', error);

    if (error) {
      return {
        data,
        error,
      };
    }

    const user = data.user;

    if (!user) {
      return {
        data,
        error: new Error(
          'Signup did not return a user. Please try again.'
        ),
      };
    }

    /*
     * The Supabase database trigger should create
     * the profiles row using the Auth metadata.
     *
     * No client-side profiles upsert is performed
     * here, because email confirmation may be pending
     * and the user may not have an authenticated session.
     */

    if (data.session) {
      setAuth(data.session);
    }

    return {
      data,
      error: null,
    };
  } catch (err) {
    console.error('SIGNUP CATCH ERROR:', err);

    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('Signup failed. Please try again.'),
    };
  }
}

export async function signIn(
  email: string,
  password: string
) {
  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    console.log('SIGNIN DATA:', data);
    console.log('SIGNIN ERROR:', error);

    if (error) {
      return {
        data,
        error,
      };
    }

    if (data.session) {
      setAuth(data.session);
    }

    return {
      data,
      error: null,
    };
  } catch (err) {
    console.error('SIGNIN CATCH ERROR:', err);

    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('Login failed. Please try again.'),
    };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      setAuth(null);
    }

    return {
      error,
    };
  } catch (err) {
    console.error('SIGNOUT ERROR:', err);

    return {
      error:
        err instanceof Error
          ? err
          : new Error('Logout failed. Please try again.'),
    };
  }
}
