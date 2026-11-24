// 야화 — 하단 메뉴 알림 점 · 마음함 새 호감 수 (리뉴얼 1120: Home.tsx에서 옮김)
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { previewSelectors, usePreview, getCurrentUserId } from './previewStore';
import { useMyInterests, isInterestFresh, useServerNotifs } from './hooks';
import { letterState, useMyLetters } from './letters';
import { useDeckUnseen } from '../components/affinity/DiscoveryGrid';
import { isCommunityLocalKind, isCommunityServerKind } from '../components/community/notifKinds';

// ── 새 관심 점 — 받은 호감(받은 관심)·보낸 호감(보낸 관심) 탭을 마지막으로 본 이후 새로 생긴 수(시안 mind-update-dot) ──
// 계정별 키 — 같은 기기에서 다른 계정으로 로그인해도 섞이지 않게(예전 공용 키는 처음 한 번만 이어받는다)
const MUTUAL_SEEN_KEY = 'yahwa_mutual_seen_at';
const SENT_SEEN_KEY = 'yahwa_sent_seen_at';
export function useNewInterestBadge(viewing: boolean, dir: 'received' | 'sent' = 'received'): number {
  return useNewInterests(viewing, dir).count;
}
// 새 호감 수 + 그 상대 id들(마음함 카드의 새 점). viewing이면 '봤다'고 기록해 다음부터는 세지 않는다
export function useNewInterests(viewing: boolean, dir: 'received' | 'sent' = 'received'): { count: number; ids: string[] } {
  const baseKey = dir === 'sent' ? SENT_SEEN_KEY : MUTUAL_SEEN_KEY;
  const myUid = getCurrentUserId();
  const storeKey = `${baseKey}:${myUid ?? ''}`;
  const interestsQ = useMyInterests();
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setSeenAt(null);
    AsyncStorage.getItem(storeKey)
      .then((v) => v ?? AsyncStorage.getItem(baseKey))
      .then((v) => { if (alive) setSeenAt(v); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [storeKey, baseKey]);
  const received = (interestsQ.data ?? []).filter(
    (i) => (dir === 'sent' ? i.sender_id : i.receiver_id) === myUid && isInterestFresh(i.created_at) && (!seenAt || i.created_at > seenAt),
  );
  // 인연 알림을 꺼도 앱 안 표시는 남긴다(1014 — 끄면 휴대폰 푸시만 안 간다)
  const count = loaded && myUid ? received.length : 0;
  const latest = received.reduce((m, i) => (i.created_at > m ? i.created_at : m), '');
  useEffect(() => {
    if (!viewing || !loaded || count === 0) return;
    setSeenAt(latest);
    AsyncStorage.setItem(storeKey, latest).catch(() => {});
  }, [viewing, loaded, count, latest]);
  const ids = useMemo(
    () => (count ? received.map((i) => (dir === 'sent' ? i.receiver_id : i.sender_id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, latest, dir],
  );
  return { count, ids };
}

// 하단 메뉴 알림 점 — 인연 홈: 아직 안 본 오늘의 인연 / 마음함: 안 본 받은 호감 / 편지함: 안 읽은 받은 편지 / 커뮤니티: 안 읽은 커뮤니티 알림
export function useNavDots(): { affinity: boolean; heart: boolean; letters: boolean; lounge: boolean } {
  const deckUnseen = useDeckUnseen();
  const newLikes = useNewInterestBadge(false);
  const lettersQ = useMyLetters();
  const newLetters = (lettersQ.data ?? []).some((l) => letterState(l) === 'in_unread');
  const unreadLocal = usePreview(previewSelectors.notifications).some((n) => !n.read && isCommunityLocalKind(n.kind));
  const serverNotifsQ = useServerNotifs({ live: false });
  const unreadServer = (serverNotifsQ.data ?? []).some((n) => !n.read && isCommunityServerKind(n.kind));
  return { affinity: deckUnseen, heart: newLikes > 0, letters: newLetters, lounge: unreadLocal || unreadServer };
}
