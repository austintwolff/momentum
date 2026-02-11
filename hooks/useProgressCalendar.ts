import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export type CalendarMode = 'score' | 'pr';

export interface DayData {
  date: string; // YYYY-MM-DD
  value: number; // score (0-100) or E1RM in kg
  workouts?: WorkoutSummary[];
  bestSet?: SetData;
}

export interface WorkoutSummary {
  id: string;
  name: string;
  final_score: number | null;
  duration_seconds: number | null;
  started_at: string;
}

export interface SetData {
  workout_id: string;
  workout_name: string;
  weight_kg: number;
  reps: number;
  e1rm: number;
}

export interface MonthData {
  year: number;
  month: number; // 1-12
  days: Map<number, DayData>; // day of month -> data
  isLoading: boolean;
}

/**
 * Calculate E1RM using Brzycki formula
 * E1RM = weight × (36 / (37 - min(reps, 12)))
 */
function calculateE1RM(weight: number, reps: number): number {
  const cappedReps = Math.min(reps, 12);
  if (cappedReps >= 37) return weight; // Edge case
  return weight * (36 / (37 - cappedReps));
}

/**
 * Generate month key for Map
 */
function getMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

interface UseProgressCalendarReturn {
  monthsData: Map<string, MonthData>;
  fetchMonth: (year: number, month: number) => Promise<void>;
  isLoading: boolean;
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  selectedExerciseId: string | null;
  setSelectedExerciseId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

export function useProgressCalendar(): UseProgressCalendarReturn {
  const user = useAuthStore(s => s.user);
  const [monthsData, setMonthsData] = useState<Map<string, MonthData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<CalendarMode>('score');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // Track which months are currently being fetched
  const fetchingRef = useRef<Set<string>>(new Set());

  const fetchWorkoutScoreMonth = useCallback(async (year: number, month: number) => {
    if (!user) return;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const { data, error } = await (supabase
      .from('workout_sessions') as any)
      .select('id, name, final_score, started_at, duration_seconds')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching workout scores:', error);
      return;
    }

    // Group by date, keeping best score per day and all workouts
    const daysMap = new Map<number, DayData>();
    const workoutsByDay = new Map<number, WorkoutSummary[]>();

    if (data) {
      data.forEach((workout: any) => {
        const date = new Date(workout.started_at);
        const dayOfMonth = date.getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

        const workoutSummary: WorkoutSummary = {
          id: workout.id,
          name: workout.name,
          final_score: workout.final_score,
          duration_seconds: workout.duration_seconds,
          started_at: workout.started_at,
        };

        // Track all workouts for this day
        if (!workoutsByDay.has(dayOfMonth)) {
          workoutsByDay.set(dayOfMonth, []);
        }
        workoutsByDay.get(dayOfMonth)!.push(workoutSummary);

        // Track best score for this day
        const existingDay = daysMap.get(dayOfMonth);
        const currentScore = workout.final_score ?? 0;

        if (!existingDay || currentScore > existingDay.value) {
          daysMap.set(dayOfMonth, {
            date: dateStr,
            value: currentScore,
            workouts: workoutsByDay.get(dayOfMonth),
          });
        } else {
          // Update workouts list
          existingDay.workouts = workoutsByDay.get(dayOfMonth);
        }
      });
    }

    setMonthsData(prev => {
      const newMap = new Map(prev);
      newMap.set(getMonthKey(year, month), {
        year,
        month,
        days: daysMap,
        isLoading: false,
      });
      return newMap;
    });
  }, [user]);

  const fetchExercisePRMonth = useCallback(async (year: number, month: number, exerciseId: string) => {
    if (!user) return;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const { data, error } = await (supabase
      .from('workout_sets') as any)
      .select(`
        weight_kg,
        reps,
        workout_session_id,
        workout_sessions!inner (
          id,
          name,
          completed_at
        )
      `)
      .eq('exercise_id', exerciseId)
      .eq('workout_sessions.user_id', user.id)
      .not('workout_sessions.completed_at', 'is', null)
      .gte('workout_sessions.completed_at', startDate.toISOString())
      .lte('workout_sessions.completed_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching exercise PRs:', error);
      return;
    }

    // Group by date, keeping best E1RM per day
    const daysMap = new Map<number, DayData>();

    if (data) {
      data.forEach((set: any) => {
        const session = set.workout_sessions;
        if (!session?.completed_at) return;

        const date = new Date(session.completed_at);
        const dayOfMonth = date.getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

        const weight = set.weight_kg ?? 0;
        const reps = set.reps ?? 0;
        if (weight === 0 || reps === 0) return;

        const e1rm = calculateE1RM(weight, reps);

        const existingDay = daysMap.get(dayOfMonth);

        if (!existingDay || e1rm > existingDay.value) {
          daysMap.set(dayOfMonth, {
            date: dateStr,
            value: Math.round(e1rm * 10) / 10, // Round to 1 decimal
            bestSet: {
              workout_id: session.id,
              workout_name: session.name,
              weight_kg: weight,
              reps: reps,
              e1rm: Math.round(e1rm * 10) / 10,
            },
          });
        }
      });
    }

    setMonthsData(prev => {
      const newMap = new Map(prev);
      newMap.set(getMonthKey(year, month), {
        year,
        month,
        days: daysMap,
        isLoading: false,
      });
      return newMap;
    });
  }, [user]);

  const fetchMonth = useCallback(async (year: number, month: number) => {
    const key = getMonthKey(year, month);

    // Don't fetch if already fetching or already have data
    if (fetchingRef.current.has(key)) return;

    // Mark as loading
    fetchingRef.current.add(key);
    setMonthsData(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(key);
      if (!existing) {
        newMap.set(key, {
          year,
          month,
          days: new Map(),
          isLoading: true,
        });
      }
      return newMap;
    });

    try {
      if (mode === 'score') {
        await fetchWorkoutScoreMonth(year, month);
      } else if (selectedExerciseId) {
        await fetchExercisePRMonth(year, month, selectedExerciseId);
      } else {
        // No exercise selected, just set empty data
        setMonthsData(prev => {
          const newMap = new Map(prev);
          newMap.set(key, {
            year,
            month,
            days: new Map(),
            isLoading: false,
          });
          return newMap;
        });
      }
    } finally {
      fetchingRef.current.delete(key);
    }
  }, [mode, selectedExerciseId, fetchWorkoutScoreMonth, fetchExercisePRMonth]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setMonthsData(new Map());
    fetchingRef.current.clear();

    // Fetch current month
    const now = new Date();
    await fetchMonth(now.getFullYear(), now.getMonth() + 1);
    setIsLoading(false);
  }, [fetchMonth]);

  // Handle mode change - clear data and refetch
  const handleSetMode = useCallback((newMode: CalendarMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setMonthsData(new Map());
      fetchingRef.current.clear();
    }
  }, [mode]);

  // Handle exercise change - clear data and refetch
  const handleSetExerciseId = useCallback((id: string | null) => {
    if (id !== selectedExerciseId) {
      setSelectedExerciseId(id);
      setMonthsData(new Map());
      fetchingRef.current.clear();
    }
  }, [selectedExerciseId]);

  return {
    monthsData,
    fetchMonth,
    isLoading,
    mode,
    setMode: handleSetMode,
    selectedExerciseId,
    setSelectedExerciseId: handleSetExerciseId,
    refresh,
  };
}
