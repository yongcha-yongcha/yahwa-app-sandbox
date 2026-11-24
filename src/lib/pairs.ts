// 야화 — 관심 페어(호감 · 편지를 주고받은 상대별 요약). 마음함 · 인연 홈 관계 표시가 같이 쓴다(리뉴얼 1120: AffinityDeck.tsx에서 옮김)
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserId } from './previewStore';
import { useMyInterests, isInterestFresh } from './hooks';
import { listMyLetters } from './api';

// ── 관심 페어 — 마지막 활동(관심/편지) 기준 D+1까지 '열린' 상태(서버 규칙과 동일) ──
export type Pair = {
  otherId: string;
  lastActivityAt: string;
  fresh: boolean;
  sentInterest: boolean;
  receivedInterest: boolean;
  sentMsg: boolean;
  receivedMsg: boolean;
};

export function usePairs(): Map<string, Pair> {
  const myUid = getCurrentUserId();
  const interestsQ = useMyInterests();
  // 편지(0146) — 보관 중인 편지만 온다
  const messagesQ = useQuery({ queryKey: ['letters'], queryFn: listMyLetters, enabled: !!myUid, staleTime: 60_000 });
  return useMemo(() => {
    const map = new Map<string, Pair>();
    if (!myUid) return map;
    const get = (other: string, at: string) => {
      let p = map.get(other);
      if (!p) {
        p = { otherId: other, lastActivityAt: at, fresh: false, sentInterest: false, receivedInterest: false, sentMsg: false, receivedMsg: false };
        map.set(other, p);
      }
      if (at > p.lastActivityAt) p.lastActivityAt = at;
      return p;
    };
    for (const i of interestsQ.data ?? []) {
      const mine = i.sender_id === myUid;
      const p = get(mine ? i.receiver_id : i.sender_id, i.created_at);
      if (mine) p.sentInterest = true; else p.receivedInterest = true;
    }
    for (const m of messagesQ.data ?? []) {
      const p = get(m.other_id, m.replied_at ?? m.created_at);
      if (m.direction === 'out') p.sentMsg = true; else p.receivedMsg = true;
    }
    for (const p of map.values()) p.fresh = isInterestFresh(p.lastActivityAt);
    return map;
  }, [interestsQ.data, messagesQ.data, myUid]);
}
