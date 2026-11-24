// 야화 — 내 뱃지(리뉴얼 1120 · spec-rest §10 B-8). 딸 수 있는 뱃지 목록, 첫 뱃지로 "대학교 인증".
// 대학교 인증: 학교 이메일 입력 → univ-verify(request) 6자리 코드 발송 → 코드 입력 → confirm → users.univ_name 기록.
// 인증되면 대학명 금색 뱃지(UnivBadge)가 프로필 옆에 함께 노출된다.
// 학력 · 직장 · 소득 인증은 "배지 · 인증" 화면(components/my/BadgeCredentials)에 있다.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../tokens';
import { BreathingDots, Button, Card, Row } from '../ui';
import { GroupTitle, Screen, Sub } from '../components/my/ui';
import { CfInput, CodeCells, ResendRow, UnderlineLink, RESEND_COOLDOWN_SEC } from '../components/my/BadgeCredentials';
import { UnivBadge } from '../components/UnivBadge';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';
import { previewActions } from '../lib/previewStore';
import { pickAndUploadIdPhoto } from '../lib/photoUpload';

// ISO → "YYYY.MM.DD"
function fmtDate(str: string | null): string | null {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// univ-verify Edge Function 호출 — 실패 시 서버가 내려준 한국어 메시지를 추출해 throw.
async function invokeUnivVerify(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('univ-verify', { body });
  if (error) {
    let msg = '요청에 실패했어요. 잠시 후 다시 시도해주세요';
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch {
      // 응답 본문 파싱 실패 — 기본 메시지 사용
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// 준비 중인 뱃지 — 앞으로 딸 수 있는 뱃지들을 미리 보여 준다
const UPCOMING: { key: string; title: string; desc: string }[] = [
  { key: 'realname', title: '실명 인증', desc: '본인 확인으로 신뢰도 UP' },
  { key: 'profile', title: '프로필 완성', desc: '프로필을 100% 채우면 획득' },
  { key: 'firstmatch', title: '첫 매칭', desc: '첫 연결이 성사되면 획득' },
  { key: 'manner', title: '매너 우수', desc: '좋은 매너 평가가 쌓이면 획득' },
];

const body = { fontSize: 14, lineHeight: 22.4, color: colors.textSecondary } as const;
const small = { fontSize: 12, lineHeight: 18, color: colors.mute } as const;
const heading = { fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text } as const;

export function BadgeManage({ onBack }: { onBack?: () => void }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const queryClient = useQueryClient();

  // 인증 상태 — users.univ_name(공개) + 본인 univ_verifications 인증일.
  const statusQuery = useQuery({
    queryKey: ['univBadge', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data: u, error } = await (supabase as any)
        .from('users').select('univ_name').eq('id', uid).maybeSingle();
      if (error) throw error;
      let verifiedAt: string | null = null;
      if (u?.univ_name) {
        const { data: v } = await (supabase as any)
          .from('univ_verifications')
          .select('verified_at').eq('user_id', uid)
          .not('verified_at', 'is', null)
          .order('verified_at', { ascending: false }).limit(1).maybeSingle();
        verifiedAt = v?.verified_at ?? null;
      }
      return { univName: (u?.univ_name as string | null) ?? null, verifiedAt };
    },
  });

  const verified = statusQuery.data?.univName ?? null;
  const verifiedDate = fmtDate(statusQuery.data?.verifiedAt ?? null);

  // 화면: 컬렉션 목록 ↔ 대학교 인증 상세
  const [view, setView] = useState<'list' | 'univ'>('list');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingUnivName, setPendingUnivName] = useState<string | null>(null);
  // 다시 받기 대기 — 보낸 시각 기준으로 계산(1초씩 빼면 앱이 백그라운드에 있는 동안 멈춘다, BadgeCredentials와 같은 방식)
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = Math.max(0, RESEND_COOLDOWN_SEC - Math.floor((now - sentAt) / 1000));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function requestCode() {
    if (!emailValid || busy) return;
    setBusy(true);
    try {
      const res = await invokeUnivVerify({ action: 'request', email: email.trim() });
      setPendingUnivName(res?.univName ?? null);
      setStep('code');
      setCode('');
      const t = Date.now();
      setSentAt(t); setNow(t);
      previewActions.showToast('인증코드를 보냈어요 · 10분 안에 입력해주세요', 2400);
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '발송에 실패했어요', 2600);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    try {
      await invokeUnivVerify({ action: 'confirm', code });
      previewActions.showToast('대학교 인증 완료! 금색 뱃지가 생겼어요', 2600);
      setStep('email'); setEmail(''); setCode('');
      await queryClient.invalidateQueries({ queryKey: ['univBadge', uid] });
      setView('list');
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '인증에 실패했어요', 2600);
    } finally {
      setBusy(false);
    }
  }

  if (view === 'univ') {
    return (
      <Screen title="대학교 인증" onBack={() => setView('list')}>
        <UnivVerify
          verified={verified} verifiedDate={verifiedDate}
          step={step} email={email} setEmail={setEmail} code={code} setCode={setCode}
          busy={busy} emailValid={emailValid} pendingUnivName={pendingUnivName}
          cooldown={cooldown} onRequest={requestCode} onConfirm={confirmCode}
          onResetEmail={() => { setStep('email'); setCode(''); }}
        />
      </Screen>
    );
  }

  return (
    <Screen title="내 뱃지" onBack={onBack}>
      {statusQuery.isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}><BreathingDots /></View>
      ) : (
        <>
          <Sub>인증 뱃지를 모아 프로필 신뢰도를 높여보세요.</Sub>
          {/* 대학교 인증 — 첫 뱃지(실제 동작). 인증되면 금색 뱃지 */}
          <Card style={{ marginTop: 20, overflow: 'hidden' }}>
            <Row
              kind="group" first
              label="대학교 인증"
              sub={verified ? '인증됨' : '학교 이메일로 인증'}
              right={verified ? <UnivBadge name={verified} size="sm" /> : undefined}
              onPress={() => setView('univ')}
            />
          </Card>
          {/* 준비 중 뱃지 — 흐리게 */}
          <GroupTitle>준비 중</GroupTitle>
          <Card style={{ overflow: 'hidden', opacity: 0.45 }}>
            {UPCOMING.map((b, i) => (
              <Row key={b.key} kind="group" first={i === 0} label={b.title} sub={b.desc} value="준비 중" chevron={false} onPress={() => previewActions.showToast('곧 만나요 · 준비 중인 뱃지예요')} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

// 대학교 인증 상세 — 이메일 입력 → 코드 입력. 인증 완료 시 금색 뱃지 표시.
function UnivVerify({
  verified, verifiedDate, step, email, setEmail, code, setCode, busy, emailValid,
  pendingUnivName, cooldown, onRequest, onConfirm, onResetEmail,
}: {
  verified: string | null; verifiedDate: string | null;
  step: 'email' | 'code'; email: string; setEmail: (v: string) => void;
  code: string; setCode: (v: string) => void; busy: boolean; emailValid: boolean;
  pendingUnivName: string | null; cooldown: number;
  onRequest: () => void; onConfirm: () => void; onResetEmail: () => void;
}) {
  if (verified) {
    return (
      <View style={{ paddingTop: 48, alignItems: 'center' }}>
        <UnivBadge name={verified} size="md" />
        <Text style={[heading, { marginTop: 20, textAlign: 'center' }]}>{verified} 인증 완료</Text>
        {verifiedDate && <Text style={[small, { marginTop: 8, fontVariant: ['tabular-nums'] }]}>인증일 {verifiedDate}</Text>}
        <Text style={[body, { marginTop: 8, textAlign: 'center' }]}>금색 대학 뱃지가 오늘의 친구·모임에서 내 프로필과 함께 보여요.</Text>
      </View>
    );
  }
  return (
    <>
      <Sub>학교 이메일(.ac.kr)로 인증하면 프로필에 금색 대학 뱃지가 붙어요.</Sub>
      {step === 'email' ? (
        <>
          <GroupTitle top={20}>학교 이메일</GroupTitle>
          <CfInput
            value={email} onChangeText={setEmail}
            placeholder="예) yahwa@snu.ac.kr"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            accessibilityLabel="학교 이메일"
          />
          <Text style={[small, { marginTop: 8 }]}>입력한 이메일로 6자리 인증코드를 보내드려요.</Text>
          <Button block label="인증코드 받기" disabled={!emailValid} loading={busy} onPress={onRequest} style={{ marginTop: 24 }} />
        </>
      ) : (
        <>
          <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <Text style={[body, { flexShrink: 1, lineHeight: 21 }]}><Text style={{ fontWeight: '600', color: colors.text }}>{email.trim()}</Text> 으로 코드를 보냈어요</Text>
            <UnderlineLink label="이메일 다시 입력" onPress={onResetEmail} />
          </View>
          {pendingUnivName && <Text style={[small, { marginTop: 4 }]}>인증 시 표시될 대학명: {pendingUnivName}</Text>}
          <View style={{ marginTop: 24 }}><CodeCells value={code} onChange={setCode} autoFocus /></View>
          <ResendRow cooldown={cooldown} onPress={onRequest} disabled={busy} />
          <Button block label="인증 완료" disabled={code.length !== 6} loading={busy} onPress={onConfirm} style={{ marginTop: 24 }} />
        </>
      )}

      <GroupTitle top={28}>인증하면 이런 뱃지가 붙어요</GroupTitle>
      <UnivBadge name={pendingUnivName ?? '서울대학교'} size="md" />

      {/* 이메일 인증이 어려운 사용자 — 신분증/학생증 첨부 (관리자 검토) */}
      <IdCardVerify />
    </>
  );
}

// 신분증/학생증 첨부 인증 — 학교 이메일이 없는 사용자용.
// 프라이빗 버킷(id-verifications)에 업로드 → univ_verifications(method='id_card', pending) 기록 → 관리자 검토.
function IdCardVerify() {
  const { session } = useSession();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const [univName, setUnivName] = useState('');
  const [attachPath, setAttachPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 내 id_card 제출 상태 (pending이면 검토 중 표시)
  const pendingQ = useQuery({
    queryKey: ['idCardVerification', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('univ_verifications')
        .select('status, created_at')
        .eq('user_id', uid)
        .eq('method', 'id_card')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { status: string; created_at: string } | null;
    },
  });

  async function attach() {
    if (!uid) { previewActions.showToast('로그인이 필요해요'); return; }
    setBusy(true);
    try {
      const path = await pickAndUploadIdPhoto(uid);
      if (path) setAttachPath(path);
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '업로드 실패', 2200);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!uid || !attachPath || !univName.trim()) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from('univ_verifications').insert({
        user_id: uid,
        email: session?.user.email ?? 'id-card-submission',
        univ_name: univName.trim(),
        method: 'id_card',
        status: 'pending',
        attachment_path: attachPath,
      });
      if (error) throw error;
      setUnivName(''); setAttachPath(null);
      queryClient.invalidateQueries({ queryKey: ['idCardVerification', uid] });
      previewActions.showToast('제출 완료! 검토 후 뱃지가 부여돼요 (영업일 1~2일)', 2600);
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '제출 실패', 2200);
    } finally {
      setBusy(false);
    }
  }

  if (pendingQ.data?.status === 'pending') {
    return (
      <>
        <GroupTitle top={28}>신분증·학생증 인증 검토 중</GroupTitle>
        <Text style={body}>제출한 서류를 확인하고 있어요. 영업일 1~2일 안에 뱃지가 부여돼요.</Text>
      </>
    );
  }

  return (
    <>
      <GroupTitle top={28}>학교 이메일이 없나요?</GroupTitle>
      <Text style={body}>
        신분증 또는 학생증 사진을 첨부하면 검토 후 인증해 드려요.{'\n'}
        사진은 비공개로 안전하게 보관되며 검토에만 사용돼요.
      </Text>
      <CfInput
        value={univName}
        onChangeText={(t) => setUnivName(t.slice(0, 20))}
        placeholder="학교명 (예: 서울대학교)"
        accessibilityLabel="학교명"
        style={{ marginTop: 16 }}
      />
      <Button block variant="gray" label={attachPath ? '첨부 완료 — 다시 선택하기' : '신분증·학생증 사진 첨부'} disabled={busy} onPress={attach} style={{ marginTop: 8 }} />
      <Button block label="제출하기" disabled={!univName.trim() || !attachPath} loading={busy} onPress={submit} style={{ marginTop: 8 }} />
    </>
  );
}
