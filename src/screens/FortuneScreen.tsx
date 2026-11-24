// 야화 — 오늘의 운세: 손으로 카드를 직접 뽑는 타로 리딩 (lumi-tarot RN 포팅).
// 흐름: 주제 선택(오늘의 운세 / 오늘의 연애운) → 78장 덱에서 3장 선택 → 자리별 풀이.
// UX: 봇과 채팅하듯 문장 박스가 한 개 단위로 툭툭 등장한다(글자 단위 타이핑 없음). 박스가 뜨면 다음 섹션이 열린다.
//     결과도 카드가 한 장씩 순차 공개돼 "실제 타로 보는" 흐름을 만든다. 외부 API 없음.
// 디자인: 야화 라이트 테마 + 브랜드 레드(main #bf3127).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Animated, Easing } from 'react-native';
import { Icons } from '../icons';
import { NavBar } from '../components/atoms';
import { usePreview, previewSelectors } from '../lib/previewStore';
import {
  contextualCardBubbles,
  readingClosingAdvice,
  spreadPreambleBubbles,
} from '../lib/reading-context';
import { READING_MODES, THREE_CARD_COUNT, type ReadingMode } from '../lib/reading-modes';
import { type TarotCard, createFullDeck, shuffle } from '../lib/tarot-deck';

// ── 팔레트(야화 라이트 테마 + 디자이너 브랜드 토큰) ─────────────────────────────
const P = {
  screenBg: '#FAFAFB',
  card: '#FFFFFF',
  beige: '#F0EEE9',
  main: '#bf3127',
  mainDark: '#96261e',
  mainDeep: '#7a1f18',
  mainSoft: 'rgba(191,49,39,0.07)',
  mainLine: 'rgba(191,49,39,0.28)',
  cream: '#F5EDE9',
  textDark: '#494F54',
  textSub: '#6F6F76',
  textLite: '#A6ABAF',
  line: '#E0E5EA',
  lineSoft: '#EDF0F3',
  error: '#C24960',
  white: '#FFFFFF',
  slotEmpty: '#C6CCD1',
  cardBack: ['#bf3127', '#96261e', '#7a1f18'] as const,
};

let _idc = 0;
function newId() {
  _idc += 1;
  return `m${_idc}`;
}

const WELCOME_TEXT =
  '밤하늘 아래, 저는 루미예요. 오늘의 운세와 오늘의 연애운 중 하나를 골라 주세요. 고르시면 카드 세 장을 직접 뽑으실 수 있어요. 그 선택을 바탕으로 오늘의 흐름을 함께 읽어 드릴게요.';

// ── 타임라인 아이템 ───────────────────────────────────────────────────────────
type Bubble = { key: string; content: string };
type TLItem =
  | { id: string; kind: 'chat'; role: 'user' | 'astrologer'; text: string }
  | { id: string; kind: 'notice'; text: string }
  | { id: string; kind: 'preamble'; text: string }
  | { id: string; kind: 'card'; pos: string; name: string; upright: boolean; bubbles: Bubble[] }
  | { id: string; kind: 'closing'; text: string }
  | { id: string; kind: 'actions'; modeId: string };

type Picked = { deckIndex: number; card: TarotCard; upright: boolean };
type Step = 'choose_mode' | 'pick' | 'reveal';

function modeIntroItems(): TLItem[] {
  return [
    { id: newId(), kind: 'chat', role: 'astrologer', text: WELCOME_TEXT },
    {
      id: newId(),
      kind: 'chat',
      role: 'astrologer',
      text: '위에서 「오늘의 운세」 또는 「오늘의 연애운」을 골라 주세요.',
    },
  ];
}

