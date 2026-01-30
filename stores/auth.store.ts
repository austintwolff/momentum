import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, UserStats } from '@/types/database';
import { uploadAvatar, updateProfileInDatabase } from '@/services/profile.service';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  userStats: UserStats | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchUserStats: () => Promise<void>;
  refreshUserStats: () => Promise<void>;
  updateBodyweight: (bodyweightKg: number) => Promise<void>;
  updateProfile: (displayName: string, avatarUri?: string | null) => Promise<void>;
}

// MOCK DATA FOR TESTING (auth disabled)
const MOCK_PROFILE = {
  id: 'test-user-123',
  username: 'TestUser',
  display_name: 'Test User',
  avatar_url: null,
  bodyweight_kg: 75,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_USER_STATS = {
  user_id: 'test-user-123',
  total_points: 1250,
  weekly_points: 320,
  current_workout_streak: 5,
  longest_workout_streak: 12,
  total_workouts: 24,
  total_volume_kg: 45000,
  current_overload_streak: 3,
  last_workout_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  updated_at: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  userStats: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      // Add timeout to prevent hanging on web
      const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
        setTimeout(() => {
          console.warn('Auth session check timed out');
          resolve({ data: { session: null } });
        }, 5000); // 5 second timeout
      });

      const sessionPromise = supabase.auth.getSession();
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isInitialized: true,
      });

      if (session?.user) {
        // Don't await these - let them run in background
        get().fetchProfile().catch(console.error);
        get().fetchUserStats().catch(console.error);
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });

        if (session?.user) {
          get().fetchProfile().catch(console.error);
          get().fetchUserStats().catch(console.error);
        } else {
          set({ profile: null, userStats: null });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  signUp: async (email: string, password: string, username: string) => {
    set({ isLoading: true });

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (error) {
      set({ isLoading: false });
      throw error;
    }

    set({ isLoading: false });
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      throw error;
    }

    // Set session directly from response (don't wait for onAuthStateChange)
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
    });

    // Fetch profile and stats
    if (data.session?.user) {
      await get().fetchProfile();
      await get().fetchUserStats();
    }
  },

  signOut: async () => {
    set({ isLoading: true });

    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ isLoading: false });
      throw error;
    }

    set({
      session: null,
      user: null,
      profile: null,
      userStats: null,
      isLoading: false,
    });
  },

  fetchProfile: async () => {
    const user = get().user;
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // If profile doesn't exist, try to create it from user metadata
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
            display_name: user.user_metadata?.display_name || user.user_metadata?.username || 'Athlete',
          })
          .select()
          .single();

        if (createError) {
          console.error('[Auth] Error creating profile');
          return;
        }
        set({ profile: newProfile });
      }
      return;
    }

    set({ profile: data });
  },

  fetchUserStats: async () => {
    const user = get().user;
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If user stats don't exist, create them
      if (error.code === 'PGRST116') {
        const { data: newStats, error: createError } = await supabase
          .from('user_stats')
          .insert({
            user_id: user.id,
            total_points: 0,
            weekly_points: 0,
            current_workout_streak: 0,
            longest_workout_streak: 0,
            total_workouts: 0,
            total_volume_kg: 0,
          })
          .select()
          .single();

        if (createError) {
          console.error('[Auth] Error creating user stats');
          return;
        }
        set({ userStats: newStats });
      }
      return;
    }

    set({ userStats: data });
  },

  refreshUserStats: async () => {
    await get().fetchUserStats();
  },

  updateBodyweight: async (bodyweightKg: number) => {
    const user = get().user;
    if (!user) return;

    const { error } = await (supabase
      .from('profiles') as any)
      .update({ bodyweight_kg: bodyweightKg })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    await get().fetchProfile();
  },

  updateProfile: async (displayName: string, avatarUri?: string | null) => {
    const user = get().user;
    if (!user) return;

    let avatarUrl: string | null | undefined;

    // If a new avatar was selected, upload it
    if (avatarUri && !avatarUri.startsWith('http')) {
      avatarUrl = await uploadAvatar(user.id, avatarUri);
    } else if (avatarUri === null) {
      // User wants to remove their avatar
      avatarUrl = null;
    }

    await updateProfileInDatabase({
      userId: user.id,
      displayName,
      avatarUrl,
    });

    await get().fetchProfile();
  },
}));
