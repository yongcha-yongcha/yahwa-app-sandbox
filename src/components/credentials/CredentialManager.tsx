// MY > 뱃지 관리 > 학력·직장·소득 인증 — 시안 사이트 C 컴포넌트(app_code.js 144–228)와 같은 모양.
// 학력·직장·소득 중 하나를 고르고 '인증할 내용' + '확인 자료'를 내면 운영팀 검토 대기로 올라간다.
// 승인된 내용만 프로필에 공개되고, 확인 자료는 검토가 끝나면 지운다(0157).
// 시안과 다른 점: 시안은 체험용(전송 없음)이라 문구가 다르고, 여기선 실제로 올리고 신청한다.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, getThemeMode } from '../../tokens';
import { previewActions } from '../../lib/previewStore';
import { fetchMyCredentials, submitCredential, withdrawCredential, type CredentialKind, type MyCredential } from '../../lib/api';
import { pickProofFile, type ProofFile } from './pickProof';
import { MY_CREDENTIALS_KEY } from './useMyVerification';
import { LS, pressFx, EditorPicker, PickerSearch, PickerOption, PickerTextButton, ReviewModal, ModalText, ModalRow, ModalClose } from './reviewUi';

const KINDS: CredentialKind[] = ['school', 'company', 'income'];
const KIND_KO: Record<CredentialKind, string> = { school: '학력', company: '직장', income: '소득' };
// 검색 목록 — 시안의 학교·회사 목록. 목록에 없으면 검색어로 직접 고를 수 있다.
const SCHOOLS = ['서울대학교', '연세대학교', '고려대학교', '성균관대학교', '한양대학교', '중앙대학교', '경희대학교', '한국외국어대학교', '건국대학교', '동국대학교', '홍익대학교', '이화여자대학교', '숙명여자대학교', '아주대학교', '경기대학교', '가천대학교', '부산대학교', '경북대학교', '충남대학교', '전남대학교', 'KAIST', 'POSTECH'];
const COMPANIES = ['삼성전자', '현대자동차', 'LG전자', 'SK하이닉스', '네이버', '카카오', '쿠팡', '배달의민족', '토스', '야화컴퍼니'];
const INCOMES = ['연 소득 7천만+', '연 소득 1억+', '연 소득 2억+'];
const SCHOOL_STATES = ['졸업', '재학 중'];
const QUERY_KEY = MY_CREDENTIALS_KEY;
// 고른 종류 버튼 — 시안 --verification-extra-bg/ink(선택 인증 연보라). 다크는 같은 계열을 어둡게.
const extraColors = () => (getThemeMode() === 'dark' ? { bg: '#3d3448', ink: '#c9b6dc' } : { bg: '#e1daf0', ink: '#695879' });

const statusText = (s: MyCredential['status']) => (s === 'approved' ? '인증 완료' : s === 'pending' ? '검토 대기' : '승인 안 됨');
// 소득 기준연도 — 직전 연도(서버 submit_credential과 같은 기준)
const incomeYear = () => new Date(Date.now() + 9 * 3600_000).getUTCFullYear() - 1;

function errMessage(e: any): string {
  const m = String(e?.message ?? '');
  if (/invalid label/.test(m)) return '인증할 내용을 다시 골라주세요.';
  if (/not authenticated|로그인/.test(m)) return '로그인 후 신청할 수 있어요.';
  if (/mime|size|exceeded|too large|Payload/i.test(m)) return '사진 또는 PDF(10MB 이하)만 올릴 수 있어요.';
  return '신청하지 못했어요. 잠시 후 다시 시도해주세요.';
}

