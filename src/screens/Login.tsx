// 야화 — 시작(가입·로그인) · 이메일 · 인증번호(리뉴얼 1120, spec-shell §4.3 · §4.5 · §5.4 b-1~b-3)
// 로그인 수단은 우리 것: 카카오 → Apple(아이폰) → 이메일. '휴대폰 번호로 계속하기'는 문자 인증 서버가 생길 때까지 숨긴다(대표 결정).
// 이메일은 가입 단계와 같은 틀(머리 줄 · 명조 제목 · 입력칸 · 아래 주 버튼), 인증번호는 6칸(다 채우면 버튼 없이 확인).
import React, { useEffect, useState } from 'react';
import { Animated, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, layout, radius, type as typo } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { BackButton, Button, DockArea, OtpInput, OtpSuccess, Rise, T, TextField, TextLink, TopBar, usePress } from '../ui';
import { EnvelopeArt } from '../components/entry/art';
import { signInWithApple, signInWithKakao, signInWithEmail, signUpWithEmail, resendSignupOtp, verifySignupCode, requestPasswordReset, confirmPasswordReset } from '../lib/auth';
import { previewActions } from '../lib/previewStore';
import { useBackOverride } from '../lib/backHandler';
import { setAuthHold } from '../lib/authHold';

const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';
const LOGO_SCRIPT = require('../../assets/renewal/logo-script.png');

// Apple 로그인은 iOS native 전용(모듈이 있을 때만 버튼을 낸다)
let appleModule = false;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-apple-authentication');
    appleModule = true;
  } catch {}
}

// 약관 원문 · 제휴 업체 페이지 — 웹은 새 탭, 앱은 브라우저로 연다
function openWeb(path: string) {
  const url = Platform.OS === 'web' && typeof window !== 'undefined' && (path === '/terms' || path === '/privacy')
    ? `${window.location.origin}${path}`
    : `https://yahwa.vercel.app${path}`;
  if (Platform.OS === 'web') { try { window.open(url, '_blank'); } catch { /* 팝업 차단 — 무시 */ } return; }
  Linking.openURL(url).catch(() => { /* 브라우저 없음 — 무시 */ });
}

// 카카오 로그인 버튼 — 카카오 가이드 고정(노랑 #FEE500 · 검정 85% 글자 · 말풍선 심볼 · "카카오 로그인")
function KakaoButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const press = usePress(0.985);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel="카카오 로그인">
      <Animated.View style={[{ height: 52, borderRadius: radius.field, backgroundColor: colors.kakao, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, press.scaleStyle]}>
        <Svg width={14} height={14} viewBox="61.5 16.5 13 13">
          <Path fill="#000000" d="M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z" />
        </Svg>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: 'rgba(0,0,0,0.85)' }}>{busy ? '연결 중…' : '카카오 로그인'}</Text>
      </Animated.View>
    </Pressable>
  );
}

