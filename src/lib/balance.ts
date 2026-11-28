// 오늘의 밸런스 — 서버 쪽(시연판에서는 src/demo/rpc/affinity.ts의 목업이 받는다).
// · get_my_balance: 이번 배치(정오~정오)에 내가 고른 답과, 그 답으로 소개받은 사람
// · pick_balance: 답을 고르면 같은 쪽을 고른 한 사람을 오늘의 인연에 더한다(하루 한 번)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getCurrentUserId } from './previewStore';
import type { BalanceSide } from '../components/affinity/balance/content';

export type MyBalance = { choice: BalanceSide; chip: string; profile_id: string | null } | null;

export function useMyBalance(batchKey: string) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ['balance', uid ?? 'guest', batchKey],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<MyBalance> => {
      const { data, error } = await supabase.rpc('get_my_balance' as never);
      if (error) throw error;
      return (data ?? null) as unknown as MyBalance;
    },
  });
}

export function usePickBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (choice: BalanceSide): Promise<MyBalance> => {
      const { data, error } = await supabase.rpc('pick_balance' as never, { p_choice: choice } as never);
      if (error) throw error;
      return data as unknown as MyBalance;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['balance'] });
      qc.invalidateQueries({ queryKey: ['my-deck'] });
    },
  });
}
