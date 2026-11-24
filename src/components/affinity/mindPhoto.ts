// 야화 — 호감 목록 사진 가림(시안 1020 _r, 대표 결정): 기준 시각에서 7일이 지나면 사진을 가린다.
// 기준 — 받은 호감: 호감을 받은 때 / 보낸 호감: 내가 보낸 때 / 서로 호감: 둘 중 늦은 때.
// '다시 보기'(10리프, 남녀 공통 — 값은 useLeafPricing)로 열면 7일 동안 다시 선명하다. 서버: mind_photo_state() · unlock_mind_photo()(0176).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/previewStore';

const WEEK = 7 * 86_400_000;

type Row = { profile_id: string; received_at: string | null; sent_at: string | null; unlocked_until: string | null };
export type MindMode = 'received' | 'sent' | 'mutual';

export function useMindPhotoState() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ['mind-photo-state', uid],
    enabled: !!uid,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mind_photo_state' as never);
      // 함수가 없는 환경(적용 전)이면 가리지 않는다
      if (error) return new Map<string, Row>();
      return new Map(((data ?? []) as unknown as Row[]).map((r) => [r.profile_id, r]));
    },
  });
}

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);

// 지금 가려야 하는지 — 기준에서 7일이 지났고, 다시 보기 기한이 지났으면 가린다
export function isMindMasked(row: Row | undefined, mode: MindMode, now = Date.now()): boolean {
  if (!row) return false;
  const base = mode === 'received' ? t(row.received_at) : mode === 'sent' ? t(row.sent_at) : Math.max(t(row.received_at), t(row.sent_at));
  if (!base) return false;
  return t(row.unlocked_until) <= now && now - base >= WEEK;
}

// 다시 보기 — 가려진 경우에만 서버가 10리프를 차감하고 7일 연다(이미 열려 있으면 과금 없이 기한만)
export function useUnlockMindPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { data, error } = await supabase.rpc('unlock_mind_photo' as never, { p_profile_id: profileId } as never);
      if (error) throw error;
      return data as unknown as string | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mind-photo-state'] });
      qc.invalidateQueries({ queryKey: ['me'] });   // 리프 잔액
    },
  });
}
