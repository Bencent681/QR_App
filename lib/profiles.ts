import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};
