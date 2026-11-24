// 야화 — 편지 '마음이 간 곳'(시안 letter-attach B-2안 · 서버 0190, 2026-11-24)
// 편지를 쓸 때 받는 사람 프로필에서 마음이 간 문장 · 사진을 두 곳까지 골라 편지지 맨 위에 붙인다.
// · MarkPickRow: 편지 쓰기 위쪽 회색 버튼 한 줄(0곳 '고르기' → 1곳 '하나 더 고르기 1/2' → 2곳 '바꾸기') + 사용법(?) 버튼
// · MarkGuide: 처음 한 번(기기 기억) · ? 버튼으로 다시 — 글 예시 · 사진 예시 + 이점 세 줄
// · MarkSheet: 프로필과 같은 순서(대표 사진 → 이야기 · 사진 번갈아)로 읽다가 문장 · 사진을 눌러 고른다. 세 번째는 안내만
// · MarkQuotes: 편지지 안(보내는 쪽 · 받는 쪽) — 고른 문장(밑줄 띠) · 사진(96 + 파란 줄) + 출처 한 줄
// 고른 곳은 그 순간의 사본으로 보낸다(서버가 받는 사람의 실제 프로필에 있는 것만 받는다).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, dur, ease, fontSerif, radius } from '../../tokens';
import { BottomSheet, Button, Icon, NATIVE, reduceMotion, usePress } from '../../ui';
import { ProfilePhoto } from '../affinity/ProfilePhoto';
import { keepAll } from '../affinity/ui';
import type { LetterMark } from '../../lib/api';

export const MAX_MARKS = 2;
const ORD = ['대표', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째', '일곱 번째', '여덟 번째', '아홉 번째', '열 번째'];
const IDEAL_Q = '이런 사람에게 마음이 가요';   // 프로필(MatchProfile)과 같은 제목 — 서버 0190도 이 이름을 받는다

// ── 받는 사람 프로필 → 고를 수 있는 조각(프로필과 같은 순서) ─────────────────
type Story = { q: string; a: string };
export type MarkSource = { photos: string[]; stories: Story[] };
export function markSourceOf(fp: { photos?: string[] | null; intro_want?: string | null; headline?: string | null; extra_answers?: { q: string; a: string }[] | null } | null | undefined): MarkSource | null {
  if (!fp) return null;
  const ideal = fp.intro_want || fp.headline;
  const stories = [...(ideal ? [{ q: IDEAL_Q, a: ideal }] : []), ...((fp.extra_answers ?? []).filter((x) => x?.q && x?.a))];
  const photos = (fp.photos ?? []).filter(Boolean);
  return photos.length || stories.length ? { photos, stories } : null;
}
// 문장 나누기 — 줄바꿈과 마침표 · 물음표 · 느낌표 뒤. 마침표 없는 긴 답은 통째로 한 문장
export function splitSentences(a: string): string[] {
  return a.split(/\n+/).flatMap((par) => par.match(/[^.!?。…~]+[.!?。…~]*/g) ?? []).map((x) => x.trim()).filter(Boolean);
}
type Block = { kind: 'photo'; n: number; url: string } | { kind: 'story'; si: number; q: string; lines: string[] };
function blocksOf(src: MarkSource): Block[] {
  const out: Block[] = [];
  if (src.photos[0]) out.push({ kind: 'photo', n: 0, url: src.photos[0] });
  const rest = src.photos.slice(1);
  src.stories.forEach((st, i) => {
    out.push({ kind: 'story', si: i, q: st.q, lines: splitSentences(st.a) });
    if (rest[i]) out.push({ kind: 'photo', n: i + 1, url: rest[i] });
  });
  rest.slice(src.stories.length).forEach((url, k) => out.push({ kind: 'photo', n: src.stories.length + 1 + k, url }));
  return out;
}
const keyOfLine = (si: number, li: number) => `s${si}:${li}`;
const keyOfPhoto = (n: number) => `p${n}`;
type Pick = { key: string; mark: LetterMark };

// ── 편지 쓰기 위쪽 버튼 줄 ─────────────────────────────────────────────
export function MarkPickRow({ name, count, onOpen, onHelp }: { name: string; count: number; onOpen: () => void; onHelp: () => void }) {
  const press = usePress(0.98);
  const helpPress = usePress(0.96);
  const slim = count > 0;
  const label = count === 0 ? `${name}님 프로필에서 마음이 간 곳 고르기` : count < MAX_MARKS ? '마음이 간 곳 하나 더 고르기' : '마음이 간 곳 바꾸기';
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      <Pressable onPress={onOpen} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={count > 0 && count < MAX_MARKS ? `${label}, ${count}/${MAX_MARKS}` : label} style={{ flex: 1, minWidth: 0 }}>
        <Animated.View style={[{ height: slim ? 44 : 48, borderRadius: radius.field, backgroundColor: colors.bgSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' }, press.scaleStyle]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: press.p }]} />
          <Icon name="pencil" size={18} color={colors.textSecondary} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: slim ? '500' : '600', color: colors.textSecondary }}>{label}</Text>
          {count > 0 && count < MAX_MARKS && <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.mute, fontVariant: ['tabular-nums'] }}>{count}/{MAX_MARKS}</Text>}
        </Animated.View>
      </Pressable>
      <Pressable onPress={onHelp} onPressIn={helpPress.onPressIn} onPressOut={helpPress.onPressOut} accessibilityRole="button" accessibilityLabel="마음이 간 곳 사용법 보기">
        <Animated.View style={[{ width: 48, height: slim ? 44 : 48, borderRadius: radius.field, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, helpPress.scaleStyle]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: helpPress.p }]} />
          <Icon name="circle-help" size={20} color={colors.sub} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// 사용법을 이 기기에서 한 번 봤는지