export function CredentialManager({ style }: { style?: any }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: fetchMyCredentials, staleTime: 30_000 });
  const records = useMemo(() => [...(q.data ?? [])].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)), [q.data]);
  const [kind, setKind] = useState<CredentialKind>('school');
  const [value, setValue] = useState('');
  const [file, setFile] = useState<ProofFile | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [detail, setDetail] = useState<MyCredential | null>(null);
  const extra = extraColors();

  function chooseKind(k: CredentialKind) {
    setKind(k); setValue(''); setFile(null); setErr('');
  }
  async function chooseFile() {
    try {
      const f = await pickProofFile();
      if (f) { setFile(f); setErr(''); }
    } catch (e: any) {
      setErr(e?.message ?? '파일을 읽지 못했어요.');
    }
  }
  async function submit() {
    if (busy) return;
    if (!value || !file) { setErr('항목과 확인 자료를 모두 선택해주세요.'); return; }
    setBusy(true); setErr('');
    try {
      await submitCredential(kind, value, file);
      setFile(null);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      previewActions.showToast('검토를 신청했어요. 승인되면 알림으로 알려드려요', 2400);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw(c: MyCredential) {
    setDetail(null);
    try {
      await withdrawCredential(c.kind);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['friend-profile'] });
      previewActions.showToast(c.status === 'pending' ? '신청을 취소했어요' : '인증 표시를 내렸어요', 2000);
    } catch {
      previewActions.showToast('처리하지 못했어요. 잠시 후 다시 시도해주세요', 2200);
    }
  }

  const small = { fontSize: 12, lineHeight: 19.8, color: colors.sub, letterSpacing: LS } as const;
  const label = { fontSize: 12, lineHeight: 19.8, color: colors.text, letterSpacing: LS } as const;
  const submitTop = (err ? 12 : file ? 0 : 12) + 12;

  return (
    <View style={[{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 20 }, style]}>
      <Text accessibilityRole="header" style={{ fontSize: 17, lineHeight: 28.05, fontWeight: '500', color: colors.text, letterSpacing: LS }}>인증 관리</Text>
      <Text style={small}>선택</Text>
      <Text style={{ fontSize: 12, lineHeight: 19.2, color: colors.sub, letterSpacing: LS, marginTop: 12 }}>인증이 승인된 내용만 프로필에 표시돼요.</Text>

      {/* 신청·인증 기록 — 누르면 취소·내리기 */}
      {records.map((c, i) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={`${c.label} ${statusText(c.status)}`}
          onPress={() => setDetail(c)}
          style={(s) => [{ marginTop: i ? 0 : 12, paddingVertical: 8 }, pressFx(s)]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flexShrink: 1, fontSize: 13, lineHeight: 21.45, color: colors.text, letterSpacing: LS }}>{c.label}</Text>
            <Text style={[small, c.status === 'rejected' && { color: colors.danger }]}>{statusText(c.status)}</Text>
          </View>
          {c.status === 'rejected' && !!c.reject_reason && <Text style={small}>{c.reject_reason}</Text>}
        </Pressable>
      ))}

      {/* 학력 · 직장 · 소득 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: records.length ? 0 : 12 }}>
        {KINDS.map((k) => {
          const on = kind === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => chooseKind(k)}
              style={(s) => [{ minHeight: 44, paddingHorizontal: 14, paddingTop: 2, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? extra.bg : colors.bgSoft }, pressFx(s)]}
            >
              <Text style={{ fontSize: 13, lineHeight: 21.45, color: on ? extra.ink : colors.text, letterSpacing: LS }}>{KIND_KO[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 인증할 내용 */}
      <Text style={[label, { marginTop: 12 }]}>인증할 내용</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="인증할 내용"
        accessibilityValue={{ text: value || '선택해주세요' }}
        onPress={() => setPicking(true)}
        style={{ marginTop: 8, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, paddingLeft: 12, paddingRight: 2, paddingTop: 2, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, color: colors.text }}>{value || '선택해주세요'}</Text>
        {/* 브라우저 기본 선택 상자 화살표(굵은 ⌄) */}
        <Svg width={9} height={6} viewBox="0 0 9 6" style={{ marginTop: -2 }}><Path d="M1.2 1.2 4.5 4.6l3.3-3.4" fill="none" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      </Pressable>
      {kind === 'income' && <Text style={[small, { marginTop: 12 }]}>연 소득 기준연도: {incomeYear()}년</Text>}

      {/* 확인 자료 — 브라우저 파일 선택 모양 */}
      <Text style={[label, { marginTop: 12 }]}>확인 자료</Text>
      <View style={{ marginTop: 8, height: 23.1, flexDirection: 'row', alignItems: 'center' }}>
        <FilePickButton onPress={chooseFile} />
        <Text numberOfLines={1} style={{ flexShrink: 1, marginLeft: 4, fontSize: 14, color: colors.text }}>{file ? file.name : '선택된 파일 없음'}</Text>
      </View>
      {!!file && <Text numberOfLines={1} style={[small, { marginTop: 12 }]}>{file.name}</Text>}
      {!!err && <Text accessibilityRole="alert" style={{ fontSize: 12, lineHeight: 19.2, color: colors.sub, letterSpacing: LS, marginTop: 12 }}>{err}</Text>}

      <Pressable
        accessibilityRole="button"
        onPress={submit}
        disabled={busy}
        style={(s) => [{ alignSelf: 'flex-start', marginTop: submitTop, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', opacity: busy ? 0.6 : 1 }, pressFx(s)]}
      >
        <Text style={{ fontSize: 16, lineHeight: 26.4, color: colors.text, letterSpacing: LS }}>{busy ? '신청하는 중…' : '검토 신청하기'}</Text>
      </Pressable>
      <Text style={[small, { marginTop: 12 }]}>제출한 자료는 운영팀만 보고, 검토가 끝나면 바로 삭제돼요. 선택·첨부만으로 인증 체크가 생기지 않아요.</Text>

      {picking && (
        <CredentialValuePicker
          kind={kind}
          current={value}
          onClose={() => setPicking(false)}
          onPick={(v) => { setValue(v); setErr(''); setPicking(false); }}
        />
      )}

      {detail && (
        <ReviewModal title={`${KIND_KO[detail.kind]} 인증`} onClose={() => setDetail(null)}>
          <ModalText>{detail.label}</ModalText>
          <ModalText first={false}>
            {detail.status === 'approved'
              ? '프로필에 인증 표시가 보이고 있어요. 내리면 다시 신청해야 표시돼요.'
              : detail.status === 'pending'
                ? '운영팀이 확인 자료를 검토하고 있어요. 결과는 알림으로 알려드려요.'
                : `승인되지 않았어요.${detail.reject_reason ? ` ${detail.reject_reason}` : ''} 다시 신청하면 새로 검토해요.`}
          </ModalText>
          <View style={{ height: 10 }} />
          {detail.status !== 'rejected' && (
            <ModalRow label={detail.status === 'pending' ? '신청 취소' : '인증 내리기'} onPress={() => withdraw(detail)} />
          )}
          <ModalClose onPress={() => setDetail(null)} />
        </ReviewModal>
      )}
    </View>
  );
}

// 브라우저 기본 '파일 선택' 버튼 모양(회색 바탕 · 진회색 테두리)
function FilePickButton({ onPress }: { onPress: () => void }) {
  const dark = getThemeMode() === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="확인 자료 선택"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 23, paddingHorizontal: 6, justifyContent: 'center', borderRadius: 3, borderWidth: 1,
        borderColor: dark ? colors.sub : '#767676',
        backgroundColor: pressed ? (dark ? colors.line : '#e5e5e5') : (dark ? colors.bgSoft : '#efefef'),
      })}
    >
      <Text style={{ fontSize: 14, lineHeight: 19, color: dark ? colors.text : '#000' }}>파일 선택</Text>
    </Pressable>
  );
}

