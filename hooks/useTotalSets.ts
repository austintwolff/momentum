import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export function useTotalSets() {
  const { user } = useAuthStore();
  const [totalSets, setTotalSets] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTotalSets(0);
      setIsLoading(false);
      return;
    }

    const fetchTotalSets = async () => {
      try {
        // Count all sets from completed workouts
        const { count, error } = await (supabase
          .from('workout_sets') as any)
          .select('id', { count: 'exact', head: true })
          .eq('workout_sessions.user_id', user.id);

        if (error) {
          // Fallback: count directly from workout_sets with a join
          const { data, error: fallbackError } = await (supabase
            .from('workout_sets') as any)
            .select(`
              id,
              workout_sessions!inner (
                user_id
              )
            `)
            .eq('workout_sessions.user_id', user.id);

          if (!fallbackError && data) {
            setTotalSets(data.length);
          }
        } else {
          setTotalSets(count || 0);
        }
      } catch (error) {
        console.error('Error fetching total sets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTotalSets();
  }, [user]);

  return { totalSets, isLoading };
}