const GUIDE_KEY = 'yahwa.letterMarkGuide.v1';
export async function markGuideSeen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(GUIDE_KEY)) === '1'; } catch { return false; }
}
function rememberGuide() { AsyncStorage.setItem(GUIDE_KEY, '1').catch(() => {}); }

// ── 사용법 안내(가운데 대화상자) ──────────────────────────────────────────
export function MarkGuide({ open, name, onClose, onGo }: { open: boolean; name: string; onClose: () => void; onGo: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return;
    rememberGuide();
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: reduceMotion() ? dur.reduced : 200, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [open, v]);
  if (!open) return null;
  const still = reduceMotion();
  const benefits: [React.ComponentProps<typeof Icon>['name'], string, string][] = [
    ['pencil', '첫 문장이 쉬워져요', '고른 곳에서 바로 이야기를 시작해요.'],
    ['star', '마음이 또렷하게 전해져요', '어디가 좋았는지 정확히 보여 줘요.'],
    ['check', '답장이 편해져요', '자기 이야기라 이어서 답하기 쉬워요.'],
  ];
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: colors.scrimDialog, alignItems: 'center', justifyContent: 'center', padding: 20, opacity: v }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <Animated.View accessibilityViewIsModal style={[{ width: '100%', maxWidth: 350, borderRadius: radius.photo, padding: 20, backgroundColor: colors.surface }, still ? null : { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <Text accessibilityRole="header" style={{ fontSize: 18, lineHeight: 25.2, fontWeight: '600', color: colors.inverseStrong }}>마음이 간 곳을 편지에 붙여 보세요</Text>
          <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 21.7, color: colors.textSecondary }}>프로필에서 고른 곳이 편지지 맨 위에 붙어요.</Text>
          <View importantForAccessibility="no-hide-descendants" style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
            <GuideColumn label="글 예시" name={name}>
              <Text style={[keepAll, { marginTop: 4, fontFamily: fontSerif, fontSize: 13, lineHeight: 21, color: colors.inverseStrong }]}><Text style={{ backgroundColor: colors.markLine }}>갓 나온 소금빵을 사요.</Text></Text>
              <Text style={[keepAll, { marginTop: 10, fontFamily: fontSerif, fontSize: 12, lineHeight: 22, color: colors.text }]}>저도 주말 아침을 좋아해요.</Text>
            </GuideColumn>
            <GuideColumn label="사진 예시" name={name}>
              <View style={{ marginTop: 6, width: 56 }}>
                <LinearGradient colors={['#FAF7EF', '#F3EDDE', '#B6A074', '#6C582C']} locations={[0, 0.6, 0.62, 1]} style={{ width: 56, height: 56, borderRadius: 8 }} />
                <View style={{ marginTop: 3, height: 3, borderRadius: 2, backgroundColor: colors.btnPrimaryBg }} />
              </View>
              <Text style={[keepAll, { marginTop: 8, fontFamily: fontSerif, fontSize: 12, lineHeight: 22, color: colors.text }]}>이 창가 자리, 제 취향이에요.</Text>
            </GuideColumn>
          </View>
          <View style={{ marginTop: 12, gap: 6 }}>
            {benefits.map(([ic, t, d]) => (
              <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={18} color={colors.textSecondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text }}>{t}</Text>
                  <Text style={[keepAll, { marginTop: 1, fontSize: 13, lineHeight: 19.5, color: colors.sub }]}>{d}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.mute }}>두 곳까지 고를 수 있고, 안 붙여도 보낼 수 있어요.</Text>
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
            <Button label="닫기" variant="gray" size="L" onPress={onClose} style={{ flex: 1 }} />
            <Button label="골라 보기" size="L" onPress={onGo} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
function GuideColumn({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, padding: 10, borderRadius: radius.card, backgroundColor: colors.bgSoft }}>
      <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
      <View style={{ flex: 1, marginTop: 8, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderTopLeftRadius: 4, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fontSerif, fontSize: 11, lineHeight: 18, color: colors.mute }}>{name}님에게</Text>
        {children}
      </View>
    </View>
  );
}