// '인증할 내용' 시트 — 학교·회사는 검색(목록에 없으면 검색어 그대로), 소득은 구간 3개
function CredentialValuePicker({ kind, current, onPick, onClose }: { kind: CredentialKind; current: string; onPick: (v: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    if (kind === 'income') return INCOMES;
    const t = q.trim().replace(/\s+/g, ' ');
    const base = kind === 'school'
      ? SCHOOLS.flatMap((s) => SCHOOL_STATES.map((st) => `${s} ${st}`))
      : COMPANIES.map((c) => `${c} 재직 중`);
    const hit = base.filter((o) => o.toLowerCase().includes(t.toLowerCase()));
    const own = t.length >= 2 && !(kind === 'school' ? SCHOOLS : COMPANIES).some((n) => n.toLowerCase() === t.toLowerCase())
      ? (kind === 'school' ? SCHOOL_STATES.map((st) => `${t} ${st}`) : [`${t} 재직 중`]).filter((o) => o.length <= 40)
      : [];
    const all = [...hit, ...own];
    return current && !t && !all.includes(current) ? [current, ...all] : all;
  }, [kind, q, current]);

  return (
    <EditorPicker title="인증할 내용" onClose={onClose}>
      {kind !== 'income' && (
        <PickerSearch value={q} onChange={setQ} placeholder={kind === 'school' ? '학교 검색' : '회사 검색'} />
      )}
      <ScrollList>
        {options.map((o) => <PickerOption key={o} label={o} chosen={o === current} onPress={() => onPick(o)} />)}
        {!options.length && <Text style={{ fontSize: 14, lineHeight: 25.2, color: colors.sub, paddingVertical: 17, letterSpacing: LS }}>검색 결과가 없어요.</Text>}
      </ScrollList>
      {kind !== 'income' && <PickerTextButton label="선택하지 않기" onPress={() => onPick('')} />}
    </EditorPicker>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  return <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
