// 야화 — 지인 차단(연락처 해시 기반 상호 노출 방지) + friend_profiles RPC 대체.
// 원본 전화번호는 기기 밖으로 나가지 않는다: 정규화 → SHA-256 해시만 업로드.
// 서버(0030_contact_blocking.sql)의 phone_sha256()과 정규화/해시 규칙이 반드시 일치해야 함.
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getSessionUser } from './supabase';
import type { FriendProfile } from './api';

// ── friend_profiles 뷰 대체 — 양방향 지인 차단이 서버에서 강제되는 RPC ────────
// RPC는 뷰와 달리 univ_name(대학 인증)을 함께 내려준다.
export type FriendProfileRpc = FriendProfile & { univ_name: string | null };

export async function fetchFriendProfilesRpc(gender?: 'M' | 'F'): Promise<FriendProfileRpc[]> {
  const { data, error } = await supabase.rpc(
    'get_friend_profiles' as any,
    gender ? { want_gender: gender } : {},
  );
  if (error) throw error;
  return (data ?? []) as unknown as FriendProfileRpc[];
}

export async function fetchFriendProfileRpc(userId: string): Promise<FriendProfileRpc | null> {
  const { data, error } = await supabase.rpc('get_friend_profiles' as any, { target_user: userId });
  if (error) throw error;
  const rows = (data ?? []) as unknown as FriendProfileRpc[];
  return rows[0] ?? null;
}

// ── 전화번호 정규화 (서버 phone_sha256과 동일 규칙) ──────────────────────────
// 숫자만 남김 → '82' 시작 & 길이 11 이상이면 '82'→'0' → 9자리 미만이면 null(스킵).
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('82') && d.length >= 11) d = '0' + d.slice(2);
  return d.length < 9 ? null : d;
}

async function sha256Hex(s: string): Promise<string> {
  // 기본 출력: 소문자 hex — 서버 encode(digest(...), 'hex')와 동일
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
}

// ── 동의 상태 ────────────────────────────────────────────────────────────────
// granted: users.contact_sync_at 존재(서버 기록) / declined: 로컬 플래그(나중에)
const DECLINED_KEY = 'yahwa.contactBlock.declined';

export type ContactConsent = 'granted' | 'declined' | 'unknown';

export async function getContactBlockConsent(): Promise<ContactConsent> {
  const user = await getSessionUser();
  if (!user) return 'declined'; // 비로그인 — 모달 띄우지 않음
  const { data } = await supabase
    .from('users').select('contact_sync_at' as any).eq('id', user.id).maybeSingle();
  if ((data as any)?.contact_sync_at) return 'granted';
  const declined = await AsyncStorage.getItem(DECLINED_KEY).catch(() => null);
  return declined ? 'declined' : 'unknown';
}

export async function declineContactBlock(): Promise<void> {
  await AsyncStorage.setItem(DECLINED_KEY, '1').catch(() => {});
}

// ── 연락처 읽기 → 해시 → 업로드 ──────────────────────────────────────────────
export type ContactSyncResult =
  | { ok: true; count: number; changed: boolean }
  | { ok: false; reason: 'web' | 'auth' | 'permission' };

// 마지막으로 올린 연락처 묶음의 지문(번호 전체를 정렬해 한 번 해시) — 같으면 번호별 해시·업로드를 건너뛴다
const FP_KEY = (uid: string) => `yahwa.contactBlock.fp:${uid}`;

// skipIfUnchanged: 자동 재동기화용 — 지난번과 연락처가 같으면 아무것도 올리지 않는다(changed=false)
export async function syncContactBlocks(opts?: { skipIfUnchanged?: boolean }): Promise<ContactSyncResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: 'auth' };

  const perm = await Contacts.requestPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'permission' };

  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
  const normalized = new Set<string>();
  for (const c of data) {
    for (const p of c.phoneNumbers ?? []) {
      const n = normalizePhone(p.number ?? '');
      if (n) normalized.add(n);
    }
  }
  const fp = await sha256Hex([...normalized].sort().join(','));
  if (opts?.skipIfUnchanged) {
    const prev = await AsyncStorage.getItem(FP_KEY(user.id)).catch(() => null);
    if (prev === fp) return { ok: true, count: normalized.size, changed: false };
  }
  // 원본 번호는 여기서 폐기 — 서버로는 해시만 전송된다.
  const hashes = await Promise.all([...normalized].map(sha256Hex));

  // upsert(중복 무시)만 수행 — 실패해도 기존 차단이 지워지지 않는 안전한 방향.
  // (연락처에서 지운 사람의 차단 해제는 이번 스코프 밖 — 과차단이 노출보다 안전)
  for (let i = 0; i < hashes.length; i += 500) {
    const chunk = hashes.slice(i, i + 500).map((h) => ({ user_id: user.id, phone_hash: h }));
    const { error } = await supabase
      .from('contact_blocks' as any)
      .upsert(chunk as any, { onConflict: 'user_id,phone_hash', ignoreDuplicates: true });
    if (error) throw error;
  }

  // 동의/업로드 시점 서버 기록 (재진입 시 모달 생략 판단 기준)
  const { error: uErr } = await supabase
    .from('users')
    .update({ contact_sync_at: new Date().toISOString() } as any)
    .eq('id', user.id);
  if (uErr) throw uErr;
  AsyncStorage.setItem(FP_KEY(user.id), fp).catch(() => {});

  return { ok: true, count: hashes.length, changed: true };
}
