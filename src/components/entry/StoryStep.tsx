// 소개 3/4 — 자기소개(spec-shell §4.10 · §3-11). 프로필 수정의 '나의 이야기 고치기'도 같은 부품.
// 목록(이야기마다 회색 카드) ↔ 쓰기(회색 칸 · 얇은 막대 · 글자 수 거점) + 질문 카드 시트 — 시안 story-cards N1 · W1 · E1(11-21).
// 데이터(§7-11): 기본 소개 = "이런 사람에게 마음이 가요"(intro_want, 필수) + 고른 질문 2~5개(extra_answers), 각 20~300자.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ease, fontSerif, layout, palette, type as typo } from '../../tokens';
import { KeyboardAware } from '../KeyboardAware';
import { BottomSheet, Button, Chip, CloseButton, ConfirmSheet, DockArea, Icon, NATIVE, T, Tag, TextArea, haptic, reduceMotion, usePress } from '../../ui';
import { ThinClose } from './art';
import { BASIC_STORY, STORY_BANK, STORY_TOPICS, storyOf } from './storyBank';
import { previewActions } from '../../lib/previewStore';
import { storyIssue } from '../../lib/storyCheck';

export const MIN_STORY = 20;
export const MAX_STORY = 300;
export const MAX_PICKS = 5;
const END = 200;
const MARKS = [20, 80, 150, 200];
const REACHED: Record<number, string> = { 20: '이제 담을 수 있어요', 80: '권장 길이를 채웠어요', 150: '대화가 더 잘 이어질 거예요', 200: '가득 채웠어요' };
const COUNT = ['기본 소개부터 천천히 적어 봐요', '두 장 더 담으면 돼요', '한 장만 더 담으면 돼요', '세 장을 다 담았어요'];
const CARD_BG = [palette.sky[50], palette.rose[50], palette.gold[50]];

export type Extra = { q: string; a: string };
const len = (s?: string) => [...(s ?? '').trim()].length;
// 20자 이상 + 의미 없는 글(자음·모음만 · 같은 글자 반복 · 되풀이)이 아닐 것
export const storyOk = (s?: string) => len(s) >= MIN_STORY && !storyIssue(s ?? '');
// 채운 장수(기본 소개 + 앞 이야기 2개) · 통과 조건
export const storyFilled = (ideal: string, extras: Extra[]) => (storyOk(ideal) ? 1 : 0) + extras.slice(0, 2).filter((x) => storyOk(x.a)).length;
export const storiesDone = (ideal: string, extras: Extra[]) => storyFilled(ideal, extras) >= 3;

const say = (m: string) => previewActions.showToast(m);
const topicOf = (q: string) => STORY_TOPICS[storyOf(q)?.cat ?? 0];

