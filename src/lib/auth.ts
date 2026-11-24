// 야화 — Auth (애플 + 카카오). Supabase Auth 위에서 동작.
import { Platform, Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// expo-apple-authentication은 iOS native only — web/Android에서는 lazy
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
function loadAppleAuth() {
  if (AppleAuthentication) return AppleAuthentication;
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    AppleAuthentication = require('expo-apple-authentication');
    return AppleAuthentication;
  } catch {
    return null;
  }
}

if (Platform.OS !== 'web') WebBrowser.maybeCompleteAuthSession();

export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function randomNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── 애플 로그인 (iOS only) — nonce로 토큰 replay 방지 ─────────────────────
export async function signInWithApple() {
  const apple = loadAppleAuth();
  if (Platform.OS !== 'ios' || !apple) {
    throw new AuthError('애플 로그인은 iOS에서만 사용 가능해요', 'PLATFORM_UNSUPPORTED');
  }
  const available = await apple.isAvailableAsync();
  if (!available) {
    throw new AuthError('이 기기에서 애플 로그인을 사용할 수 없어요', 'NOT_AVAILABLE');
  }

  // Apple Sign-In nonce 패턴: raw nonce 생성 → SHA256 hash를 Apple에 전달 → Supabase에 raw nonce 전달.
  const rawNonce = randomNonce(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: import('expo-apple-authentication').AppleAuthenticationCredential;
  try {
    credential = await apple.signInAsync({
      requestedScopes: [
        apple.AppleAuthenticationScope.FULL_NAME,
        apple.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      throw new AuthError('로그인을 취소했어요', 'CANCELED');
    }
    throw new AuthError('애플 로그인에 실패했어요', 'APPLE_FAIL');
  }

  if (!credential.identityToken) {
    throw new AuthError('애플 인증 토큰을 받지 못했어요', 'NO_TOKEN');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw new AuthError(error.message, error.code);

  // 첫 가입 시에만 fullName 제공됨. public.users.nickname을 placeholder가 아닐 때 갱신.
  const nickname = [credential.fullName?.familyName, credential.fullName?.givenName]
    .filter(Boolean)
    .join('') || undefined;
  if (nickname && data.user) {
    await supabase.from('users').update({ nickname }).eq('id', data.user.id);
  }
  return data;
}

// ── 카카오 로그인 (Supabase OAuth, PKCE) ───────────────────────────────────
export async function signInWithKakao() {
  // Web: 같은 도메인으로 돌아와 detectSessionInUrl이 자동 처리
  // Native: 앱 스킴(yahwa://)으로 돌아와 ExpoWebBrowser가 캡처
  const redirectTo =
    Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:3003/')
      : AuthSession.makeRedirectUri({ scheme: 'yahwa', path: 'auth/callback' });

  // Web에서는 supabase-js가 직접 location.href 리다이렉트하도록 skipBrowserRedirect: false
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo, skipBrowserRedirect: false },
    });
    if (error) throw new AuthError(error.message, error.code);
    // 리다이렉트 발생, 함수 끝까지 안 옴.
    return null;
  }

  // Native: 인앱 브라우저로 띄우고 콜백 캡처
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new AuthError(error.message, error.code);
  if (!data.url) throw new AuthError('카카오 인증 URL을 받지 못했어요', 'NO_URL');

  // Android: Custom Tab(openAuthSessionAsync)에서 카카오톡 app-to-app 복귀가 깨지면
  // 카카오가 인증 state를 잃고 로그인 페이지를 다시 띄워 무한 루프가 된다.
  // 결제(0e64da4)와 동일하게 시스템 브라우저로 열고, 완료는 yahwa://auth/callback
  // 딥링크 → app/auth/callback.tsx의 코드 교환으로 처리한다(경로 기존 검증됨).
  if (Platform.OS === 'android') {
    await Linking.openURL(data.url);
    return null;  // 세션은 딥링크 콜백에서 확립 — onAuthStateChange가 화면을 전환한다
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // 카카오톡 app-to-app 복귀 시 OS가 yahwa:// 스킴으로 앱을 직접 띄우면서
  // app/auth/callback.tsx가 code를 먼저 교환해버릴 수 있다. code는 1회용이라
  // 여기서 또 교환하면 'PKCE code verifier not found in storage'로 실패한다.
  // → 이미 세션이 만들어졌으면 그대로 성공 처리한다(어느 쪽이 이기든 무방).
  const pre = await supabase.auth.getSession();
  if (pre.data.session) return { session: pre.data.session, user: pre.data.session.user };

  if (result.type !== 'success') {
    throw new AuthError('카카오 로그인을 취소했어요', 'CANCELED');
  }

  const url = new URL(result.url);
  const params = new URLSearchParams();
  if (url.hash) new URLSearchParams(url.hash.slice(1)).forEach((v, k) => params.set(k, v));
  if (url.search) new URLSearchParams(url.search.slice(1)).forEach((v, k) => params.set(k, v));

  const code = params.get('code');
  if (code) {
    const { data: sess, error: sErr } = await supabase.auth.exchangeCodeForSession(code);
    if (sErr) {
      // 콜백 라우트가 그사이 교환을 끝냈을 수 있다 — 세션이 생겼으면 성공
      const { data: after } = await supabase.auth.getSession();
      if (after.session) return { session: after.session, user: after.session.user };
      throw new AuthError(sErr.message, sErr.code);
    }
    return sess;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { data: sess, error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sErr) throw new AuthError(sErr.message, sErr.code);
    return sess;
  }
  throw new AuthError('카카오 인증 응답이 비어 있어요', 'NO_SESSION');
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new AuthError(error.message, error.code);
}

// ── 이메일 로그인 / 간단 회원가입 (심사용 데모 계정 + 일반 가입) ───────────────
export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    if (error.message?.toLowerCase().includes('invalid login')) throw new AuthError('이메일 또는 비밀번호가 올바르지 않아요', error.code);
    throw new AuthError(error.message, error.code);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const e = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({ email: e, password });
  if (error) {
    if (error.message?.toLowerCase().includes('already registered')) throw new AuthError('이미 가입된 이메일이에요. 로그인해 주세요', error.code);
    throw new AuthError(error.message, error.code);
  }
  // 이미 인증까지 끝난 이메일이면 Supabase는 오류 없이 '가짜 성공'을 돌려주고 메일은 보내지 않는다(identities가 빈 배열).
  // 그대로 두면 오지 않는 인증번호를 기다리게 된다 → 로그인으로 안내한다.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AuthError('이미 가입된 이메일이에요. 로그인해 주세요', 'user_already_exists');
  }
  // 이메일 확인이 켜져 있으면 session이 null → 인증코드(OTP) 입력 필요.
  // 꺼져 있으면 session이 바로 발급됨(= 이메일 미인증 가입, 보안상 권장하지 않음).
  return { needsConfirm: !data.session };
}

