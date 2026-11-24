// 야화 — 알림톡 발송 클라이언트 헬퍼 (best-effort, fire-and-forget).
// 실제 발송·수신자 결정·권한 검증은 전부 서버(/api/alimtalk)가 담당한다.
// 솔라피 계정이 아직 설정되지 않았으면 서버가 202(skipped)로 응답 — 호출부는 신경 쓸 필요 없음.
import { supabase } from './supabase';
import { apiOrigin } from './apiOrigin';

export type AlimtalkKind = 'signup' | 'gather_matched' | 'friend_matched';

export async function sendAlimtalk(
  kind: AlimtalkKind,
  payload: { gatheringId?: string; otherUserId?: string } = {},
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const origin = apiOrigin();
    await fetch(`${origin}/api/alimtalk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kind, ...payload }),
    });
  } catch {
    // 알림톡은 부가 채널 — 실패해도 본 플로우에 영향 없음
  }
}
