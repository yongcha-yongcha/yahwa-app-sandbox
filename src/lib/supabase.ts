// 야화 시연판 — Supabase 대신 브라우저 안 목업 백엔드(src/demo)를 쓴다.
// 이 저장소에는 운영 DB 주소도 키도 없다. 여기서 만든 댓글·좋아요·편지는 이 브라우저에만 남는다.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { demoClient } from '../demo/client';
import { installNetworkGuard } from '../demo/networkGuard';

installNetworkGuard();

export const supabase = demoClient as SupabaseClient<Database>;

// 지금 로그인한 사용자 id
export async function getSessionUser(): Promise<{ id: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ? { id: session.user.id } : null;
}
