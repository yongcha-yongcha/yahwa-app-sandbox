// 야화 — 취향 설정 (리뉴얼 1120 · 시안 prefs 페이지, spec-dating §3.10)
// 인연 홈 오른쪽 위 필터 → 추천 설정 시트(components/affinity/PrefsSheet) → '전체 조건'으로 여는 화면.
// 모양은 시안, 항목은 우리 것: 거리 대신 지역(여러 곳) · MBTI(여러 개) · 나이 · 종교 · 흡연 · 음주 · 정치 성향.
// 조건에 맞는 사람을 앞쪽으로 소개할 뿐 빼지는 않는다 — 다음 배치(정오)부터 반영.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../tokens';
import { fetchMyMatchPrefs, saveMyMatchPrefs, type MatchPrefs as Prefs } from '../lib/api';
import { SIDO, regionValue, sidoOf, subOf, subRegions } from '../components/entry/profileOptions';
import { getCurrentUserId, previewActions } from '../lib/previewStore';
import { RIcons } from '../components/affinity/icons';
import { Button, Chip, DockArea, FilterChip, RangeSlider, Switch, TopBar, WheelSheet } from '../ui';

const ANY = '상관없음';
const MBTIS = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];
type SingleKey = 'religion' | 'politics' | 'drinking' | 'smoking';
type IconC = (p: { size?: number; color: string }) => React.ReactElement;
// 저장값은 예전 그대로, 음주만 화면 글자를 시안 문구로 보여 준다
const SINGLES: { key: SingleKey; title: string; icon: IconC; options: string[]; label?: Record<string, string> }[] = [
  { key: 'religion', title: '종교', icon: RIcons.prefReligion, options: ['무교', '기독교', '천주교', '불교', '기타'] },
  { key: 'smoking', title: '흡연', icon: RIcons.prefSmoking, options: ['비흡연', '흡연', '전자담배'] },
  { key: 'drinking', title: '음주', icon: RIcons.prefDrinking, options: ['안마심', '가끔', '즐김'], label: { 안마심: '마시지 않아요', 즐김: '즐기는 편이에요' } },
  { key: 'politics', title: '정치 성향', icon: RIcons.prefTalk, options: ['중도', '진보', '보수', '무관심'] },
];
export const AGE_MIN = 19;
export const AGE_MAX = 60;
const DEFAULTS: Prefs = { regions: [], mbtis: [], ageAny: true, minAge: 20, maxAge: 40 };
// 바뀐 것이 있는지 비교할 때 쓰는 모양(빈 값 = 상관없음)
const norm = (d: Prefs) => JSON.stringify([
  [...(d.regions ?? [])].sort(), [...(d.mbtis ?? [])].sort(), !!d.ageAny, d.ageAny ? 0 : d.minAge ?? 20, d.ageAny ? 0 : d.maxAge ?? 40,
  ...SINGLES.map((g) => d[g.key] || ANY),
]);

// 취향 초안 — 서버 값을 받아 고치고 저장한다(시트와 화면이 같이 쓴다)
export function usePrefsDraft(active: boolean = true) {
  const myUid = getCurrentUserId();
  const qc = useQueryClient();
  const prefsQ = useQuery({ queryKey: ['match-prefs', myUid], queryFn: fetchMyMatchPrefs, enabled: !!myUid });
  const [d, setD] = useState<Prefs>(DEFAULTS);
  const [base, setBase] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  // 열 때마다 서버 값에서 다시 시작한다
  useEffect(() => {
    if (!active) { setBase(null); return; }
    if (base || !prefsQ.data) return;
    const v = { ...DEFAULTS, ...prefsQ.data };
    setD(v); setBase(v);
  }, [active, prefsQ.data, base]);
  const dirty = !!base && norm(d) !== norm(base);
  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      await saveMyMatchPrefs(d);
      qc.invalidateQueries({ queryKey: ['match-prefs'] });
      // 오늘의 인연(useTodayDeck)은 내 정보 캐시의 match_prefs를 읽는다 — 바로 맞춘다
      qc.setQueryData(['me', myUid], (old: any) => (old ? { ...old, match_prefs: d } : old));
      setBase(d);
      return true;
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '저장하지 못했어요. 잠시 후 다시 시도해주세요', 2400);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { d, setD, dirty, saving, save, ready: !!base, isDefault: norm(d) === norm(DEFAULTS), reset: () => setD(DEFAULTS) };
}

