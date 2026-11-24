// 야화 — 세션 상태 훅. Supabase 세션 구독만.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { previewActions } from './previewStore';
import { queryClient } from './query';

// 하위 호환 — 더 이상 분기하지 않지만 외부에서 import하는 곳이 있어 유지.
export const PREVIEW_MODE = false;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      // 로그아웃/사용자 전환 시 이전 사용자의 React Query 캐시 폐기 — 다음 사용자에게 stale 노출 방지
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    // 세션 확정 전(loading)에는 호출 금지 — 이 훅은 화면마다 새로 마운트되는데,
    // 마운트 직후 session=null인 순간 setActiveUser(null)이 실행되면 로그인 중인
    // 사용자의 메모리 상태가 로그아웃 처리로 초기화된다 (뱃지 관리 진입 시
    // 필수 프로필 게이트에 갇히던 버그의 원인).
    if (loading) return;
    previewActions.setActiveUser(userId);
  }, [userId, loading]);

  return { session, loading };
}
