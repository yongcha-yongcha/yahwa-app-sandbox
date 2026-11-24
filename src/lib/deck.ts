// 야화 — 오늘의 인연 배치 (프로토타입 v2, 1013)
//
// · 하루 배치는 KST 정오(12:00)에 바뀐다. 정오 전에는 전날 배치를 계속 본다.
// · 12·15·18·21시에 두 명씩 열린다(시안 사이트 1013): 12–14시 2명 · 15–17시 4명 · 18–20시 6명 ·
//   21시부터 다음날 11:59까지 8명 전부. 안내: "12, 15, 18, 21시 두 명씩 총 8명의 인연을 만나요."
// · 8명 고르기(상대 성별·나의 취향·본 사람 뒤로·비회원/가입 첫날 추천 프로필)는 서버가 한다(0183 get_my_deck).
//   한 번 정한 배치는 같은 배치 동안 서버에 고정(0182) — 취향을 바꿔도 다음 정오부터 반영, 기기를 바꿔도 같은 8명.
import type { FriendProfile } from './api';
import { supabase } from './supabase';

export const BATCH_SIZE = 8;

// 서버 시각 보정 — 기기 시계를 바꿔 다음 공개·배치를 미리 열지 못하게, 앱을 켤 때 한 번 서버 응답의 Date 헤더로
// 기기와의 차이를 잰다(1초 단위라 2초 미만 차이는 무시). 실패하면 0(기기 시각 그대로).
let clockOffset = 0;
let clockSync: Promise<void> | null = null;
export function serverNow(): number { return Date.now() + clockOffset; }
export function syncServerClock(): Promise<void> {
  if (clockSync) return clockSync;
  clockSync = (async () => {
    try {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!url) return;
      const t0 = Date.now();
      // 가장 가벼운 공개 응답(인증 서버 상태 확인, 200). 웹은 CORS로 Date 헤더가 안 보여 기기 시각 그대로 쓴다
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' } });
      const t1 = Date.now();
      const server = Date.parse(res.headers.get('date') ?? '');
      if (!Number.isFinite(server)) return;
      const off = server + 500 - (t0 + t1) / 2;   // 헤더는 초 단위 내림 — 0.5초 보탠다
      if (Math.abs(off) >= 2000) clockOffset = off;
    } catch {}
  })();
  return clockSync;
}

function kstNow(now = new Date(serverNow())): Date {
  return new Date(now.getTime() + 9 * 3600_000);  // getUTC*로 읽으면 KST
}
// 정오 기준 배치 날짜 (YYYY-MM-DD)
export function batchKey(now = new Date(serverNow())): string {
  const k = new Date(kstNow(now).getTime() - 12 * 3600_000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
}
// 이 배치가 시작된 시각(KST 정오, epoch ms)
export function batchStartMs(now = new Date(serverNow())): number {
  const k = kstNow(now);
  const noon = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 12) - 9 * 3600_000;
  return k.getUTCHours() >= 12 ? noon : noon - 86_400_000;
}
export function kstHour(now = new Date(serverNow())): number {
  return kstNow(now).getUTCHours();
}
export const SLOT_HOURS = [12, 15, 18, 21];
export const SLOT_TEXT = '12, 15, 18, 21시 두 명씩 총 8명의 인연을 만나요.';
// 지금 열려 있는 인원
export function visibleCount(now = new Date(serverNow())): number {
  const h = kstHour(now);
  if (h < 12) return BATCH_SIZE;           // 정오 전 = 전날 배치가 다 열린 상태
  return 2 * SLOT_HOURS.filter((x) => h >= x).length;
}
// 다음 도착 안내
export function nextArrivalText(now = new Date(serverNow())): string {
  const h = kstHour(now);
  const next = SLOT_HOURS.find((x) => x > h);
  return h >= 12 && next ? `${next}시에 두 명이 더 도착해요` : '내일 낮 12시에 새로운 인연이 도착해요';
}

// 오늘의 인연 — 서버가 고른 배치 8명(slot 0~7) + 이번 배치에 추가로 받은 사람(extra) (0183)
export type DeckRow = FriendProfile & { slot: number | null; extra: 'paid' | 'bonus' | null; extra_at: string | null };
export async function fetchMyDeck(): Promise<DeckRow[]> {
  const { data, error } = await supabase.rpc('get_my_deck' as never);
  if (error) throw error;
  return ((data ?? []) as unknown as DeckRow[]);
}
export async function fetchDeckNextAvailable(): Promise<boolean> {
  const { data, error } = await supabase.rpc('deck_next_available' as never);
  if (error) return false;
  return !!data;
}