// 섹션 제목 — 아이콘 20 + 15/21 600, 오른쪽 값(강조 파랑 14/600) 또는 안내(12 회색)
export function PrefSectionHead({ icon: I, title, value, hint }: { icon: IconC; title: string; value?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <I size={20} color={colors.textSecondary} />
      <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{title}</Text>
      <View style={{ flex: 1 }} />
      {!!value && <Text style={{ fontSize: 14, lineHeight: 14, fontWeight: '600', color: colors.accent, fontVariant: ['tabular-nums'] }}>{value}</Text>}
      {!!hint && <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{hint}</Text>}
    </View>
  );
}

// 나이 — 범위 막대(19~60). 막대를 움직이면 '상관없음'이 풀린다. dimAny: 상관없음이면 막대를 35%로 흐리게(취향 설정 화면)
export function AgeSection({ d, setD, dimAny }: { d: Prefs; setD: React.Dispatch<React.SetStateAction<Prefs>>; dimAny?: boolean }) {
  const lo = d.minAge ?? 20, hi = d.maxAge ?? 40;
  return (
    <View>
      <PrefSectionHead icon={RIcons.prefPerson} title="나이" value={d.ageAny ? ANY : `${lo}–${hi}세`} />
      <RangeSlider
        min={AGE_MIN} max={AGE_MAX} low={lo} high={hi} lowLabel="최소 나이" highLabel="최대 나이" style={{ marginHorizontal: 2, opacity: dimAny && d.ageAny ? 0.35 : 1 }}
        onChange={(a, b) => setD((x) => ({ ...x, ageAny: false, minAge: a, maxAge: b }))}
      />
      <View style={{ marginTop: 2, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, lineHeight: 11, color: colors.mute }}>{AGE_MIN}세</Text>
        <Text style={{ fontSize: 11, lineHeight: 11, color: colors.mute }}>{AGE_MAX}세</Text>
      </View>
    </View>
  );
}

// 지역(시안 pref-region, 11-21) — 칩은 상관없음 + 시·도 17개. 시·도를 누르면 다이얼로 '시·도 전체' 또는 구 하나를 고르고,
// 적용하면 걸러짐 칩 "서울 | 종로구"(✕로 빼기 · 다시 누르면 다이얼에서 바꾸기 · 이 지역 빼기). 시·도마다 한 곳.
// 저장값은 서버 매칭(deck_region_match)과 맞춘다: 전체 = '서울', 구 = '서울 / 종로구'(가입 지역과 같은 규칙 regionValue).
// 예전에 저장된 '서울 / 기타'는 화면에서 '전체'로 보이고, 다시 적용하면 '서울'로 바뀐다. 한 시·도에 예전 값이 여럿이면 "강남구 외 1"
const ALL = '전체';
const subLabel = (r: string) => { const s = subOf(r); return !s || s === '기타' ? ALL : s; };
// 요약(추천 설정 시트)용 글자 — '서울 / 종로구' → '서울 종로구', '부산' → '부산 전체'(세부가 없는 세종은 그대로)
export const prefRegionText = (r: string) => (subRegions(sidoOf(r)).length ? `${sidoOf(r)} ${subLabel(r)}` : r);
function RegionSection({ d, setD }: { d: Prefs; setD: React.Dispatch<React.SetStateAction<Prefs>> }) {
  const [open, setOpen] = useState<string | null>(null);   // 다이얼을 연 시·도
  const [shown, setShown] = useState('서울');              // 닫히는 동안에도 내용을 그대로 둔다
  const regions = d.regions ?? [];
  const picksOf = (sido: string) => regions.filter((r) => sidoOf(r) === sido);
  const setSido = (sido: string, value: string | null) =>
    setD((x) => ({ ...x, regions: [...(x.regions ?? []).filter((r) => sidoOf(r) !== sido), ...(value ? [value] : [])] }));
  const openDial = (sido: string) => {
    if (!subRegions(sido).length) { setSido(sido, sido); return; }   // 세부가 없는 시·도(세종)는 바로 걸린다
    setShown(sido); setOpen(sido);
  };
  const subs = subRegions(shown);
  const cur = picksOf(shown)[0];
  return (
    <>
      <Chips>
        <Chip label={ANY} selected={!regions.length} onPress={() => setD((x) => ({ ...x, regions: [] }))} />
        {SIDO.map((s) => {
          const picks = picksOf(s);
          if (!picks.length) return <Chip key={s} label={s} onPress={() => openDial(s)} />;
          const sub = subRegions(s).length ? subLabel(picks[0]) + (picks.length > 1 ? ` 외 ${picks.length - 1}` : '') : undefined;
          return <FilterChip key={s} head={s} sub={sub} onPress={subRegions(s).length ? () => openDial(s) : undefined} onClear={() => setSido(s, null)} clearLabel={`${s} 지역 빼기`} />;
        })}
      </Chips>
      <WheelSheet
        open={!!open}
        stepKey={shown}
        onClose={() => setOpen(null)}
        title={`${shown} · 어디로 할까요?`}
        caption={`한 곳을 골라 주세요. ${shown} 어디든 괜찮으면 "${shown} ${ALL}"예요.`}
        columns={[{ current: cur ? subLabel(cur) : subs[0], values: [{ value: ALL, label: `${shown} ${ALL}` }, ...subs.map((g) => ({ value: g, label: g }))] }]}
        doneLabel="적용"
        secondary={cur ? { label: '이 지역 빼기', onPress: () => { setSido(shown, null); setOpen(null); } } : undefined}
        onDone={([v]) => { const g = String(v); setSido(shown, g === ALL ? shown : regionValue(shown, g)); setOpen(null); }}
      />
    </>
  );
}
function Chips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}
// 묶음 제목 — 위 1px 선 + 24, 13/600
function GroupTitle({ children }: { children: string }) {
  return (
    <View style={{ marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.line }}>
      <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: '600', color: colors.text }}>{children}</Text>
    </View>
  );
}

