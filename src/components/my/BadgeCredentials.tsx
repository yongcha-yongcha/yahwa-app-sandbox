// 야화 — 배지 · 인증(리뉴얼 1120 · spec-rest §7.1 · §7.2)
// · CredentialsScreen: 배지 세 칸 + "인증하기" 줄 세 개 + 사실 줄(ⓘ 프로필 표시 예시) + "내 뱃지 모두 보기"
// · CertFormScreen: 1 정보 입력 → 2 메일 확인(코드 6칸) | 서류 올리기 → 끝
//   학력: 학적 상태 → 학교 검색 후 고르기 → 학교 메일 6자리 코드(univ-verify) → 확인 요청
//   직장: 회사 검색 후 고르기 → 회사 메일 6자리 코드(company-verify, 0170) → 확인 요청
//   소득: 소득 구간 → 서류 올리기(submitCredential). 학교·회사 메일이 없으면 같은 서류 길로 낸다.
// 메일 확인은 소속 확인일 뿐 — 학력·직장 모두 운영팀 검토 뒤에만 승인된다(submit_email_credential, 0170).
// 보상 숫자는 표시하지 않는다(§10 A-5).
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius, type as typo } from '../../tokens';
import { supabase } from '../../lib/supabase';
import { fetchMyCredentials, submitCredential, withdrawCredential, type CredentialKind, type MyCredential } from '../../lib/api';
import { previewActions } from '../../lib/previewStore';
import { pickProofFile, type ProofFile } from '../credentials/pickProof';
import { MY_CREDENTIALS_KEY } from '../credentials/useMyVerification';
import { CertBadge, VerificationSeal } from '../affinity/icons';
import { BottomSheet, Button, Card, DockArea, Icon, Row, SheetButtons, usePress } from '../../ui';
import { Fact, GroupTitle, Screen } from './ui';
import { IpIcon, type IpIconName } from './icons';
import { myParams, type MyNav } from './nav';

const KINDS: { kind: CredentialKind; ko: string; icon: IpIconName; sub: string }[] = [
  { kind: 'school', ko: '학력', icon: 'book', sub: '학교 이메일 또는 졸업 증명' },
  { kind: 'company', ko: '직장', icon: 'bag', sub: '회사 이메일' },
  { kind: 'income', ko: '소득', icon: 'coin', sub: '소득 증빙 서류' },
];
const KIND_KO: Record<CredentialKind, string> = { school: '학력', company: '직장', income: '소득' };
const NOUN: Record<CredentialKind, string> = { school: '학교', company: '회사', income: '소득' };
const SCHOOL_STATES = ['졸업', '재학 중', '중퇴'] as const;
type SchoolState = (typeof SCHOOL_STATES)[number];
const INCOMES = ['연 소득 7천만+', '연 소득 1억+', '연 소득 2억+'];
// 소득 기준연도 — 직전 연도(서버 submit_credential과 같은 기준)
const incomeYear = () => new Date(Date.now() + 9 * 3600_000).getUTCFullYear() - 1;
// 메일 인증코드 유효 시간 · 다시 받기 대기(univ-verify · company-verify와 같은 10분 · 60초)
const CODE_TTL = 600;
export const RESEND_COOLDOWN_SEC = 60;
// 학적 상태별 서류 이름(메일이 없을 때)
const SCHOOL_DOC: Record<SchoolState, string> = { '졸업': '졸업증명서', '재학 중': '재학증명서', '중퇴': '제적증명서' };
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : null) as object | null;