// 인증 메일 속 숫자 코드로 가입 인증 — 성공하면 세션이 발급돼 바로 로그인된다.
// 템플릿에 따라 signup/email 타입이 갈리므로 signup 실패 시 email로 한 번 더 시도한다.
export async function verifySignupCode(email: string, code: string) {
  const e = email.trim().toLowerCase();
  const token = code.replace(/\D/g, '');
  let { error } = await supabase.auth.verifyOtp({ email: e, token, type: 'signup' });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email: e, token, type: 'email' }));
  if (error) {
    const m = error.message?.toLowerCase() ?? '';
    if (m.includes('expired') || m.includes('invalid')) throw new AuthError('인증번호가 맞지 않거나 만료됐어요. 다시 받아 주세요', error.code);
    throw new AuthError(error.message, error.code);
  }
}

// ── 비밀번호 재설정(인증번호 방식) ──
// 1) 메일로 6자리 인증번호를 받는다(Supabase recovery 메일 — 템플릿에 {{ .Token }}이 있어야 번호가 보인다)
export async function requestPasswordReset(email: string) {
  const e = email.trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(e);
  if (error) {
    if (/rate limit|too many/i.test(error.message ?? '')) throw new AuthError('메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요', error.code);
    throw new AuthError(error.message, error.code);
  }
}
// 2) 번호가 맞으면 세션이 생기고, 바로 새 비밀번호로 바꾼다(세션이 생기면 화면이 넘어가므로 새 비밀번호는 미리 받아 둔다)
export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  const e = email.trim().toLowerCase();
  const token = code.replace(/\D/g, '');
  const { error } = await supabase.auth.verifyOtp({ email: e, token, type: 'recovery' });
  if (error) {
    const m = error.message?.toLowerCase() ?? '';
    if (m.includes('expired') || m.includes('invalid')) throw new AuthError('인증번호가 맞지 않거나 만료됐어요. 다시 받아 주세요', error.code);
    throw new AuthError(error.message, error.code);
  }
  const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
  if (upErr) {
    if (/different from the old|same_password/i.test(upErr.message ?? '')) throw new AuthError('예전과 다른 비밀번호를 입력해 주세요', upErr.code);
    throw new AuthError(upErr.message, upErr.code);
  }
}

// 인증 메일(Confirm email address 링크) 재발송.
export async function resendSignupOtp(email: string) {
  const e = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({ type: 'signup', email: e });
  if (error) throw new AuthError(error.message, error.code);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new AuthError(error.message, error.code);
  return data.session;
}

// 만 19세 이상 검증 — DOB 입력 → 클라이언트 게이트 + 서버 RPC가 최종 검증
function manAge(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age;
}

export function isAdult(year: number, month: number, day: number): boolean {
  return manAge(year, month, day) >= 19;
}

// 가입 가능 연령: 만 19세 ~ 만 39세 (대표 지시 1013 — 만 40세 이상 가입 불가)
export const MAX_SIGNUP_AGE = 40;
export function signupAgeError(year: number, month: number, day: number): string | null {
  const age = manAge(year, month, day);
  if (age < 19) return '만 19세 이상만 가입할 수 있어요';
  if (age >= MAX_SIGNUP_AGE) return `만 ${MAX_SIGNUP_AGE}세 이상은 가입할 수 없어요`;
  return null;
}

// 가입 후 DOB 등록 (서버도 19~39세 검증 + 변경 차단 RPC 사용)
export async function setBirthDate(year: number, month: number, day: number) {
  const ageErr = signupAgeError(year, month, day);
  if (ageErr) {
    throw new AuthError(ageErr, 'AGE_NOT_ALLOWED');
  }
  const { error } = await supabase.rpc('set_birth_date', { p_year: year, p_month: month, p_day: day });
  if (error) throw new AuthError(error.message, error.code);
}

// 회원 탈퇴 (완전 삭제) — 카카오 연결 끊기 + 스토리지 삭제 + auth/DB CASCADE.
// 서버 엣지 함수(delete-account)가 전부 처리. (App Store §5.1.1(v) / 카카오 심사 정책 대응)
export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) {
    // 함수가 내려준 에러 메시지 추출
    let msg = '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요';
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* 기본 메시지 유지 */ }
    throw new AuthError(msg, 'DELETE_FAILED');
  }
  if ((data as any)?.error) throw new AuthError((data as any).error, 'DELETE_FAILED');
  await signOut();
}