export function MatchPrefs({ onBack }: { onBack: () => void }) {
  const myUid = getCurrentUserId();
  const { d, setD, dirty, saving, save, isDefault, reset } = usePrefsDraft();
  const toggleIn = (k: 'regions' | 'mbtis', v: string) =>
    setD((x) => {
      const cur = x[k] ?? [];
      return { ...x, [k]: cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v] };
    });
  const resetBtn = useMemo(() => (
    <Pressable onPress={reset} disabled={isDefault} accessibilityRole="button" accessibilityState={{ disabled: isDefault }} hitSlop={8} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center', opacity: isDefault ? 0.45 : 1 }}>
      <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: isDefault ? colors.mute : colors.accent }}>초기화</Text>
    </Pressable>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isDefault]);

  async function onSave() {
    if (await save()) {
      previewActions.showToast('다음 소개부터 취향을 참고할게요.', 2200);
      onBack();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="취향 설정" onBack={onBack} right={resetBtn} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 15, lineHeight: 27, color: colors.textSecondary }}>저장한 조건은 다음 소개부터 참고해요. 조건을 넓게 둘수록 더 많은 인연을 만날 수 있어요.</Text>

        <View style={{ marginTop: 28 }}>
          <AgeSection d={d} setD={setD} dimAny />
          <View style={{ marginTop: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingRight: 8 }}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>나이는 상관없어요</Text>
            <Switch value={!!d.ageAny} onChange={(v) => setD((x) => ({ ...x, ageAny: v }))} accessibilityLabel="나이는 상관없어요" />
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <PrefSectionHead icon={RIcons.prefHome} title="지역" hint="여러 곳을 고를 수 있어요" />
          <RegionSection d={d} setD={setD} />
        </View>

        <GroupTitle>생활 방식</GroupTitle>

        <View style={{ marginTop: 28 }}>
          <PrefSectionHead icon={RIcons.mbti} title="MBTI" hint="여러 개를 고를 수 있어요" />
          <Chips>
            <Chip label={ANY} selected={!d.mbtis?.length} onPress={() => setD((x) => ({ ...x, mbtis: [] }))} />
            {MBTIS.map((m) => <Chip key={m} label={m} selected={!!d.mbtis?.includes(m)} onPress={() => toggleIn('mbtis', m)} />)}
          </Chips>
        </View>

        {SINGLES.map((g) => (
          <View key={g.key} style={{ marginTop: 28 }}>
            <PrefSectionHead icon={g.icon} title={g.title} />
            <Chips>
              {[ANY, ...g.options].map((o) => (
                <Chip key={o} label={g.label?.[o] ?? o} selected={(d[g.key] || ANY) === o} onPress={() => setD((x) => ({ ...x, [g.key]: o }))} />
              ))}
            </Chips>
          </View>
        ))}
      </ScrollView>
      <DockArea fade>
        <Button size="dock" label="저장하기" disabled={!dirty || !myUid} loading={saving} onPress={onSave} />
      </DockArea>
    </View>
  );
}

// 시트 줄 요약 — 생활 방식(MBTI · 종교 · 흡연 · 음주 · 정치 성향) 중 고른 것
export function lifestyleSummary(d: Prefs): string {
  const picked = [
    ...(d.mbtis?.length ? [d.mbtis.length > 2 ? `MBTI ${d.mbtis.length}개` : d.mbtis.join(' · ')] : []),
    ...SINGLES.filter((g) => d[g.key] && d[g.key] !== ANY).map((g) => g.label?.[d[g.key] as string] ?? (d[g.key] as string)),
  ];
  return picked.length ? picked.join(' · ') : '모두 상관없음';
}
