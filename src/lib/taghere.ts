// 야화 × 태그히어(TagHere) CRM 웨이팅 연동 레이어 (클라이언트).
//
// 실연동: /api/waiting (Vercel) 프록시를 본인 supabase 토큰과 함께 호출.
//   프록시가 사용자 검증 → TagHere API 호출 → waitings 갱신.
// EXPO_PUBLIC_TAGHERE_MOCK=1 이면 가짜 성공 반환(로컬/디자인 확인용).
import { supabase } from './supabase';

const MOCK = process.env.EXPO_PUBLIC_TAGHERE_MOCK === '1';
import { apiOrigin } from './apiOrigin';
const ORIGIN = apiOrigin();

export type WaitingResult = {
  ok: boolean;
  waitingId?: string;
  position?: number;
  etaMinutes?: number;
  reason?: string;
};

async function callProxy(body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const tok = session?.access_token;
  if (!tok) return { ok: false, reason: '로그인이 필요해요' };
  const r = await fetch(`${ORIGIN}/api/waiting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body),
  });
  try { return await r.json(); } catch { return { ok: false, reason: `요청 실패 (${r.status})` }; }
}

export async function registerWaiting(args: { storeId: string; partySize?: number; phone?: string }): Promise<WaitingResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: '로그인이 필요해요' };
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const position = 2 + Math.floor((Date.now() / 1000) % 4);
    return { ok: true, waitingId: `mock_${Date.now()}`, position, etaMinutes: position * 8 };
  }
  return callProxy({ action: 'register', storeId: args.storeId, partySize: args.partySize ?? 1, phone: args.phone });
}

export async function cancelWaiting(waitingId: string): Promise<WaitingResult> {
  if (MOCK) { await new Promise((r) => setTimeout(r, 300)); return { ok: true, waitingId }; }
  return callProxy({ action: 'cancel', waitingId });
}

// 내 활성 웨이팅 조회 (특정 매장) — DB 직접 read (RLS: 본인만)
export async function getMyActiveWaiting(storeId: string): Promise<{ id: string; status: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('waitings')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .in('status', ['requested', 'waiting', 'called'])
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}