// 아래 링크(12 #69757E 밑줄) — 약관 · 제휴 업체
function FootLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={{ top: 6, bottom: 6 }} style={{ minHeight: 32, justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.sub, textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}

type View_ = 'start' | 'email' | 'code' | 'reset';

// enterDelay: 내용이 떠오르기 시작하는 시각(웰컴에서 넘어오면 200ms, §3-1 j)
export function Login({ onBack, enterDelay = 100 }: { onBack?: () => void; enterDelay?: number }) {
  const [busy, setBusy] = useState<null | 'apple' | 'kakao' | 'email'>(null);
  const [view, setView] = useState<View_>('start');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<{ field?: 'email' | 'pw'; msg: string } | null>(null);
  // 이메일 인증 대기 — 가입 뒤 메일로 온 인증번호(또는 메일 속 버튼) 확인
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [codeInfo, setCodeInfo] = useState('');
  const [artRoom, setArtRoom] = useState(true);
  // 비밀번호 재설정 — 이메일 + 새 비밀번호를 먼저 받고, 메일로 온 인증번호가 맞으면 바로 바꾼다
  const [purpose, setPurpose] = useState<'signup' | 'reset'>('signup');
  const [newPw, setNewPw] = useState('');
  const [verified, setVerified] = useState(false);   // 가입 인증번호가 맞음 — 완료 모션 중
  useEffect(() => () => setAuthHold(false), []);       // 화면이 사라지면 붙잡기를 놓는다

  function back() {
    if (view === 'code') { setView(purpose === 'reset' ? 'reset' : 'email'); setPendingEmail(null); setCode(''); setCodeErr(''); setCodeInfo(''); return; }
    if (view === 'reset') { setView('email'); setErr(null); return; }
    if (view === 'email') { setView('start'); setErr(null); return; }
    onBack?.();
  }
  // 안드로이드 뒤로가기 — 인증번호 → 이메일 → 시작 → 로그인 창 닫기(앱이 꺼지지 않게)
  useBackOverride(() => {
    if (view !== 'start') { back(); return true; }
    if (onBack) { onBack(); return true; }
    return false;
  });

  async function handle(provider: 'apple' | 'kakao') {
    if (busy) return;
    setBusy(provider);
    setErr(null);
    try {
      if (PREVIEW) {
        previewActions.resetSession();
        return;
      }
      if (provider === 'apple') await signInWithApple();
      else await signInWithKakao();
    } catch (e: any) {
      if (e?.code !== 'CANCELED') setErr({ msg: e?.message || '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail() {
    if (busy) return;
    const e = email.trim();
    if (!e || !e.includes('@')) { setErr({ field: 'email', msg: '올바른 이메일 형식을 입력해 주세요.' }); return; }
    if (pw.length < 6) { setErr({ field: 'pw', msg: '비밀번호는 6자 이상이어야 해요.' }); return; }
    setBusy('email');
    setErr(null);
    try {
      if (mode === 'signup') {
        const { needsConfirm } = await signUpWithEmail(e, pw);
        // 인증 메일 대기 단계로(needsConfirm=false면 세션이 바로 생겨 자동 로그인된다)
        if (needsConfirm) { setPurpose('signup'); setPendingEmail(e); setCode(''); setCodeErr(''); setCodeInfo(''); setView('code'); }
      } else {
        await signInWithEmail(e, pw);
      }
    } catch (ex: any) {
      setErr({ msg: ex?.message || '잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(null);
    }
  }

  // 비밀번호 재설정 — 인증번호 받기
  async function handleResetRequest() {
    if (busy) return;
    const e = email.trim();
    if (!e || !e.includes('@')) { setErr({ field: 'email', msg: '올바른 이메일 형식을 입력해 주세요.' }); return; }
    if (newPw.length < 6) { setErr({ field: 'pw', msg: '새 비밀번호는 6자 이상이어야 해요.' }); return; }
    setBusy('email');
    setErr(null);
    try {
      await requestPasswordReset(e);
      setPurpose('reset'); setPendingEmail(e); setCode(''); setCodeErr(''); setCodeInfo(''); setView('code');
    } catch (ex: any) {
      setErr({ msg: ex?.message || '잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(null);
    }
  }

  // 메일로 온 인증번호 — 맞으면 세션 발급 → useSession이 다음 단계로 넘긴다(재설정이면 그 전에 새 비밀번호로 바꾼다)
  async function handleVerifyCode(digits: string) {
    if (busy || !pendingEmail) return;
    setBusy('email');
    try {
      if (purpose === 'reset') {
        await confirmPasswordReset(pendingEmail, digits, newPw);
        previewActions.showToast('비밀번호를 바꿨어요.');
        return;
      }
      // 세션이 생겨도 완료 모션(약 2.2초)이 끝날 때까지 이 화면을 붙잡는다 — OtpSuccess onFinish에서 놓는다
      setAuthHold(true);
      await verifySignupCode(pendingEmail, digits);
      setVerified(true);
    } catch (ex: any) {
      setAuthHold(false);
      setCodeInfo('');
      setCodeErr(ex?.message || '인증번호가 맞지 않아요. 다시 입력해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  // 메일 속 버튼(링크)으로 인증한 경우 — 로그인 재시도로 확인
  async function handleConfirmDone() {
    if (busy || !pendingEmail) return;
    setBusy('email');
    try {
      await signInWithEmail(pendingEmail, pw);
    } catch (ex: any) {
      const msg = String(ex?.message ?? '').toLowerCase();
      setCodeInfo('');
      setCodeErr(msg.includes('not confirmed') ? '아직 인증되지 않았어요. 메일 속 버튼을 눌러 주세요.' : ex?.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    if (busy || !pendingEmail) return;
    setBusy('email');
    try {
      if (purpose === 'reset') await requestPasswordReset(pendingEmail);
      else await resendSignupOtp(pendingEmail);
      setCode('');
      setCodeErr('');
      setCodeInfo('인증번호를 다시 보냈어요.');
    } catch (ex: any) {
      setCodeInfo('');
      setCodeErr(ex?.message || '다시 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  // ── 인증번호 6칸(§4.5) — 주 버튼 없음, 6자리를 채우면 240ms 뒤 확인 ────────────────
  if (view === 'code' && pendingEmail) {
    return (
      <KeyboardAware style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={back} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 57, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Rise index={0} trigger="code"><T v="stepTitle">인증번호 6자리를{'\n'}입력해 주세요.</T></Rise>
          <Rise index={1} trigger="code"><T v="intro" style={{ marginTop: 15 }}>{pendingEmail}로 보냈어요.{'\n'}메일이 안 보이면 스팸함도 확인해 주세요.</T></Rise>
          <Rise index={2} trigger="code" style={{ marginTop: 30 }}>
            {verified ? (
              <OtpSuccess code={code} onFinish={() => setAuthHold(false)} />
            ) : (
              <OtpInput
                value={code}
                onChange={(v) => { setCode(codeErr ? v.slice(-1) : v); setCodeErr(''); }}
                onComplete={handleVerifyCode}
                error={!!codeErr}
                disabled={!!busy}
                autoFocus
              />
            )}
          </Rise>
          <Rise index={3} trigger="code">
            {/* 완료 모션 중에는 다시 받기 · 메일 링크를 숨긴다 */}
            <View pointerEvents={verified ? 'none' : 'auto'} style={verified ? { opacity: 0 } : undefined}>
            <View style={{ marginTop: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text accessibilityLiveRegion="polite" style={[codeErr ? typo.error : typo.help, { flex: 1 }]}>{codeErr || codeInfo}</Text>
              <Button label="다시 받기" variant="text" size="M" disabled={!!busy} onPress={handleResend} style={{ marginRight: -12 }} />
            </View>
            {/* 메일 속 버튼(링크)으로 인증한 경우 — 기존 경로 유지(가입만) */}
            {purpose === 'signup' && <TextLink label="메일 속 버튼으로 인증했어요" onPress={handleConfirmDone} style={{ alignSelf: 'flex-start' }} />}
            </View>
          </Rise>
        </ScrollView>
      </KeyboardAware>
    );
  }

  // ── 비밀번호 재설정 — 이메일 로그인과 같은 틀 ──
  if (view === 'reset') {
    return (
      <KeyboardAware style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={back} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 57, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Rise index={0} trigger="reset"><T v="stepTitle">{'비밀번호를\n다시 정해요.'}</T></Rise>
          <Rise index={1} trigger="reset"><T v="intro" style={{ marginTop: 15 }}>{'가입한 이메일로 인증번호를 보내 드려요.\n번호를 입력하면 새 비밀번호로 바뀌어요.'}</T></Rise>
          <Rise index={2} trigger="reset" style={{ marginTop: 30 }}>
            <TextField
              label="이메일"
              value={email}
              onChangeText={(v) => { setEmail(v); setErr(null); }}
              placeholder="example@email.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              clearable
              error={err?.field === 'email' ? err.msg : false}
            />
          </Rise>
          <Rise index={3} trigger="reset" style={{ marginTop: 22 }}>
            <TextField
              label="새 비밀번호"
              value={newPw}
              onChangeText={(v) => { setNewPw(v); setErr(null); }}
              placeholder="6자 이상"
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleResetRequest}
              error={err?.field === 'pw' ? err.msg : err && !err.field ? err.msg : false}
            />
          </Rise>
        </ScrollView>
        <DockArea>
          <Button label="인증번호 받기" size="dock" loading={busy === 'email'} onPress={handleResetRequest} />
        </DockArea>
      </KeyboardAware>
    );
  }

  // ── 이메일 로그인 · 가입(§5.4 b-1) ────────────────────────────────────────────
  if (view === 'email') {
    const signup = mode === 'signup';
    return (
      <KeyboardAware style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={back} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 57, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Rise index={0} trigger={mode}><T v="stepTitle">{signup ? '이메일로\n가입해요.' : '이메일로\n시작해요.'}</T></Rise>
          <Rise index={1} trigger={mode}>
            <T v="intro" style={{ marginTop: 15 }}>
              {signup ? '입력한 이메일로 인증번호를 보내 드려요.\n만 19세~45세만 가입할 수 있어요.' : '가입할 때 쓴 이메일과 비밀번호를\n입력해 주세요.'}
            </T>
          </Rise>
          <Rise index={2} trigger={mode} style={{ marginTop: 30 }}>
            <TextField
              label="이메일"
              value={email}
              onChangeText={(v) => { setEmail(v); setErr(null); }}
              placeholder="example@email.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              clearable
              error={err?.field === 'email' ? err.msg : false}
            />
          </Rise>
          <Rise index={3} trigger={mode} style={{ marginTop: 22 }}>
            <TextField
              label="비밀번호"
              value={pw}
              onChangeText={(v) => { setPw(v); setErr(null); }}
              placeholder="6자 이상"
              secureTextEntry
              textContentType={signup ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={handleEmail}
              error={err?.field === 'pw' ? err.msg : err && !err.field ? err.msg : false}
            />
          </Rise>
          {/* 비밀번호 찾기 — 비밀번호 칸 바로 오른쪽 아래(시안 email-login-links A안, 11-21) */}
          {!signup && (
            <Rise index={4} trigger={mode} style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => { setErr(null); setNewPw(''); setView('reset'); }} accessibilityRole="link" hitSlop={4} style={{ minHeight: 44, justifyContent: 'center' }}>
                {({ pressed }) => <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: pressed ? colors.text : colors.sub }}>비밀번호를 잊었어요</Text>}
              </Pressable>
            </Rise>
          )}
        </ScrollView>
        <DockArea>
          {/* 로그인 ↔ 가입 바꾸기 — 주 버튼 바로 위 가운데, 뒤쪽만 강조 파랑 */}
          <Pressable onPress={() => { setMode(signup ? 'login' : 'signup'); setErr(null); }} accessibilityRole="link" style={{ minHeight: 44, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
            {({ pressed }) => (
              <Text style={{ fontSize: 13, lineHeight: 18, color: colors.sub, opacity: pressed ? 0.6 : 1 }}>
                {signup ? '이미 가입했나요? ' : '처음이세요? '}
                <Text style={{ fontWeight: '600', color: colors.accentStrong }}>{signup ? '로그인' : '이메일로 가입하기'}</Text>
              </Text>
            )}
          </Pressable>
          <Button label={signup ? '인증번호 받기' : '로그인'} size="dock" loading={busy === 'email'} onPress={handleEmail} />
        </DockArea>
      </KeyboardAware>
    );
  }

  // ── 시작(§4.3) — 위 묶음(로고 · 제목 · 안내) / 가운데 손그림(자리가 모자라면 숨김) / 아래 묶음(버튼 · 링크) ──
  const appleOn = Platform.OS === 'ios' && appleModule;
  // 내용이 하나씩 떠오른다(50ms 간격) — 순번은 화면 위에서부터
  const rise = (index: number) => ({ index, base: enterDelay, trigger: 'start' });
  const n = appleOn ? 1 : 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ marginTop: layout.topPad, height: layout.headerH, paddingHorizontal: layout.gutter, justifyContent: 'center' }}>
        {!!onBack && <BackButton onPress={onBack} />}
      </View>
      <View style={{ flex: 1, paddingHorizontal: layout.gutter }}>
        <Rise {...rise(0)}><Image source={LOGO_SCRIPT} accessibilityLabel="야화" resizeMode="contain" style={{ width: 105, height: 60.7, marginTop: 14 }} /></Rise>
        <Rise {...rise(1)}><T v="stepTitle" style={{ marginTop: 20 }}>우리의 이야기를{'\n'}시작해요.</T></Rise>
        <Rise {...rise(2)}><T v="intro" style={{ marginTop: 14 }}>나의 일상이 궁금한 한 사람.{'\n'}그 만남의 첫걸음을 함께해요.</T></Rise>
        <View onLayout={(e) => setArtRoom(e.nativeEvent.layout.height >= 126)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {artRoom && <Rise {...rise(3)}><EnvelopeArt /></Rise>}
        </View>
        {!!err && <Text accessibilityRole="alert" style={[typo.error, { textAlign: 'center', marginBottom: 10 }]}>{err.msg}</Text>}
        <View style={{ gap: 10 }} pointerEvents={busy ? 'none' : 'auto'}>
          <Rise {...rise(4)}><KakaoButton busy={busy === 'kakao'} onPress={() => handle('kakao')} /></Rise>
          {appleOn && (
            <Rise {...rise(5)}>
              {/* 11-23 B안 — iOS 기본 버튼(검정 선 · 큰 시스템 글자) 대신 이메일 버튼과 같은 틀로 그린다.
                  Apple 가이드: 흰 바탕 + 검정 로고 · 글자, 문구 'Apple로 계속하기'. 로고는 시스템 글꼴의 Apple 로고 글자() */}
              <Button
                label="Apple로 계속하기"
                variant="tertiary"
                block
                leftIcon={<Text style={{ fontSize: 17, lineHeight: 21, color: '#000000' }}>{'\uF8FF'}</Text>}
                textStyle={{ color: '#000000' }}
                onPress={() => handle('apple')}
              />
            </Rise>
          )}
          <Rise {...rise(5 + n)}><Button label="이메일로 계속하기" variant="tertiary" block onPress={() => { setErr(null); setView('email'); }} /></Rise>
        </View>
        <Rise {...rise(6 + n)} style={{ marginTop: 8, marginBottom: 20, alignItems: 'center' }}>
          <View style={styles.links}>
            <FootLink label="이용약관" onPress={() => openWeb('/terms')} />
            <FootLink label="개인정보처리방침" onPress={() => openWeb('/privacy')} />
          </View>
          {/* 제휴 업체 진입 — 고객 동선을 해치지 않게 최소한으로 (0103) */}
          <View style={styles.links}>
            <FootLink label="제휴 업체 신청" onPress={() => openWeb('/partner')} />
            <FootLink label="제휴 업체 관리" onPress={() => openWeb('/owner')} />
          </View>
        </Rise>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
});
