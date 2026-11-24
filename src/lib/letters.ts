// 야화 — 편지·초대장 화면용 훅 (프로토타입 v2, 0146).
// 테이블 직접 접근 없이 api.ts의 RPC만 쓴다. 비용·검증·보관 기간·연락처 가림은 서버가 최종 강제한다.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import {
  listMyLetters, sendLetter, readLetter, replyLetter, declineLetter, upgradeLetter, getLetterMarks,
  type LetterRow, type LetterMark,
} from './api';
import { previewActions, getCurrentUserId } from './previewStore';

// 편지 한 통의 화면 상태 — 서로 답장(연결)했으면 보낸/받은 방향과 관계없이 connected
export type LetterState = 'connected' | 'out_unread' | 'out_read' | 'in_unread' | 'in_read';
export function letterState(l: LetterRow): LetterState {
  if (l.replied_at) return 'connected';
  if (l.direction === 'out') return l.read_at ? 'out_read' : 'out_unread';
  return l.read_at ? 'in_read' : 'in_unread';
}

// 편지함 정렬(시안) — 연결 전 받은 초대장이 맨 위, 나머지는 편지를 보내고 받은 시각 최신순
export function sortLetters(list: LetterRow[]): LetterRow[] {
  const pinned = (l: LetterRow) => (l.direction === 'in' && l.kind === 'invite' && !l.replied_at ? 1 : 0);
  const at = (l: LetterRow) => new Date(l.created_at).getTime();
  return [...list].sort((a, b) => pinned(b) - pinned(a) || at(b) - at(a));
}

export function useMyLetters() {
  return useQuery<LetterRow[]>({
    queryKey: ['letters'],
    queryFn: async () => {
      // 로그아웃 상태에선 RPC 권한이 없어 빈 목록으로 둔다
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      return listMyLetters();
    },
    // 루트가 60초마다 받으므로(아래) 화면이 붙을 때마다 다시 받지 않는다 — 보낸·읽은 편지는 mutation·푸시가 바로 갱신
    staleTime: 60_000,
    refetchInterval: 60_000,  // 앱을 켜 둔 동안 새 편지 도착 팝업을 띄울 수 있게
  });
}

export function useSendLetterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendLetter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letters'] });
      qc.invalidateQueries({ queryKey: ['me'] });         // 리프 차감 반영
      // 서버가 '보낸 호감'도 함께 남긴다 — 덱·호감 탭이 언마운트돼 있어도 다시 받아 하트가 채워지게
      qc.invalidateQueries({ queryKey: ['interests'], refetchType: 'all' });
    },
  });
}

// 편지 '마음이 간 곳'(0190) — 서버에 기능이 있는지. 0190이 적용되기 전이면(함수 없음) 고르기 버튼을 숨긴다
export function useLetterMarksSupported(): boolean {
  const q = useQuery({
    queryKey: ['letter-marks-supported', getCurrentUserId() ?? 'guest'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      try { await getLetterMarks([]); return true; } catch (e: any) {
        // 서버에 함수가 없을 때(0190 적용 전)만 꺼 둔다 — 잠깐 끊긴 네트워크 같은 다른 실패는 다시 시도
        const missing = e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function|does not exist/i.test(String(e?.message ?? ''));
        if (missing) return false;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: 3,
  });
  return q.data === true;
}
// 편지 한 통에 붙은 곳(없으면 빈 배열)
export function useLetterMarks(letterId: string | null | undefined, enabled = true) {
  return useQuery<LetterMark[]>({
    queryKey: ['letter-marks', letterId],
    queryFn: async () => (letterId ? (await getLetterMarks([letterId]))[letterId] ?? [] : []),
    enabled: !!letterId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useReadLetterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: readLetter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['letters'] }),
  });
}

export function useReplyLetterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: replyLetter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letters'] });
      qc.invalidateQueries({ queryKey: ['me'] });         // 답장 6리프(초대장은 0) 반영
      qc.invalidateQueries({ queryKey: ['interests'], refetchType: 'all' });
    },
  });
}

export function useDeclineLetterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineLetter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['letters'] }),
  });
}

export function useUpgradeLetterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upgradeLetter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letters'] });
      qc.invalidateQueries({ queryKey: ['me'] });         // 초대장 전환 차액 반영
    },
  });
}

// 편지 RPC 오류 안내 — 잔액 부족(53100)은 onShort(시안 '리프가 조금 부족해요' 안내),
// 서버가 준 한국어 메시지(예: "이미 보낸 편지가 있어요.")는 그대로 토스트, 그 밖의 오류는 fallback 문구.
export function showLetterError(e: any, fallback: string, onShort?: () => void) {
  const msg = String(e?.message ?? '');
  if (onShort && (e?.code === '53100' || msg.includes('insufficient'))) {
    onShort();
    return;
  }
  previewActions.showToast(/[가-힣]/.test(msg) ? msg : fallback, 2400);
}