// Edge Function 호출 — 실패하면 서버가 준 한국어 메시지로
async function invokeVerify(fn: 'univ-verify' | 'company-verify', body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = '요청에 실패했어요. 잠시 후 다시 시도해주세요.';
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* 본문 없음 — 기본 문구 */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// 한국 시각 'M월 D일'
function kstMonthDay(iso: string | null): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (isNaN(t)) return '';
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ── 인증 입력 부품(내 뱃지 화면도 같이 쓴다) ─────────────────────────────────

// 입력 칸(.cf-in) — 52 · 모서리 14 · 회색 카드 · 16. 쓰는 중엔 흰 바탕 + 안쪽 테두리 1.5 진회색
export function CfInput({ inputRef, right, style, onFocus, onBlur, ...rest }: Omit<TextInputProps, 'style'> & { inputRef?: React.Ref<TextInput>; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ height: 52, borderRadius: radius.cta, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: focus ? colors.surface : colors.bgSoft }, style]}>
      {focus && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.cta, borderWidth: 1.5, borderColor: colors.inverseStrong }} />}
      <TextInput
        ref={inputRef}
        placeholderTextColor={colors.mute}
        {...rest}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        style={[{ flex: 1, minWidth: 0, height: 52, padding: 0, fontSize: 16, color: colors.text }, WEB_NO_OUTLINE]}
      />
      {right}
    </View>
  );
}

// 코드 6칸(.cf-code) — 칸 56 · 사이 8 · 모서리 12 · 회색 카드 · 22/600. 지금 칸은 흰 바탕 + 안쪽 테두리 1.5 진회색.
// 보이지 않는 입력 하나가 위를 덮어 숫자 자판을 띄운다.
export function CodeCells({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ height: 56 }}>
      <View pointerEvents="none" style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const cur = focus && i === Math.min(value.length, 5);
          return (
            <View key={i} style={{ flex: 1, height: 56, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: cur ? colors.surface : colors.bgSoft, borderWidth: cur ? 1.5 : 0, borderColor: colors.inverseStrong }}>
              <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel="인증코드 6자리"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent', fontSize: 16 }, WEB_NO_OUTLINE]}
      />
    </View>
  );
}

// "코드가 안 왔나요? 다시 받기 · 0:59"(.cf-re) — 대기 중엔 흐리게(45%), 지나면 눌린다. right: 줄 오른쪽 끝 요소
export function ResendRow({ cooldown, onPress, disabled, right }: { cooldown: number; onPress: () => void; disabled?: boolean; right?: React.ReactNode }) {
  const off = cooldown > 0 || !!disabled;
  return (
    <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '500', color: colors.mute }}>코드가 안 왔나요?</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: off }} disabled={off} onPress={onPress} hitSlop={6} style={{ marginLeft: 6, minHeight: 32, justifyContent: 'center', opacity: off ? 0.45 : 1 }}>
        <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '600', color: off ? colors.mute : colors.textSecondary, fontVariant: ['tabular-nums'] }}>{cooldown > 0 ? `다시 받기 · ${mmss(cooldown)}` : '다시 받기'}</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

// 밑줄 글자 버튼("변경") — 14/21 글자-연
export function UnderlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={{ marginLeft: 6, minHeight: 32, justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, lineHeight: 21, color: colors.mute, textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}

// 칩(.cf-chips) — 높이 40 · 좌우 16 · 14/500 글자-보조, 고르면 진회색 + 흰 600. 킷 Chip(36 · 좌우 14)과 크기가 달라 따로 둔다
function CfChip({ label, selected, onPress }: { label: string; selected: boolean; onPress?: () => void }) {
  const press = usePress(0.96);
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} disabled={!onPress} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <Animated.View style={[{ height: 40, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: selected ? colors.inverseStrong : colors.bgSoft }, press.scaleStyle]}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: selected ? '600' : '500', color: selected ? colors.inverse : colors.textSecondary }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
function ChipRow({ children, label }: { children: React.ReactNode; label: string }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

// 단계 표시(.cf-steps) — 막대 두 칸(4 · 사이 4) + 아래 8에 이름표 12/16
function Steps({ step, second }: { step: 1 | 2; second: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 28 }}>
      {['정보 입력', second].map((name, i) => {
        const on = i < step;
        return (
          <View key={name} style={{ flex: 1 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: on ? colors.inverseStrong : colors.line }} />
            <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: on ? '600' : '500', color: on ? colors.text : colors.mute }}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

// "✓ 인증됨"(.ip-ok) — 체크 14 + 12/600 진회색
function OkMark({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <IpIcon name="check" size={14} stroke={2.2} color={colors.inverseStrong} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.inverseStrong }}>{label}</Text>
    </View>
  );
}

function InfoIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mute} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

