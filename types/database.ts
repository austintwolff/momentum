export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Baseline session history entry
export interface BaselineSessionEntry {
  e1rm: number;
  date: string;
  weight: number;
  reps: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bodyweight_kg: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bodyweight_kg?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bodyweight_kg?: number | null;
          updated_at?: string;
        };
      };
      user_stats: {
        Row: {
          user_id: string;
          total_points: number;
          weekly_points: number;
          current_workout_streak: number;
          longest_workout_streak: number;
          total_workouts: number;
          total_volume_kg: number;
          current_overload_streak: number;
          last_workout_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_points?: number;
          weekly_points?: number;
          current_workout_streak?: number;
          longest_workout_streak?: number;
          total_workouts?: number;
          total_volume_kg?: number;
          current_overload_streak?: number;
          last_workout_at?: string | null;
          updated_at?: string;
        };
        Update: {
          total_points?: number;
          weekly_points?: number;
          current_workout_streak?: number;
          longest_workout_streak?: number;
          total_workouts?: number;
          total_volume_kg?: number;
          current_overload_streak?: number;
          last_workout_at?: string | null;
          updated_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          exercise_type: 'weighted' | 'bodyweight';
          muscle_group: string;
          equipment: string[] | null;
          is_compound: boolean;
          created_by: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          exercise_type: 'weighted' | 'bodyweight';
          muscle_group: string;
          equipment?: string[] | null;
          is_compound?: boolean;
          created_by?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          exercise_type?: 'weighted' | 'bodyweight';
          muscle_group?: string;
          equipment?: string[] | null;
          is_compound?: boolean;
          is_public?: boolean;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          started_at: string;
          completed_at: string | null;
          duration_seconds: number | null;
          notes: string | null;
          total_volume_kg: number;
          total_points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          started_at?: string;
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          total_volume_kg?: number;
          total_points?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          total_volume_kg?: number;
          total_points?: number;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_session_id: string;
          exercise_id: string;
          set_number: number;
          set_type: 'warmup' | 'working' | 'dropset' | 'failure';
          weight_kg: number | null;
          reps: number;
          rpe: number | null;
          is_bodyweight: boolean;
          points_earned: number;
          is_pr: boolean;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_session_id: string;
          exercise_id: string;
          set_number: number;
          set_type?: 'warmup' | 'working' | 'dropset' | 'failure';
          weight_kg?: number | null;
          reps: number;
          rpe?: number | null;
          is_bodyweight?: boolean;
          points_earned?: number;
          is_pr?: boolean;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          set_number?: number;
          set_type?: 'warmup' | 'working' | 'dropset' | 'failure';
          weight_kg?: number | null;
          reps?: number;
          rpe?: number | null;
          points_earned?: number;
          is_pr?: boolean;
        };
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          workout_session_id: string | null;
          workout_set_id: string | null;
          transaction_type: string;
          base_points: number;
          multiplier: number;
          final_points: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_session_id?: string | null;
          workout_set_id?: string | null;
          transaction_type: string;
          base_points: number;
          multiplier?: number;
          final_points: number;
          description?: string | null;
          created_at?: string;
        };
        Update: never;
      };
      exercise_baselines: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          rolling_avg_e1rm: number;
          session_history: BaselineSessionEntry[];
          workout_count: number;
          is_baselined: boolean;
          best_e1rm: number;
          best_e1rm_date: string | null;
          best_e1rm_strength: number;
          best_e1rm_hypertrophy: number;
          best_e1rm_endurance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          rolling_avg_e1rm?: number;
          session_history?: BaselineSessionEntry[];
          workout_count?: number;
          is_baselined?: boolean;
          best_e1rm?: number;
          best_e1rm_date?: string | null;
          best_e1rm_strength?: number;
          best_e1rm_hypertrophy?: number;
          best_e1rm_endurance?: number;
        };
        Update: {
          rolling_avg_e1rm?: number;
          session_history?: BaselineSessionEntry[];
          workout_count?: number;
          is_baselined?: boolean;
          best_e1rm?: number;
          best_e1rm_date?: string | null;
          best_e1rm_strength?: number;
          best_e1rm_hypertrophy?: number;
          best_e1rm_endurance?: number;
          updated_at?: string;
        };
      };
      muscle_levels: {
        Row: {
          id: string;
          user_id: string;
          muscle_group: string;
          current_level: number;
          current_xp: number;
          total_xp_earned: number;
          last_trained_at: string | null;
          decay_applied_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          muscle_group: string;
          current_level?: number;
          current_xp?: number;
          total_xp_earned?: number;
          last_trained_at?: string | null;
        };
        Update: {
          current_level?: number;
          current_xp?: number;
          total_xp_earned?: number;
          last_trained_at?: string | null;
          decay_applied_at?: string | null;
          updated_at?: string;
        };
      };
      weekly_muscle_stats: {
        Row: {
          id: string;
          user_id: string;
          muscle_group: string;
          week_start: string;
          workout_count: number;
          total_sets: number;
          total_points: number;
          consistency_bonus_applied: boolean;
          bonus_percentage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          muscle_group: string;
          week_start: string;
          workout_count?: number;
          total_sets?: number;
          total_points?: number;
        };
        Update: {
          workout_count?: number;
          total_sets?: number;
          total_points?: number;
          consistency_bonus_applied?: boolean;
          bonus_percentage?: number;
          updated_at?: string;
        };
      };
      exercise_muscle_map: {
        Row: {
          id: string;
          exercise_name: string;
          muscle_group: string;
          contribution_percentage: number;
          is_primary: boolean;
          muscle_order: number;
        };
        Insert: {
          id?: string;
          exercise_name: string;
          muscle_group: string;
          contribution_percentage?: number;
          is_primary?: boolean;
          muscle_order?: number;
        };
        Update: {
          contribution_percentage?: number;
          is_primary?: boolean;
          muscle_order?: number;
        };
      };
      user_charms: {
        Row: {
          id: string;
          user_id: string;
          charm_id: string;
          equipped: boolean;
          acquired_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          charm_id: string;
          equipped?: boolean;
          acquired_at?: string;
        };
        Update: {
          equipped?: boolean;
        };
      };
      user_runes: {
        Row: {
          id: string;
          user_id: string;
          rune_id: string;
          equipped: boolean;
          acquired_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rune_id: string;
          equipped?: boolean;
          acquired_at?: string;
        };
        Update: {
          equipped?: boolean;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserStats = Database['public']['Tables']['user_stats']['Row'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];
export type ExerciseBaseline = Database['public']['Tables']['exercise_baselines']['Row'];
export type MuscleLevel = Database['public']['Tables']['muscle_levels']['Row'];
export type WeeklyMuscleStats = Database['public']['Tables']['weekly_muscle_stats']['Row'];
export type ExerciseMuscleMap = Database['public']['Tables']['exercise_muscle_map']['Row'];
export type UserCharm = Database['public']['Tables']['user_charms']['Row'];
export type UserRune = Database['public']['Tables']['user_runes']['Row'];