// ── 타이핑 텍스트 ─────────────────────────────────────────────────────────────
function TypedText({
  text,
  active,
  speed = 14,
  onDone,
  style,
}: {
  text: string;
  active: boolean;
  speed?: number;
  onDone?: () => void;
  style?: any;
}) {
  // 글자 단위 타이핑 제거 — 문장 박스가 통째로 "툭" 나타나고, 다음 박스로 넘어가기 위해
  // 짧은 간격 후 onDone을 호출한다(박스 단위 순차 등장은 유지). speed는 하위호환용 무시.
  void speed;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => { doneRef.current?.(); }, 260);
    return () => clearTimeout(id);
  }, [active, text]);

  return <Text style={style}>{text}</Text>;
}

// 등장 애니메이션 — fade + 살짝 위로 슬라이드(툭 튀어나오지 않게). animate=false면 즉시.
function Appear({ children, animate = true }: { children: React.ReactNode; animate?: boolean }) {
  const a = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(a, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, a]);
  return (
    <Animated.View
      style={{
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// 볼드 마크 최종 렌더(타이핑 완료 후)
function BoldText({ content, style }: { content: string; style?: any }) {
  const parts = content.split(/(__BOLD_START__.+?__BOLD_END__)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const m = part.match(/^__BOLD_START__(.+?)__BOLD_END__$/);
        if (m) {
          return (
            <Text key={i} style={{ fontWeight: '800', color: P.main }}>
              {m[1]}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

// 루미 아바타(원형 ✦)
function LumiAvatar() {
  return (
    <View
      style={{
        marginTop: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: P.mainLine,
        backgroundColor: P.mainSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: P.main, fontSize: 12.5 }}>✦</Text>
    </View>
  );
}

// 루미 해석 말풍선 — 타이핑 후 볼드 렌더로 스왑
function LumiBubbleTyped({
  content,
  active,
  onDone,
}: {
  content: string;
  active: boolean;
  onDone?: () => void;
}) {
  const [typing, setTyping] = useState(active);
  useEffect(() => {
    setTyping(active);
  }, [active]);
  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
      <View
        style={{
          maxWidth: '100%',
          borderRadius: 14,
          borderBottomLeftRadius: 4,
          borderWidth: 1,
          borderColor: P.line,
          backgroundColor: P.beige,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {/* 박스는 항상 전문(굵은 강조 포함)을 즉시 렌더. active면 다음 박스로 넘길 타이머만 돈다. */}
        <BoldText content={content} style={{ color: P.textDark, fontSize: 12.5, lineHeight: 20 }} />
        {typing && (
          <TypedText
            text=""
            active
            onDone={() => {
              setTyping(false);
              onDone?.();
            }}
            style={{ height: 0 }}
          />
        )}
      </View>
    </View>
  );
}

// 안내(틴트) 박스
function NoticeBox({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: P.mainLine,
        backgroundColor: P.mainSoft,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {children}
    </View>
  );
}

// 브랜드 레드 주요 버튼
function BrandButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        backgroundColor: P.main,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ textAlign: 'center', color: P.white, fontSize: 13.5, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: P.mainLine,
        backgroundColor: P.white,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <Text style={{ textAlign: 'center', color: P.main, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// 카드 뒷면(브랜드 레드 그라디언트)
function CardBack({ taken, disabled, onPress }: { taken: boolean; disabled: boolean; onPress: () => void }) {
  const { LinearGradient } = require('expo-linear-gradient');
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 72,
        height: 128,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: taken ? P.line : P.mainDeep,
        opacity: taken ? 0.25 : disabled ? 0.4 : 1,
      }}
    >
      <LinearGradient
        colors={P.cardBack}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <Text style={{ fontSize: 8, color: 'rgba(245,237,233,0.7)' }}>✦</Text>
        <Text style={{ fontSize: 8, letterSpacing: 2, color: P.cream, fontWeight: '800' }}>TAROT</Text>
        <Text style={{ fontSize: 8, color: 'rgba(245,237,233,0.7)' }}>✦</Text>
      </LinearGradient>
    </Pressable>
  );
}

// ── 카드 결과 아이템(헤더 즉시 + 말풍선 순차 타이핑) ──────────────────────────
function CardItem({
  item,
  active,
  onDone,
}: {
  item: Extract<TLItem, { kind: 'card' }>;
  active: boolean;
  onDone: () => void;
}) {
  const total = item.bubbles.length;
  const [bn, setBn] = useState(active ? 1 : total); // 노출된 말풍선 수
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setBn(active ? 1 : total);
  }, [active, total]);

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: P.line,
        backgroundColor: P.card,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: P.main }}>{item.pos}</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: P.textDark }}>{item.name}</Text>
        <Text style={{ fontSize: 10, fontWeight: '600', color: P.main }}>
          {item.upright ? '정방향' : '역방향'}
        </Text>
      </View>
      <View style={{ marginTop: 12 }}>
        {item.bubbles.slice(0, bn).map((b, i) => {
          const isActiveBubble = active && i === bn - 1;
          return (
            <LumiBubbleTyped
              key={b.key}
              content={b.content}
              active={isActiveBubble}
              onDone={
                isActiveBubble
                  ? () => {
                      if (bn < total) setBn(bn + 1);
                      else doneRef.current();
                    }
                  : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}

// 탭 전환/재진입 시 상태 유지 — 이미 본 결과는 타이핑 없이 즉시, 진행 중이면 그 지점까지 기록.
type SavedTarot = {
  timeline: TLItem[];
  shown: number;
  step: Step;
  readingMode: ReadingMode | null;
  deckOrder: TarotCard[];
  picked: Picked[];
};
let savedTarot: SavedTarot | null = null;

function FortuneBody() {
  const [timeline, setTimeline] = useState<TLItem[]>(() => savedTarot?.timeline ?? modeIntroItems());
  const [shown, setShown] = useState(() => savedTarot?.shown ?? 1); // 노출된(=타이핑 시작된) 아이템 수
  const [lastDone, setLastDone] = useState(() =>
    savedTarot ? savedTarot.shown >= savedTarot.timeline.length : false,
  );
  const [step, setStep] = useState<Step>(() => savedTarot?.step ?? 'choose_mode');
  const [readingMode, setReadingMode] = useState<ReadingMode | null>(() => savedTarot?.readingMode ?? null);
  const [deckOrder, setDeckOrder] = useState<TarotCard[]>(() => savedTarot?.deckOrder ?? shuffle(createFullDeck()));
  const [picked, setPicked] = useState<Picked[]>(() => savedTarot?.picked ?? []);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // 복원 경계 — 이 인덱스 미만 아이템은 애니메이션 없이 즉시 렌더(이미 본 것). 리셋 시 0.
  const frozenRef = useRef(savedTarot ? savedTarot.shown : 0);
  const firstShownRun = useRef(true);
  const restoredInProgressRef = useRef(!!savedTarot && savedTarot.shown < savedTarot.timeline.length);

  const scrollRef = useRef<ScrollView>(null);
  const tlRef = useRef(timeline);
  tlRef.current = timeline;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickedIndices = useMemo(() => new Set(picked.map((p) => p.deckIndex)), [picked]);
  const readingTopic = readingMode?.label ?? '';
  const busy = shown < timeline.length || !lastDone;

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);
  // shown이 바뀌면 새 활성 아이템이 타이핑 시작 → lastDone 리셋. 단, 마운트(복원) 첫 실행은 건너뜀.
  useEffect(() => {
    if (firstShownRun.current) { firstShownRun.current = false; return; }
    setLastDone(false);
  }, [shown]);

  // 재진입 복원용 저장
  useEffect(() => {
    savedTarot = { timeline, shown, step, readingMode, deckOrder, picked };
  }, [timeline, shown, step, readingMode, deckOrder, picked]);

  // 복원됐는데 아직 결과를 다 안 봤으면(진행 중) 다음 아이템부터 이어서 타이핑 공개
  useEffect(() => {
    if (restoredInProgressRef.current) {
      setShown((s) => Math.min(s + 1, tlRef.current.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // 현재 활성(마지막) 아이템의 타이핑이 끝나면 다음 아이템으로 진행
  const onActiveDone = useCallback(() => {
    setLastDone(true);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setShown((s) => Math.min(s + 1, tlRef.current.length));
    }, 320);
  }, []);

  // 새 아이템 추가(항상 idle 상태에서만 호출됨 — 버튼이 busy 중 비활성이므로)
  const append = useCallback((items: TLItem[]) => {
    setTimeline((prev) => [...prev, ...items]);
    setShown((s) => s + 1);
  }, []);

  const resetTimeline = useCallback((items: TLItem[]) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    frozenRef.current = 0; // 새 타임라인은 처음부터 타이핑
    setTimeline(items);
    setShown(1);
    setLastDone(false);
  }, []);

  const rewindToModeChoice = useCallback(() => {
    setShareNotice(null);
    setStep('choose_mode');
    setReadingMode(null);
    setPicked([]);
    setDeckOrder(shuffle(createFullDeck()));
    resetTimeline(modeIntroItems());
  }, [resetTimeline]);

  const replaySameMode = useCallback(() => {
    if (!readingMode) return;
    setShareNotice(null);
    setDeckOrder(shuffle(createFullDeck()));
    setPicked([]);
    setStep('pick');
    append([
      {
        id: newId(),
        kind: 'chat',
        role: 'astrologer',
        text: `같은 「${readingMode.label}」으로 덱을 다시 섞었어요. 아래에서 카드 세 장을 새로 뽑아 주세요.`,
      },
    ]);
  }, [readingMode, append]);

  const switchToOtherReadingMode = useCallback(() => {
    if (!readingMode) return;
    setShareNotice(null);
    const next = READING_MODES.find((m) => m.id !== readingMode.id);
    if (!next) return;
    setReadingMode(next);
    setDeckOrder(shuffle(createFullDeck()));
    setPicked([]);
    setStep('pick');
    append([
      { id: newId(), kind: 'chat', role: 'user', text: next.label },
      {
        id: newId(),
        kind: 'chat',
        role: 'astrologer',
        text: `「${next.label}」로 넘어갔어요. 덱을 새로 섞었으니, 뒷면을 세 번 눌러 세 장을 골라 주세요.`,
      },
    ]);
  }, [readingMode, append]);

  const selectMode = useCallback(
    (mode: ReadingMode) => {
      setReadingMode(mode);
      setDeckOrder(shuffle(createFullDeck()));
      setPicked([]);
      setStep('pick');
      append([
        { id: newId(), kind: 'chat', role: 'user', text: mode.label },
        {
          id: newId(),
          kind: 'chat',
          role: 'astrologer',
          text: `「${mode.label}」로 덱을 섞었어요. 항상 세 장을 뽑습니다. 아래 덱에서 손이 가는 카드 뒷면만 차례로 세 번 눌러 주세요. 서두르지 않아도 돼요.`,
        },
      ]);
    },
    [append],
  );

  const onCardClick = useCallback(
    (deckIndex: number, card: TarotCard) => {
      if (!readingMode || step !== 'pick') return;
      if (pickedIndices.has(deckIndex)) return;
      if (picked.length >= THREE_CARD_COUNT) return;
      const upright = Math.random() >= 0.5;
      setPicked((prev) => [...prev, { deckIndex, card, upright }]);
    },
    [readingMode, step, picked.length, pickedIndices],
  );

  const removeLastPick = useCallback(() => setPicked((prev) => prev.slice(0, -1)), []);

  const redrawPicks = useCallback(() => {
    if (!readingMode || step !== 'pick') return;
    setDeckOrder(shuffle(createFullDeck()));
    setPicked([]);
  }, [readingMode, step]);

  const goReveal = useCallback(() => {
    if (!readingMode || picked.length !== THREE_CARD_COUNT) return;
    setStep('reveal');
    const topic = readingMode.label;
    const positions = readingMode.positions;
    const blocks: TLItem[] = [
      {
        id: newId(),
        kind: 'chat',
        role: 'astrologer',
        text: '당신이 고른 세 장을 펼쳐 볼게요. 별빛이 카드와 맞닿는 동안 잠시만 기다려 주세요…',
      },
      {
        id: newId(),
        kind: 'notice',
        text: '제가 가진 카드 풀이로 주제에 맞춰 엮어 말씀드릴게요. 천천히 읽어 보세요.',
      },
    ];
    for (const b of spreadPreambleBubbles(topic, positions)) {
      blocks.push({ id: newId(), kind: 'preamble', text: b.content });
    }
    picked.forEach((p, i) => {
      const pos = positions[i] ?? `위치 ${i + 1}`;
      const bubbles = contextualCardBubbles(
        topic,
        pos,
        p.card.nameKr,
        p.upright,
        p.upright ? p.card.meaningUp : p.card.meaningRev,
      );
      blocks.push({ id: newId(), kind: 'card', pos, name: p.card.nameKr, upright: p.upright, bubbles });
    });
    blocks.push({ id: newId(), kind: 'closing', text: readingClosingAdvice(topic, positions) });
    blocks.push({ id: newId(), kind: 'actions', modeId: readingMode.id });
    append(blocks);
  }, [readingMode, picked, append]);

  const shareReadingResult = useCallback(async () => {
    if (!readingMode || picked.length !== THREE_CARD_COUNT) return;
    setShareNotice(null);
    const lines = picked.map((p, i) => {
      const pos = readingMode.positions[i] ?? `위치 ${i + 1}`;
      const dir = p.upright ? '정방향' : '역방향';
      return `• ${pos} — ${p.card.nameKr} (${dir})`;
    });
    const message = `루미타로 · ${readingMode.label}\n\n${lines.join('\n')}`;
    try {
      await Share.share({ message });
    } catch {
      setShareNotice('공유를 지원하지 않는 환경이에요.');
      setTimeout(() => setShareNotice(null), 2800);
    }
  }, [readingMode, picked]);

  // 타임라인 아이템 렌더
  function renderItem(item: TLItem, index: number) {
    // 복원 경계 미만(이미 본 것)은 즉시 렌더, 그 외 마지막 아이템만 타이핑.
    const active = index === shown - 1 && index >= frozenRef.current;
    const doneCb = active ? onActiveDone : undefined;

    switch (item.kind) {
      case 'chat':
        if (item.role === 'user') {
          return <UserChat key={item.id} text={item.text} active={active} onDone={doneCb} />;
        }
        return (
          <View key={item.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
            <LumiAvatar />
            <View
              style={{
                flex: 1,
                borderRadius: 14,
                borderBottomLeftRadius: 4,
                borderWidth: 1,
                borderColor: P.lineSoft,
                backgroundColor: P.card,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ marginBottom: 4, fontSize: 11, letterSpacing: 2, color: P.main, fontWeight: '800' }}>
                루미
              </Text>
              <TypedText
                text={item.text}
                active={active}
                speed={14}
                onDone={doneCb}
                style={{ color: P.textDark, fontSize: 12.5, lineHeight: 20 }}
              />
            </View>
          </View>
        );
      case 'notice':
        return (
          <View key={item.id} style={{ marginBottom: 12 }}>
            <NoticeBox>
              <TypedText
                text={item.text}
                active={active}
                speed={14}
                onDone={doneCb}
                style={{ textAlign: 'center', fontSize: 12.5, lineHeight: 19, color: P.textDark }}
              />
            </NoticeBox>
          </View>
        );
      case 'preamble':
        return (
          <LumiBubbleTyped key={item.id} content={item.text} active={active} onDone={doneCb} />
        );
      case 'card':
        return (
          <View key={item.id} style={{ marginBottom: 12 }}>
            <CardItem item={item} active={active} onDone={doneCb ?? (() => {})} />
          </View>
        );
      case 'closing':
        return (
          <View key={item.id} style={{ marginBottom: 12 }}>
            <NoticeBox>
              <TypedText
                text={item.text}
                active={active}
                speed={14}
                onDone={doneCb}
                style={{ fontSize: 12.5, lineHeight: 20, color: P.textDark }}
              />
            </NoticeBox>
          </View>
        );
      case 'actions':
        return (
          <ActionsItem
            key={item.id}
            modeId={item.modeId}
            active={active}
            onDone={doneCb}
            onReplay={replaySameMode}
            onSwitch={switchToOtherReadingMode}
            onShare={shareReadingResult}
            shareNotice={shareNotice}
          />
        );
    }
  }

  const visible = timeline.slice(0, shown);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: P.screenBg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
      onContentSizeChange={scrollToEnd}
    >
      {visible.map((item, i) => (
        <Appear key={item.id} animate={i >= frozenRef.current}>
          {renderItem(item, i)}
        </Appear>
      ))}

      {/* 주제 선택 — 인트로 타이핑이 끝난 뒤에만 부드럽게 노출 */}
      {step === 'choose_mode' && !busy && (
        <Appear>
        <View style={{ gap: 12, marginTop: 4 }}>
          {READING_MODES.map((mode) => (
            <Pressable
              key={mode.id}
              onPress={() => selectMode(mode)}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: P.line,
                backgroundColor: P.card,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 16,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: P.textDark }}>{mode.label}</Text>
              <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 19, color: P.textLite }}>
                {mode.description}
              </Text>
            </Pressable>
          ))}
        </View>
        </Appear>
      )}

      {/* 카드 선택 — 안내 타이핑이 끝난 뒤에만 부드럽게 노출 */}
      {step === 'pick' && readingMode && !busy && (
        <Appear>
        <View style={{ gap: 16, marginTop: 4 }}>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: P.line, backgroundColor: P.card, padding: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: P.lineSoft,
                paddingBottom: 12,
              }}
            >
              <Text style={{ fontSize: 9, color: P.textLite }}>선택 주제</Text>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: P.main }}>{readingMode.label}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {readingMode.positions.map((label, i) => {
                const slot = picked[i];
                return (
                  <View
                    key={label}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderStyle: slot ? 'solid' : 'dashed',
                      borderColor: slot ? P.main : P.slotEmpty,
                      backgroundColor: slot ? P.mainSoft : 'transparent',
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: slot ? P.main : P.textLite }}>
                      {label}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: slot ? P.main : P.slotEmpty }}>
                      {slot ? '✓' : '+'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View
              style={{
                marginTop: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: P.line,
                backgroundColor: P.beige,
                padding: 8,
              }}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {deckOrder.map((card, deckIndex) => {
                  const taken = pickedIndices.has(deckIndex);
                  const disabled = taken || picked.length >= THREE_CARD_COUNT;
                  return (
                    <CardBack
                      key={`${card.id}-${deckIndex}`}
                      taken={taken}
                      disabled={disabled}
                      onPress={() => onCardClick(deckIndex, card)}
                    />
                  );
                })}
              </ScrollView>
            </View>

            <Text style={{ marginTop: 16, textAlign: 'center', fontSize: 11.5, color: P.main, fontWeight: '600' }}>
              {picked.length} / {THREE_CARD_COUNT} 장 · 마음 가는 순서대로
            </Text>
            {picked.length > 0 && (
              <Pressable onPress={redrawPicks} style={{ marginTop: 10 }}>
                <Text style={{ textAlign: 'center', fontSize: 12.5, color: P.main, fontWeight: '700' }}>카드 다시 뽑기</Text>
              </Pressable>
            )}
            {picked.length > 0 && picked.length < THREE_CARD_COUNT && (
              <Pressable onPress={removeLastPick} style={{ marginTop: 8 }}>
                <Text style={{ textAlign: 'center', fontSize: 10, color: P.textLite }}>마지막 선택 취소</Text>
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GhostButton label="주제 다시 고르기" onPress={rewindToModeChoice} />
            <BrandButton label="이 카드로 해석 받기" onPress={goReveal} disabled={picked.length !== THREE_CARD_COUNT} />
          </View>
        </View>
        </Appear>
      )}
    </ScrollView>
  );
}

// 사용자 말풍선(즉시 노출 후 다음으로 진행)
function UserChat({ text, active, onDone }: { text: string; active: boolean; onDone?: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => doneRef.current?.(), 160);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
      <View
        style={{
          maxWidth: '88%',
          borderRadius: 14,
          borderBottomRightRadius: 4,
          backgroundColor: P.main,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: P.white, fontSize: 12.5, lineHeight: 20, fontWeight: '600' }}>{text}</Text>
      </View>
    </View>
  );
}

// 결과 마무리 액션(다시 보기 / 반대 모드 / 공유) — 즉시 노출
function ActionsItem({
  modeId,
  active,
  onDone,
  onReplay,
  onSwitch,
  onShare,
  shareNotice,
}: {
  modeId: string;
  active: boolean;
  onDone?: () => void;
  onReplay: () => void;
  onSwitch: () => void;
  onShare: () => void;
  shareNotice: string | null;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => doneRef.current?.(), 160);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <View style={{ gap: 16, marginTop: 4, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <LumiAvatar />
        <View
          style={{
            flex: 1,
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            borderWidth: 1,
            borderColor: P.lineSoft,
            backgroundColor: P.card,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text style={{ marginBottom: 4, fontSize: 11, letterSpacing: 2, color: P.main, fontWeight: '800' }}>루미</Text>
          <Text style={{ fontSize: 12.5, lineHeight: 20, color: P.textDark }}>풀이를 마쳤어요. 이어서 무엇을 할까요?</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <GhostButton label="다시 보기" onPress={onReplay} />
            <BrandButton label={modeId === 'daily' ? '오늘의 연애운 보기' : '오늘의 운세 보기'} onPress={onSwitch} />
          </View>
        </View>
      </View>
      <View>
        <Pressable
          onPress={onShare}
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: P.mainLine,
            backgroundColor: P.white,
            paddingHorizontal: 12,
            paddingVertical: 13,
          }}
        >
          <Text style={{ textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: P.main }}>결과 공유하기</Text>
        </Pressable>
        {shareNotice && (
          <Text style={{ marginTop: 8, fontSize: 11, lineHeight: 16, color: P.textSub }}>{shareNotice}</Text>
        )}
      </View>
    </View>
  );
}

// hideHeader: Home 상단 토글 안에 임베드될 때 자체 NavBar를 숨김(이중 헤더 방지)
export function FortuneScreen({
  onOpenNotif,
  hideHeader,
}: {
  onOpenNotif?: () => void;
  hideHeader?: boolean;
}) {
  const unread = usePreview(previewSelectors.unreadCount);

  return (
    <View style={{ flex: 1, backgroundColor: P.screenBg }}>
      {!hideHeader && (
        <NavBar
          title="오늘의 운세"
          right={
            <Pressable accessibilityRole="button" accessibilityLabel="알림" hitSlop={8} onPress={onOpenNotif}>
              <Icons.bell size={22} color={P.textDark} />
              {unread > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    minWidth: 14,
                    height: 14,
                    paddingHorizontal: 3,
                    borderRadius: 7,
                    backgroundColor: P.error,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </Pressable>
          }
        />
      )}
      <FortuneBody />
    </View>
  );
}