// ── 배지 · 인증 ─────────────────────────────────────────────────────────────

type CertState = 'none' | 'wait' | 'again' | 'ok';
const stateOf = (c?: MyCredential): CertState => (!c ? 'none' : c.status === 'approved' ? 'ok' : c.status === 'pending' ? 'wait' : 'again');
const STATE_KO: Record<CertState, string> = { none: '', wait: '확인 중', again: '다시 제출', ok: '완료' };

// 배지 칸(.ip-badge) — 회색 카드 모서리 16 · 안쪽 16/8 · 높이 115. 흰 원 40 안 아이콘 20 → 이름 14 600 → 상태 12 500.
// 인증됨: 바탕 55% · 진회색 원 32 + 흰 체크 16 · 글자 45%
function BadgeTile({ ko, icon, state, onPress }: { ko: string; icon: IpIconName; state: CertState; onPress: () => void }) {
  const press = usePress(0.97);
  const ok = state === 'ok';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${ko} 인증${STATE_KO[state] ? `, ${STATE_KO[state]}` : ''}`} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={{ flex: 1 }}>
      <Animated.View style={[{ height: 115, borderRadius: radius.card, paddingTop: 16, paddingHorizontal: 8, alignItems: 'center', overflow: 'hidden' }, press.scaleStyle]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.bgSoft, opacity: ok ? 0.55 : 1 }} />
        {ok ? (
          <View style={{ width: 32, height: 32, marginVertical: 4, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inverseStrong }}>
            <IpIcon name="check" size={16} stroke={2.2} color={colors.inverse} />
          </View>
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
            <IpIcon name={icon} />
          </View>
        )}
        <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.text, opacity: ok ? 0.45 : 1 }}>{ko}</Text>
        {!!STATE_KO[state] && <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '500', color: ok ? colors.text : colors.textSecondary, opacity: ok ? 0.45 : 1 }}>{STATE_KO[state]}</Text>}
      </Animated.View>
    </Pressable>
  );
}

// 인증 줄(.ip-row) — 높이 56 · 좌우 16 · 아이콘 20 + 12 + 제목 15/21 500 + 보조 12/17 글자-연 | 값 + 꺾쇠. 줄 사이 1px
function CertRow({ ko, icon, sub, state, first, onPress }: { ko: string; icon: IpIconName; sub: string; state: CertState; first: boolean; onPress: () => void }) {
  const press = usePress(1, 120, 120);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <View style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.muted, opacity: press.p }} />
        {/* 줄 사이 선 — 카드 폭 전체, 높이에 더하지 않는다(시안 .ip-row box-shadow 0 -1px) */}
        {!first && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 1, backgroundColor: colors.line }} />}
        <IpIcon name={icon} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text }}>{ko} 인증</Text>
          <Text style={{ fontSize: 12, lineHeight: 17, color: colors.mute }}>{sub}</Text>
        </View>
        {state === 'ok' ? <OkMark label="인증됨" /> : state !== 'none' ? <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary }}>{STATE_KO[state]}</Text> : null}
        <IpIcon name="chev" size={16} stroke={1.8} color={colors.subtle} />
      </View>
    </Pressable>
  );
}

export function CredentialsScreen({ nav }: { nav: MyNav }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: MY_CREDENTIALS_KEY, queryFn: fetchMyCredentials, staleTime: 30_000 });
  const byKind = useMemo(() => new Map((q.data ?? []).map((c) => [c.kind, c] as const)), [q.data]);
  const [help, setHelp] = useState(false);
  // 인증한 내용 시트 — 닫히는 동안에도 내용이 남게 고른 기록과 열림을 따로 둔다
  const [sel, setSel] = useState<MyCredential | null>(null);
  const [open, setOpen] = useState(false);

  function goForm(kind: CredentialKind) {
    setOpen(false);
    myParams.certKind = kind;
    nav.push('myCertForm');
  }
  // 안 함 · 다시 제출 → 인증 입력 / 인증됨 · 확인 중 → 시트(인증 취소 · 신청 취소)
  function onKind(kind: CredentialKind) {
    const c = byKind.get(kind);
    if (c && c.status !== 'rejected') { setSel(c); setOpen(true); } else goForm(kind);
  }
  async function withdraw(c: MyCredential) {
    setOpen(false);
    try {
      await withdrawCredential(c.kind);
      await qc.invalidateQueries({ queryKey: MY_CREDENTIALS_KEY });
      qc.invalidateQueries({ queryKey: ['friend-profile'] });
      previewActions.showToast(c.status === 'pending' ? '신청을 취소했어요' : '인증 표시를 내렸어요', 2000);
    } catch {
      previewActions.showToast('처리하지 못했어요. 잠시 후 다시 시도해주세요', 2200);
    }
  }

  const pending = sel?.status === 'pending';
  return (
    <Screen title="배지 · 인증" onBack={nav.back}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {KINDS.map((k) => <BadgeTile key={k.kind} ko={k.ko} icon={k.icon} state={stateOf(byKind.get(k.kind))} onPress={() => onKind(k.kind)} />)}
      </View>

      <GroupTitle bottom={12}>인증하기</GroupTitle>
      <Card style={{ overflow: 'hidden' }}>
        {KINDS.map((k, i) => {
          const c = byKind.get(k.kind);
          const state = stateOf(c);
          // 인증됨: 인증한 내용 / 다시 제출: 반려 사유
          const sub = state === 'ok' ? c!.label : state === 'again' ? (c!.reject_reason || '제출한 정보를 다시 확인해주세요.') : k.sub;
          return <CertRow key={k.kind} ko={k.ko} icon={k.icon} sub={sub} state={state} first={i === 0} onPress={() => onKind(k.kind)} />;
        })}
      </Card>

      <View style={{ marginTop: 24, paddingLeft: 4, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingTop: 4 }}>
          <Fact icon={<IpIcon name="shield" />}>승인된 배지만 프로필에 보여요. 제출한 서류는 확인 뒤 지워요.</Fact>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="프로필 배지 표시 예시" onPress={() => setHelp(true)} style={{ width: 44, height: 44, marginTop: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center' }}>
          <InfoIcon />
        </Pressable>
      </View>

      <Card style={{ marginTop: 24, overflow: 'hidden' }}>
        <Row kind="group" first label="내 뱃지 모두 보기" onPress={() => nav.push('myBadges')} />
      </Card>

      {/* 인증한 내용(인증됨) · 신청한 내용(확인 중) */}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        {!!sel && (
          <>
            <Text accessibilityRole="header" style={typo.sheetTitle}>{KIND_KO[sel.kind]} 인증</Text>
            <View style={{ marginTop: 16, marginBottom: 20, padding: 16, borderRadius: radius.card, backgroundColor: colors.bgSoft, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>{pending ? '신청한 내용' : '인증한 내용'}</Text>
              <Text style={{ marginTop: 4, fontSize: 17, lineHeight: 23.8, fontWeight: '600', color: colors.text }}>{sel.label}</Text>
              <View style={{ marginTop: 8 }}>
                {pending
                  ? <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textSecondary }}>{['확인 중', kstMonthDay(sel.created_at)].filter(Boolean).join(' · ')}</Text>
                  : <OkMark label={['인증 완료', kstMonthDay(sel.reviewed_at)].filter(Boolean).join(' · ')} />}
              </View>
            </View>
            <SheetButtons
              cancelLabel={pending ? '신청 취소' : '인증 취소'}
              onCancel={() => withdraw(sel)}
              confirmLabel={pending ? '다시 제출하기' : '다시 인증하기'}
              onConfirm={() => goForm(sel.kind)}
            />
          </>
        )}
      </BottomSheet>

      {/* 프로필 배지 표시 예시 */}
      <BottomSheet open={help} onClose={() => setHelp(false)}>
        <Text accessibilityRole="header" style={typo.sheetTitle}>프로필 배지 표시</Text>
        <Text style={[typo.sheetBody, { marginTop: 4 }]}>확인된 정보를 프로필에 표시해요.</Text>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="프로필 배지 표시: 밤산책 기본 인증, 야화대학교 졸업, 야화전자 재직 중, 연 소득 1억 이상 인증"
          style={{ marginTop: 16, padding: 16, borderRadius: radius.card, backgroundColor: colors.bgSoft }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 17, lineHeight: 23.8, fontWeight: '600', color: colors.text }}>밤산책</Text>
            <CertBadge size={20} hi />
          </View>
          <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
            {['야화대학교 졸업', '야화전자 재직 중', '연 소득 1억+'].map((t) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t}</Text>
                <VerificationSeal size={20} extra />
              </View>
            ))}
          </View>
        </View>
        <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 20, color: colors.mute }}>선택한 인증만 표시돼요.</Text>
      </BottomSheet>
    </Screen>
  );
}

// ── 인증 입력 ───────────────────────────────────────────────────────────────

export function CertFormScreen({ nav }: { nav: MyNav }) {
  const qc = useQueryClient();
  const [kind] = useState<CredentialKind>(() => myParams.certKind);
  const school = kind === 'school';
  const inc = kind === 'income';
  const noun = NOUN[kind];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<'mail' | 'doc'>(inc ? 'doc' : 'mail');
  const [state, setState] = useState<SchoolState | ''>('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [income, setIncome] = useState('');
  const [file, setFile] = useState<ProofFile | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = query.trim().replace(/\s+/g, ' ');
  const mailStep = step === 2 && mode === 'mail';
  // 남은 시간(유효 10분) · 다시 받기 대기(60초) — 보낸 시각 기준으로 계산
  useEffect(() => {
    if (!mailStep) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mailStep]);
  const passed = Math.floor((now - sentAt) / 1000);
  const left = Math.max(0, CODE_TTL - passed);
  const cooldown = Math.max(0, RESEND_COOLDOWN_SEC - passed);

  const named = !!picked && (!school || !!state);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const label = inc ? income : school ? `${picked} ${state}` : `${picked} 재직 중`;
  const docName = school ? SCHOOL_DOC[state || '졸업'] : '재직증명서';
  const toast = (m: string) => previewActions.showToast(m, 2600);

  async function requestCode() {
    if (busy) return;
    if (!picked || !emailOk) { toast(`${noun} 선택과 이메일을 확인해주세요.`); return; }
    if (school && !state) { toast('학적 상태를 선택해주세요.'); return; }
    setBusy(true);
    try {
      if (school) await invokeVerify('univ-verify', { action: 'request', email: email.trim() });
      else await invokeVerify('company-verify', { action: 'request', email: email.trim(), companyName: picked });
      const again = mailStep;
      setMode('mail'); setStep(2); setCode(''); setSentAt(Date.now()); setNow(Date.now());
      previewActions.showToast(again ? '새 코드를 받았어요.' : '인증코드를 보냈어요 · 10분 안에 입력해주세요', 2400);
    } catch (e: any) {
      toast(e?.message ?? '발송하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEmail() {
    if (busy) return;
    if (left === 0) { toast('인증 시간이 지났어요. 코드를 다시 받아주세요.'); return; }
    if (code.length !== 6) { toast('메일로 받은 인증코드 6자리를 입력해주세요.'); return; }
    setBusy(true);
    try {
      await invokeVerify(school ? 'univ-verify' : 'company-verify', { action: 'confirm', code });
      const { error } = await supabase.rpc('submit_email_credential' as never, { p_kind: kind, p_label: label } as never);
      if (error) throw new Error(/email not verified/.test(error.message) ? '메일 확인이 끝나지 않았어요. 코드를 다시 받아주세요.' : '확인 요청을 보내지 못했어요. 잠시 후 다시 시도해주세요.');
      await qc.invalidateQueries({ queryKey: MY_CREDENTIALS_KEY });
      if (school) qc.invalidateQueries({ queryKey: ['univBadge'] });
      setStep(3);
    } catch (e: any) {
      setCode('');
      toast(e?.message ?? '확인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  // 메일이 없을 때 — 서류 올리기로
  function goDoc() {
    if (school && !state) { toast('학적 상태를 선택해주세요.'); return; }
    if (!picked) { toast(`${noun} 이름을 먼저 선택해주세요.`); return; }
    setMode('doc'); setStep(2);
  }

  async function chooseFile() {
    try {
      const f = await pickProofFile();
      if (f) setFile(f);
    } catch (e: any) {
      toast(e?.message ?? '파일을 읽지 못했어요.');
    }
  }

  async function submitDoc() {
    if (busy) return;
    if (!file || (inc && !income)) { toast(inc ? '소득 구간과 자료를 선택해주세요.' : '확인 자료를 선택해주세요.'); return; }
    setBusy(true);
    try {
      await submitCredential(kind, label, file);
      setFile(null);
      await qc.invalidateQueries({ queryKey: MY_CREDENTIALS_KEY });
      setStep(3);
    } catch {
      toast('신청하지 못했어요. 사진 또는 PDF(10MB 이하)인지 확인해주세요.');
    } finally {
      setBusy(false);
    }
  }

  const title = `${KIND_KO[kind]} 인증`;
  const dock = (text: string, onPress: () => void, disabled?: boolean) => (
    <DockArea top={24}><Button size="sheet" block label={text} onPress={onPress} disabled={disabled} loading={busy} /></DockArea>
  );
  const h = { fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text } as const;
  const sub = { fontSize: 14, lineHeight: 21, color: colors.textSecondary } as const;

  // 끝 — 운영팀 확인을 기다린다
  if (step === 3) {
    return (
      <Screen title={title} onBack={nav.back} gnb={false} dock={<DockArea top={24}><Button size="sheet" block label="배지 · 인증으로" onPress={nav.back} /></DockArea>}>
        <View style={{ paddingTop: 72, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSoft }}>
            <IpIcon name="check" size={32} stroke={2.2} color={colors.inverseStrong} />
          </View>
          <Text style={[h, { marginTop: 20, textAlign: 'center' }]}>확인 요청을 보냈어요</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary, textAlign: 'center' }}>운영팀 확인 후 프로필에 표시돼요.</Text>
        </View>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen title={title} onBack={nav.back} gnb={false} dock={inc ? dock('다음', () => setStep(2), !income) : dock('인증코드 받기', requestCode, !named || !emailOk)}>
        <Steps step={1} second={inc ? '서류 올리기' : '메일 확인'} />
        {inc ? (
          <>
            <GroupTitle top={0}>소득 구간</GroupTitle>
            <ChipRow label="소득 구간">
              {INCOMES.map((o) => <CfChip key={o} label={o} selected={income === o} onPress={() => setIncome(o)} />)}
            </ChipRow>
            {/* 기준 연도는 서버가 직전 연도로 정한다 — 고르는 칸이 아니라 알려 주는 칸 */}
            <GroupTitle top={28}>기준 연도</GroupTitle>
            <ChipRow label="기준 연도"><CfChip label={String(incomeYear())} selected /></ChipRow>
          </>
        ) : (
          <>
            {school && (
              <>
                <GroupTitle top={0}>학적 상태</GroupTitle>
                <ChipRow label="학적 상태">
                  {SCHOOL_STATES.map((st) => <CfChip key={st} label={st} selected={state === st} onPress={() => setState(st)} />)}
                </ChipRow>
              </>
            )}
            <GroupTitle top={school ? 28 : 0}>{noun} 이름</GroupTitle>
            <CfInput
              value={query}
              onChangeText={(t) => { setQuery(t); setPicked(''); }}
              placeholder={`${noun} 이름을 검색해주세요`}
              accessibilityLabel={`${noun} 검색`}
              maxLength={30}
              right={picked ? <Icon name="check" size={20} color={colors.valid} /> : undefined}
            />
            {/* 쓰면 아래에 후보 줄이 뜨고, 고르면 칸에 들어간다 */}
            {!picked && !!typed && (
              <Card style={{ marginTop: 8, overflow: 'hidden' }}>
                <Row kind="group" first label={typed} chevron={false} right={<Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary }}>선택</Text>} onPress={() => { setPicked(typed); setQuery(typed); }} />
              </Card>
            )}
            <GroupTitle top={28}>{noun} 이메일</GroupTitle>
            <CfInput
              value={email}
              onChangeText={setEmail}
              placeholder={school ? '학교 이메일 입력' : '회사 이메일 입력'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`${noun} 이메일`}
            />
            <Pressable accessibilityRole="button" onPress={goDoc} style={{ marginTop: 20, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>{`${noun} 메일이 없어요 · ${docName} 올리기`}</Text>
              <IpIcon name="chev" size={14} />
            </Pressable>
          </>
        )}
      </Screen>
    );
  }

  if (mode === 'doc') {
    const bytes = file ? ((file.bytes as ArrayBuffer).byteLength ?? (file.bytes as Blob).size ?? 0) : 0;
    const size = bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
    const examples = inc ? ['근로소득 원천징수영수증', '소득금액증명원', '종합소득세 신고서'] : school ? (docName === '졸업증명서' ? ['졸업증명서', '학위증명서'] : [docName]) : ['재직증명서', '건강보험 자격득실 확인서'];
    return (
      <Screen title={title} onBack={nav.back} gnb={false} dock={dock('확인 요청하기', submitDoc, !file)}>
        <Steps step={2} second="서류 올리기" />
        <Text style={h}>{inc ? '소득 증빙 서류를 올려 주세요' : `${docName}를 올려 주세요`}</Text>
        <Text style={[sub, { marginTop: 8, marginBottom: 24 }]}>{inc ? `${incomeYear()}년 기준 · ${income}` : label}</Text>
        {file ? (
          <View style={{ minHeight: 64, paddingLeft: 16, paddingRight: 8, borderRadius: radius.card, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <IpIcon name="doc" size={22} stroke={1.7} color={colors.text} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '500', color: colors.text }}>{file.name}</Text>
              <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>{size}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setFile(null)} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.mute }}>지우기</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingTop: 28, paddingHorizontal: 20, paddingBottom: 20, borderRadius: radius.card, backgroundColor: colors.bgSoft, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <IpIcon name="doc" size={22} stroke={1.7} color={colors.text} />
            </View>
            <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 19.6, fontWeight: '500', color: colors.textSecondary }}>아직 올린 서류가 없어요</Text>
            {/* 앱은 사진첩 사진, 웹은 사진 · PDF(pickProof) */}
            <Pressable accessibilityRole="button" onPress={chooseFile} style={({ pressed }) => ({ marginTop: 16, alignSelf: 'stretch', height: 44, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.muted : colors.surface })}>
              <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.inverseStrong }}>{Platform.OS === 'web' ? '파일 고르기' : '사진 고르기'}</Text>
            </Pressable>
          </View>
        )}
        <GroupTitle top={28}>이런 서류면 돼요</GroupTitle>
        {examples.map((x) => (
          <View key={x} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 18, alignItems: 'center' }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary }} /></View>
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 26.6, color: colors.textSecondary }}>{x}</Text>
          </View>
        ))}
      </Screen>
    );
  }

  return (
    <Screen title={title} onBack={nav.back} gnb={false} dock={dock('확인 요청하기', confirmEmail, code.length !== 6)}>
      <Steps step={2} second="메일 확인" />
      <Text style={h}>메일로 받은 코드를 적어 주세요</Text>
      <View style={{ marginTop: 8, marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={[sub, { flexShrink: 1 }]}><Text style={{ fontWeight: '600', color: colors.text }}>{email.trim()}</Text>로 보냈어요</Text>
        <UnderlineLink label="변경" onPress={() => setStep(1)} />
      </View>
      <CodeCells value={code} onChange={setCode} autoFocus />
      <ResendRow
        cooldown={cooldown}
        onPress={requestCode}
        disabled={busy}
        right={<Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '500', color: colors.mute, fontVariant: ['tabular-nums'] }}>{left ? `남은 시간 ${mmss(left)}` : '시간 만료'}</Text>}
      />
    </Screen>
  );
}