// ── 고르기 시트 ─────────────────────────────────────────────────────────
export function MarkSheet({ open, source, initial, onClose, onApply }: {
  open: boolean; source: MarkSource | null; initial: LetterMark[]; onClose: () => void; onApply: (marks: LetterMark[]) => void;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const blocks = useMemo(() => (source ? blocksOf(source) : []), [source]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [limit, setLimit] = useState(false);
  const limitT = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 열 때마다 붙여 둔 곳을 고른 채로 시작한다(프로필이 바뀌어 없어진 곳은 뺀다)
  useEffect(() => {
    if (!open) return;
    setLimit(false);
    setPicks(initial.flatMap((m): Pick[] => {
      if (m.t === 'photo') return blocks.some((b) => b.kind === 'photo' && b.n === m.n && b.url === m.url) ? [{ key: keyOfPhoto(m.n), mark: m }] : [];
      for (const b of blocks) {
        if (b.kind !== 'story' || b.q !== m.q) continue;
        const li = b.lines.indexOf(m.text);
        if (li >= 0) return [{ key: keyOfLine(b.si, li), mark: m }];
      }
      return [];
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => { if (limitT.current) clearTimeout(limitT.current); }, []);

  function toggle(p: Pick) {
    setPicks((cur) => {
      if (cur.some((x) => x.key === p.key)) return cur.filter((x) => x.key !== p.key);
      if (cur.length >= MAX_MARKS) {
        // 세 번째는 안내만 — 이미 고른 곳을 몰래 빼지 않는다
        setLimit(true);
        if (limitT.current) clearTimeout(limitT.current);
        limitT.current = setTimeout(() => setLimit(false), 1800);
        return cur;
      }
      return [...cur, p];
    });
  }
  const on = (key: string) => picks.some((x) => x.key === key);
  const first = picks[0]?.mark;
  const cta = picks.length === MAX_MARKS ? '두 곳에 답하기' : !first ? '마음이 간 곳을 눌러 주세요' : first.t === 'line' ? '이 문장에 답하기' : '이 사진에 답하기';
  const photoW = Math.min(200, winW - 40);

  return (
    <BottomSheet open={open} onClose={onClose} scroll={false} padX={0}>
      <View style={{ height: Math.round(winH * 0.74) }}>
        <View style={{ height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 16, lineHeight: 20.8, fontWeight: '600', color: colors.text }}>마음이 간 곳</Text>
        </View>
        <Text style={{ marginTop: -4, textAlign: 'center', fontSize: 13, lineHeight: 19.5, color: colors.sub }}>문장이나 사진을 두 곳까지 눌러 주세요</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 24 }} showsVerticalScrollIndicator={false}>
          {blocks.map((b) => b.kind === 'photo' ? (
            <PickPhoto key={keyOfPhoto(b.n)} url={b.url} n={b.n} width={photoW} main={b.n === 0} on={on(keyOfPhoto(b.n))} onPress={() => toggle({ key: keyOfPhoto(b.n), mark: { t: 'photo', url: b.url, n: b.n } })} />
          ) : (
            <View key={`s${b.si}`}>
              <Text style={[keepAll, { fontFamily: fontSerif, fontSize: 18, lineHeight: 27, color: colors.accentStrong }]}>“{b.q}”</Text>
              <Text style={[keepAll, { marginTop: 8, fontSize: 15, lineHeight: 25.5, color: colors.textSecondary }]}>
                {b.lines.map((line, li) => {
                  const k = keyOfLine(b.si, li);
                  const sel = on(k);
                  return (
                    <Text
                      key={k}
                      onPress={() => toggle({ key: k, mark: { t: 'line', q: b.q, text: line } })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                      suppressHighlighting
                      style={sel ? { backgroundColor: colors.markLine, color: colors.inverseStrong } : null}
                    >{line}{li < b.lines.length - 1 ? ' ' : ''}</Text>
                  );
                })}
              </Text>
            </View>
          ))}
        </ScrollView>
        {limit && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center' }}>
            <Text accessibilityLiveRegion="polite" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.night, color: colors.inverse, fontSize: 12, lineHeight: 20, fontWeight: '500' }}>두 곳까지 고를 수 있어요</Text>
          </View>
        )}
        <View style={{ paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface }}>
          <View style={{ minHeight: 32, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {picks.length ? picks.map((p) => <PickChip key={p.key} mark={p.mark} onRemove={() => setPicks((cur) => cur.filter((x) => x.key !== p.key))} />)
              : <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.mute }}>아직 고른 곳이 없어요</Text>}
            <Text style={{ marginLeft: 'auto', fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.mute, fontVariant: ['tabular-nums'] }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>{picks.length}</Text> / {MAX_MARKS}
            </Text>
          </View>
          <Button size="dock" label={cta} disabled={!picks.length} onPress={() => onApply(picks.map((p) => p.mark))} />
        </View>
      </View>
    </BottomSheet>
  );
}

// 시트 안 사진 — 프로필과 같은 자리 · 폭 200(대표 사진은 350:400). 고르면 진회색 2px 테두리 + 아래 파란 줄
function PickPhoto({ url, n, width, main, on, onPress }: { url: string; n: number; width: number; main: boolean; on: boolean; onPress: () => void }) {
  const h = main ? Math.round(width * 400 / 350) : width;
  const r = main ? 12 : 10;
  const bar = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: on ? 1 : 0, duration: reduceMotion() ? 0 : 260, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [on, bar]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${ORD[n] ?? `${n + 1}번째`} 사진`} style={{ width, paddingBottom: 8 }}>
      <View style={{ width, height: h, borderRadius: r, overflow: 'hidden', backgroundColor: colors.muted }}>
        <ProfilePhoto src={url} width={width} height={h} radius={r} thumbWidth={480} />
        {on && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: r, borderWidth: 2, borderColor: colors.inverseStrong }} />}
      </View>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: colors.btnPrimaryBg, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, 0] }) }, { scaleX: bar }] }} />
    </Pressable>
  );
}

// 시트 아래 칸의 고른 곳 묶음 — 문장(명조 13, 말줄임) · 사진(22 + '사진') + 빼기
function PickChip({ mark, onRemove }: { mark: LetterMark; onRemove: () => void }) {
  return (
    <View style={{ flexShrink: 1, minWidth: 0, maxWidth: 168, height: 32, paddingLeft: 10, paddingRight: 2, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {mark.t === 'line' ? (
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontSerif, fontSize: 13, lineHeight: 18, color: colors.text }}>“{mark.text}”</Text>
      ) : (
        <>
          <View style={{ marginLeft: -5, width: 22, height: 22, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.muted }}><ProfilePhoto src={mark.url} width={22} height={22} radius={5} thumbWidth={120} /></View>
          <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.sub }}>사진</Text>
        </>
      )}
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="빼기" style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={14} color={colors.mute} />
      </Pressable>
    </View>
  );
}

// ── 편지지 안 붙인 곳 ─────────────────────────────────────────────────────
//  who: 출처 주인('봄비님' · '당신'), from: 받는 쪽 머리 줄('하루' → '하루님이 마음이 간 곳'), onDetach: 보내는 쪽 떼기
export function MarkQuotes({ marks, who, from, onDetach, compact }: {
  marks: LetterMark[]; who: string; from?: string; onDetach?: (i: number) => void; compact?: boolean;
}) {
  if (!marks.length) return null;
  const size = compact ? 72 : 96;
  return (
    <View style={{ marginTop: compact ? 0 : 12 }}>
      {!!from && <Text style={{ marginBottom: 6, fontSize: 12, lineHeight: 18, color: colors.mute }}>{from}님이 마음이 간 곳</Text>}
      {marks.map((m, i) => (
        <View key={i} style={{ marginTop: i === 0 ? (from ? 0 : 2) : 18 }}>
          {m.t === 'line' ? (
            <Text style={[keepAll, { fontFamily: fontSerif, fontSize: compact ? 14 : 15, lineHeight: compact ? 24 : 28, color: colors.inverseStrong }]}>
              <Text style={{ backgroundColor: colors.markLine }}>{m.text}</Text>
            </Text>
          ) : (
            <View style={{ width: size, paddingBottom: 8 }}>
              <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.muted }}>
                <ProfilePhoto src={m.url} width={size} height={size} radius={10} thumbWidth={320} />
              </View>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: colors.btnPrimaryBg }} />
            </View>
          )}
          <View style={{ marginTop: m.t === 'line' ? 6 : 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="pencil" size={14} color={colors.mute} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, lineHeight: 18, color: colors.mute }}>
              {m.t === 'line' ? `${who}의 ‘${m.q}’에서` : `${who}의 ${ORD[m.n] ?? `${m.n + 1}번째`} 사진`}
            </Text>
            {!!onDetach && (
              <Pressable onPress={() => onDetach(i)} hitSlop={10} accessibilityRole="button" accessibilityLabel="떼기" style={{ marginLeft: 'auto' }}>
                <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.mute, textDecorationLine: 'underline' }}>떼기</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
