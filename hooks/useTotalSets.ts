import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

async function fetchTotalSets(userId: string): Promise<number> {
  // Count all sets from completed workouts using inner join + exact count
  const { count, error } = await (supabase
    .from('workout_sets') as any)
    .select('id, workout_sessions!inner(user_id)', { count: 'exact', head: true })
    .eq('workout_sessions.user_id', userId);

  if (error) {
    return 0;
  }

  return count || 0;
}

export function useTotalSets() {
  const user = useAuthStore(s => s.user);

  const { data: totalSets = 0, isLoading } = useQuery({
    queryKey: ['totalSets', user?.id],
    queryFn: () => fetchTotalSets(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  return { totalSets, isLoading };
}