// 항목이 하나씩 자리 잡음 — translateY 12 → 0 + 페이드 320ms, 지연 min(순번, 3) × 40ms
function Settle({ i, k, children, style }: { i: number; k: string; children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(i, 3) * 40, easing: ease.out, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

// 이야기 카드 — 회색 카드(모서리 16 · 안쪽 18/20/20 · 사이 6) · 꼬리표(회색 600 12) → 질문(600 16 primary) → 답(14 회색, 두 줄).
// 누르면 0.97배 + 바탕 #E3E7EA. fresh: 방금 담은 이야기(아래 6에서 떠오름 520ms)
function Entry({ label, q, a, fresh, onPress, onRemove }: { label: string; q: string; a: string; fresh?: boolean; onPress: () => void; onRemove?: () => void }) {
  const press = usePress(0.97, 120, 220);
  const n = len(a);
  const v = useRef(new Animated.Value(fresh && !reduceMotion() ? 0 : 1)).current;
  useEffect(() => {
    if (fresh && !reduceMotion()) Animated.timing(v, { toValue: 1, duration: 520, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [fresh, v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${label}, ${q}`}>
        <Animated.View style={[{ alignItems: 'flex-start', gap: 6, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, borderRadius: 16, backgroundColor: colors.bgSoft, overflow: 'hidden' }, press.scaleStyle]}>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.muted, opacity: press.p }} />
          <Text style={{ fontSize: 12, lineHeight: 16.8, fontWeight: '600', color: colors.sub }}>{label}</Text>
          <T style={{ fontSize: 16, lineHeight: 23.2, fontWeight: '600', color: colors.accentStrong, paddingRight: onRemove ? 30 : 0 }}>{q}</T>
          <T numberOfLines={2} style={{ fontSize: 14, lineHeight: 22.4, color: n ? colors.textSecondary : colors.sub }}>{n ? a.trim() : '눌러서 첫 줄을 적어 보세요.'}</T>
          {n > 0 && !storyOk(a) && <Tag tone="gold" label={n < MIN_STORY ? `쓰는 중 · ${n}자` : '다시 써 주세요'} style={{ marginVertical: 2 }} />}
        </Animated.View>
      </Pressable>
      {!!onRemove && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`${label} 빼기`} style={({ pressed }) => ({ position: 'absolute', top: 6, right: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : 1 }] })}>
          {({ pressed }) => <ThinClose color={pressed ? colors.danger : colors.subtle} />}
        </Pressable>
      )}
    </Animated.View>
  );
}

// 빈 자리(회색 카드 64) — 채울 차례면 파란 ＋ 글자, 잠겼으면 회색 글자(누르면 이유를 알림으로)
function Blank({ label, lockWhy, onPress }: { label: string; lockWhy?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ height: 64, paddingHorizontal: 20, borderRadius: 16, backgroundColor: pressed && !lockWhy ? colors.muted : colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 6 })}>
      {!lockWhy && <Icon name="plus" size={18} color={colors.focus} />}
      <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, fontWeight: lockWhy ? '500' : '600', color: lockWhy ? colors.sub : colors.focus }}>{label} · {lockWhy ?? '질문 붙이기'}</Text>
    </Pressable>
  );
}

// 질문 카드 시트 — 주제 칩 줄 + 옆으로 넘기는 카드(196 × 220)
function QuestionSheet({ open, onClose, cat, setCat, used, onPick }: { open: boolean; onClose: () => void; cat: number; setCat: (c: number) => void; used: string[]; onPick: (q: string) => void }) {
  const { height: winH } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const deck = useRef<ScrollView>(null);
  const items = STORY_BANK.filter((b) => b.cat === cat);
  const insets = useSafeAreaInsets();
  // 시트 높이 = min(440, 화면의 82%) — 카드는 그 안에 맞춘다
  const sheetH = Math.min(440, winH * 0.82);
  const cardH = Math.min(220, sheetH - 220);
  return (
    <BottomSheet open={open} onClose={onClose} scroll={false} padX={0} style={{ height: sheetH + insets.bottom }}>
      <View style={{ paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={typo.sheetTitleSerif}>어떤 이야기를 들려줄까요?</Text>
          <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.sub }}>마음이 가는 질문 카드를 골라요.</Text>
        </View>
        <View style={{ marginTop: -6, marginRight: -6 }}><CloseButton onPress={onClose} label="질문 고르기 닫기" /></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 4, gap: 6 }}>
        {STORY_TOPICS.map((g, i) => (
          <Chip key={g} kind="topic" label={g} selected={i === cat} onPress={() => { setCat(i); setAt(0); deck.current?.scrollTo({ x: 0, animated: false }); }} />
        ))}
      </ScrollView>
      <ScrollView
        ref={deck}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={208}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={(e) => { const i = Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / 208)); if (i !== at) setAt(i); }}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: 8, gap: 12 }}
      >
        {items.map((b, i) => {
          const u = used.includes(b.q);
          return (
            <Pressable key={b.q} disabled={u} onPress={() => onPick(b.q)} accessibilityRole="button" accessibilityState={{ disabled: u }} style={{ width: 196, height: cardH, padding: 16, borderRadius: 16, backgroundColor: CARD_BG[i % 3], justifyContent: 'space-between' }}>
              <T style={{ fontFamily: fontSerif, fontSize: 17, lineHeight: 25.5, color: u ? colors.sub : colors.text }}>{b.q}</T>
              <View style={{ alignItems: 'flex-start' }}>
                {!!b.ex && <T numberOfLines={3} style={{ fontSize: 12, lineHeight: 19.2, color: colors.sub }}>예) {b.ex}</T>}
                {u ? (
                  <View style={{ marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.surface }}>
                    <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.sub }}>고른 질문</Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="pencil" size={16} color={colors.accentStrong} />
                    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.accentStrong }}>이 질문으로 쓰기</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View accessibilityElementsHidden style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 4 }}>
        {items.map((b, i) => <View key={b.q} style={{ width: i === at ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === at ? colors.sub : colors.control }} />)}
      </View>
    </BottomSheet>
  );
}

function stage(n: number, text: string): ['idle' | 'warn' | '', string] {
  if (n === 0) return ['idle', '첫 줄을 편하게 적어 보세요'];
  if (n < MIN_STORY) return ['warn', `${MIN_STORY}자까지 ${MIN_STORY - n}자 남았어요`];
  const issue = storyIssue(text);
  if (issue) return ['warn', issue];
  if (n < 80) return ['', '이제 담을 수 있어요'];
  if (n < 150) return ['', '권장 길이를 채웠어요'];
  if (n < END) return ['', '길게 쓴 소개일수록 대화가 더 잘 이어져요'];
  return ['', '꾹꾹 담은 이야기, 이제 만나러 가볼까요'];
}

// backRef: 부모의 뒤로(머리 줄 · 안드로이드)가 먼저 부른다 — 쓰기 중이면 목록으로 돌아가고 true
// doneLabel · canFinish: 목록의 주 버튼(가입: 3장을 채워야 '다음' / 수정: 기본 소개만 채우면 '완료')
export function StoryStep({ ideal, extras, onChange, onNext, backRef, edit }: {
  ideal: string; extras: Extra[];
  onChange: (ideal: string, extras: Extra[]) => void;
  onNext: () => void;
  backRef: React.MutableRefObject<(() => boolean) | null>;
  edit?: boolean;
}) {
  const [view, setView] = useState<'main' | 'write'>('main');
  const [editing, setEditing] = useState<number>(-1);   // -1 기본 소개 · 0~ 고른 질문
  const [fresh, setFresh] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [cat, setCat] = useState(0);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [exHidden, setExHidden] = useState(false);   // 예시: 입력칸을 누르거나 쓰기 시작하면 숨기고 다시 안 보임
  const enterOk = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [barW, setBarW] = useState(0);
  const bar = useRef(new Animated.Value(0)).current;

  const n = storyFilled(ideal, extras);
  const passed = edit ? storyOk(ideal) && extras.every((x) => !len(x.a) || storyOk(x.a)) : storiesDone(ideal, extras);
  const toMain = () => { setView('main'); scroll.current?.scrollTo({ y: 0, animated: false }); };
  backRef.current = () => { if (view === 'write') { toMain(); return true; } return false; };

  function openWrite(i: number) {
    setEditing(i);
    enterOk.current = storyOk(i < 0 ? ideal : extras[i]?.a);
    setFresh(null);
    setExHidden(false);
    setView('write');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function openSheet(replacing?: number) {
    setSwapFor(replacing ?? null);
    if (replacing != null) setCat(storyOf(extras[replacing]?.q)?.cat ?? 0);
    setSheet(true);
  }
  function pick(q: string) {
    setSheet(false);
    if (swapFor != null) {
      // 다른 질문으로 바꾸면 쓴 글은 비운다(질문이 달라져서)
      const next = extras.map((x, i) => (i === swapFor ? { q, a: '' } : x));
      onChange(ideal, next);
      setTimeout(() => openWrite(swapFor), 260);
    } else {
      const next = [...extras, { q, a: '' }];
      onChange(ideal, next);
      setTimeout(() => openWrite(next.length - 1), 260);
    }
  }
  function remove(i: number) {
    onChange(ideal, extras.filter((_, k) => k !== i));
    setRemoving(null);
    toMain();
    say('이야기를 뺐어요');
  }

  // ── 쓰기 ──
  const cur = editing < 0 ? { q: BASIC_STORY.q, a: ideal } : extras[editing] ?? { q: '', a: '' };
  const info = storyOf(cur.q);
  const count = len(cur.a);
  const [cls, main] = stage(count, cur.a);
  // 얇은 막대 — 채운 비율만큼 왼쪽에서 밀려 나온다(160ms, 네이티브 드라이버)
  const fill = Math.min(count, END) / END;
  useEffect(() => {
    const to = -(1 - fill) * barW;
    if (reduceMotion()) { bar.setValue(to); return; }
    const a = Animated.timing(bar, { toValue: to, duration: 160, easing: Easing.ease, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [fill, barW, bar]);
  function type(text: string) {
    const prev = count;
    const now = len(text);
    if (editing < 0) onChange(text, extras);
    else onChange(ideal, extras.map((x, i) => (i === editing ? { ...x, a: text } : x)));
    setExHidden(true);
    const crossed = MARKS.filter((m) => prev < m && now >= m).pop();
    if (crossed && !storyIssue(text)) { haptic('selection'); say(REACHED[crossed]); }
  }
  function save() {
    if (!storyOk(cur.a)) return;
    const counts = editing < 2;   // 기본 소개 + 앞 이야기 2개만 장수에 든다
    const after = storyFilled(ideal, extras);
    const before = after - (!enterOk.current && counts ? 1 : 0);
    if (after > before) setFresh(editing);
    toMain();
    haptic('success');
    say(after >= 3 && before < 3 ? '세 장을 다 담았어요' : `이야기 한 장을 담았어요 · ${Math.min(after, 3)} / 3`);
  }

  const writing = view === 'write';
  const eye = editing < 0 ? '기본 소개 · 필수' : `${editing >= 2 ? '더 담은 이야기' : `이야기 ${editing + 1}`} · ${topicOf(cur.q)}`;
  const basicOk = storyOk(ideal);
  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 13, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {!writing ? (
          <>
            <Settle i={0} k="main"><T v="stepTitleS">당신을 알아가는{'\n'}작은 이야기</T></Settle>
            <Settle i={1} k="main">
              <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.sub, fontVariant: ['tabular-nums'] }}>
                이야기 <Text style={{ fontWeight: '600', color: colors.inverseStrong }}>{n}</Text> / 3장 · {COUNT[n]}
              </Text>
            </Settle>
            <Settle i={2} k="main" style={{ marginTop: 20 }}>
              <View style={{ gap: 12 }}>
                <Entry label="기본 소개 · 필수" q={BASIC_STORY.q} a={ideal} fresh={fresh === -1} onPress={() => openWrite(-1)} />
                {[0, 1].map((k) => {
                  const x = extras[k];
                  const label = `이야기 ${k + 1}`;
                  if (x) return <Entry key={k} label={`${label} · ${topicOf(x.q)}`} q={x.q} a={x.a} fresh={fresh === k} onPress={() => openWrite(k)} onRemove={() => setRemoving(k)} />;
                  if (!basicOk) return <Blank key={k} label={label} lockWhy="기본 소개를 먼저 써 주세요" onPress={() => say('기본 소개를 먼저 써 주세요')} />;
                  if (extras.length === k) return <Blank key={k} label={label} onPress={() => openSheet()} />;
                  return <Blank key={k} label={label} lockWhy="앞 이야기를 먼저 담아 주세요" onPress={() => say('앞 이야기를 먼저 담아 주세요')} />;
                })}
                {extras.slice(2).map((x, i) => (
                  <Entry key={x.q} label={`더 담은 이야기 · ${topicOf(x.q)}`} q={x.q} a={x.a} fresh={fresh === i + 2} onPress={() => openWrite(i + 2)} onRemove={() => setRemoving(i + 2)} />
                ))}
              </View>
            </Settle>
            {n >= 3 && extras.length < MAX_PICKS && (
              <Pressable onPress={() => openSheet()} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 12, minHeight: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="plus" size={16} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: '500', color: colors.textSecondary }}>질문 하나 더 붙이기 · 선택</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Settle i={0} k={`w${editing}`}><Text style={{ marginTop: 3, fontSize: 12, lineHeight: 16.8, fontWeight: '600', color: colors.sub }}>{eye}</Text></Settle>
            <Settle i={1} k={`w${editing}`} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <T style={{ flex: 1, fontFamily: fontSerif, fontSize: 21, lineHeight: 31.5, letterSpacing: -1, color: colors.accentStrong }} accessibilityRole="header">{cur.q}</T>
              {editing >= 0 && (
                <Pressable onPress={() => openSheet(editing)} accessibilityRole="button" hitSlop={6} style={({ pressed }) => ({ height: 32, marginTop: 2, paddingHorizontal: 12, borderRadius: 16, backgroundColor: pressed ? colors.muted : colors.bgSoft, justifyContent: 'center' })}>
                  <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary }}>질문 고르기</Text>
                </Pressable>
              )}
            </Settle>
            <Settle i={2} k={`w${editing}`} style={{ marginTop: 20 }}>
              {/* 입력칸을 직접 누르면 예시를 숨긴다(들어올 때 자동 포커스로는 안 숨김) */}
              <View onStartShouldSetResponderCapture={() => { setExHidden(true); return false; }}>
                <TextArea soft height={200} autoFocus value={cur.a} onChangeText={type} maxLength={MAX_STORY} placeholder={info?.help || '여기에 편하게 적어 주세요.'} accessibilityLabel={cur.q} />
              </View>
            </Settle>
            <Settle i={3} k={`w${editing}`}>
              <View accessibilityRole="progressbar" accessibilityLabel="이야기 작성량" accessibilityValue={{ min: 0, max: END, now: Math.min(count, END) }} onLayout={(e) => setBarW(e.nativeEvent.layout.width)} style={{ height: 4, marginTop: 14, borderRadius: 2, backgroundColor: colors.muted, overflow: 'hidden' }}>
                <Animated.View style={{ flex: 1, borderRadius: 2, backgroundColor: cls === 'warn' ? colors.errorLine : colors.text, transform: [{ translateX: barW ? bar : -9999 }] }} />
              </View>
              <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text accessibilityLiveRegion="polite" style={{ flex: 1, fontSize: 13, lineHeight: 19.5, fontWeight: cls === 'idle' ? '500' : '600', color: cls === 'warn' ? colors.danger : cls === 'idle' ? colors.textSecondary : colors.text }}>{main}</Text>
                <Text style={{ fontSize: 13, lineHeight: 19.5, color: colors.sub, fontVariant: ['tabular-nums'] }}>{count}자</Text>
              </View>
              {/* 예시 — 처음부터 펼친 연한 회색 상자(#F1F4F6 55% + 흰), 복사 없음 */}
              {!!info?.ex && !exHidden && (
                <View style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
                  <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.bgSoft, opacity: 0.55 }} />
                  <Text style={{ marginBottom: 4, fontSize: 12, lineHeight: 16.8, fontWeight: '600', color: colors.mute }}>예시</Text>
                  <T style={{ fontSize: 14, lineHeight: 22.4, color: colors.sub }}>{info.ex}</T>
                </View>
              )}
              {editing >= 0 && (
                <Pressable onPress={() => setRemoving(editing)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 16, minHeight: 44, justifyContent: 'center' }}>
                  {({ pressed }) => <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: pressed ? colors.dangerPress : colors.danger }}>이 이야기 빼기</Text>}
                </Pressable>
              )}
            </Settle>
          </>
        )}
      </ScrollView>
      {writing ? (
        <DockArea><Button label="이 이야기 담기" size="dock" disabled={!storyOk(cur.a)} onPress={save} /></DockArea>
      ) : (
        <DockArea note={!edit && passed ? '이야기는 나중에 내 프로필에서도 고칠 수 있어요.' : undefined}>
          <Button label={passed ? (edit ? '완료' : '다음') : edit ? (len(ideal) >= MIN_STORY && !basicOk ? '기본 소개를 다시 써 주세요' : '기본 소개를 20자 이상 써 주세요') : `이야기 ${3 - n}장을 더 담아 주세요`} size="dock" disabled={!passed} onPress={onNext} />
        </DockArea>
      )}
      <QuestionSheet open={sheet} onClose={() => setSheet(false)} cat={cat} setCat={setCat} used={extras.map((x) => x.q)} onPick={pick} />
      <ConfirmSheet open={removing !== null} onClose={() => setRemoving(null)} title="이 이야기를 뺄까요?" desc="쓴 글도 함께 지워져요." confirmLabel="빼기" danger onConfirm={() => { if (removing !== null) remove(removing); }} />
    </KeyboardAware>
  );
}
