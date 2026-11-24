// 야화 — 첫 화면(리뉴얼 1120, spec-shell §4.1 · §4.2 · §3-1 j·k · §3-2)
// Splash(시안 S1 · 2026-11-21): 흰 바탕 + 웰컴과 같은 사진 · 문구 · 로고 · 하트. 0.4초 옅게 나타나며 사진만 1.11배 → 1로 0.95초 줌 아웃.
//   웰컴은 이어서 사진이 스플래시 크기(122%)에서 웰컴 크기(116%)로 살짝 줄고(위 가운데 기준) 아래 시트가 올라온다 — 문구 · 로고 · 하트는 제자리.
// GuestStart: 비로그인 첫 실행의 웰컴 ↔ 시작(가입·로그인) 한 벌. 웰컴에서 '먼저 둘러볼게요'로 게스트 탭에 들어간다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ease, fontSerif, palette } from '../tokens';
import { Button, NATIVE, reduceMotion } from '../ui';
import { Login } from './Login';
import { useBackOverride } from '../lib/backHandler';

// 웹은 public/boot의 WebP(사진 225KB → 60KB)를 쓴다 — public/index.html의 첫 장면(boot)이 미리 받아 둔 것과 같은 파일이라 다시 받지 않는다
const WEB = Platform.OS === 'web';
const LOGO_SCRIPT = WEB ? { uri: '/boot/logo-script.webp' } : require('../../assets/renewal/logo-script.png');
const HEART = WEB ? { uri: '/boot/heart-tilt.webp' } : require('../../assets/renewal/heart-tilt.png');
const PHOTO = WEB ? { uri: '/boot/welcome-sky.webp' } : require('../../assets/renewal/welcome-sky.jpg');   // 하늘 아래 마주 보는 커플(시안 11-20 교체, 937 × 1679)
// 웹 첫 화면의 HTML 스플래시(public/index.html #boot) — React 스플래시가 그 위에 옅게 나타난 뒤 치운다
const bootEl = () => (WEB && typeof document !== 'undefined' ? document.getElementById('boot') : null);
const SKY_RATIO = 1679 / 937;
const SKY_TOP = '#A2C5E0';   // 사진 맨 위 하늘색(사진에서 잰 값) — 묶음을 내렸을 때 위 빈자리를 채운다

// 문구 · 로고 겹침 방지 — 문구는 안전 영역 아래 51(두 줄 높이 76), 로고 글자 꼭대기는 설계 129 + 글자 안쪽 여백(이미지 높이 199.5의 13.5%)
// 문구는 상태 표시줄 높이만큼 내려가는데 로고는 설계 판 좌표라서, 다이내믹 아일랜드 · 짧은 화면에서 겹쳤다(11-22 아이폰 17 Pro 약 20pt).
// 1) 문구 위 여백을 51 → 24까지 줄이고 2) 그래도 모자라면 사진 · 로고 · 하트 묶음을 통째로 내린다(하트와 두 사람 사이 자리는 그대로)
const HEAD_TOP = 51, HEAD_TOP_MIN = 24, HEAD_H = 76, HEAD_GAP = 16;
const LOGO_INK_TOP = 129 + 199.5 * 0.135;

// 웰컴 · 스플래시 공용 묶음 — 설계 360 × 596을 화면을 덮도록 같은 비율로 키워 가운데에 둔다(로고 · 하트가 사진 속 같은 자리)
// 스플래시도 웰컴과 같은 값을 써서(아래 시트 자리 포함) 넘어갈 때 사진 · 문구 · 로고가 제자리에 있다
function useStage() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetH = 188 + insets.bottom;
  const visualH = H - (sheetH - 4);
  const k = Math.max(W / 360, visualH / 596);
  const baseTop = (visualH - 596 * k) / 2;
  let headTop = insets.top + HEAD_TOP;
  let over = headTop + HEAD_H + HEAD_GAP - (baseTop + LOGO_INK_TOP * k);
  const lift = Math.min(Math.max(over, 0), HEAD_TOP - HEAD_TOP_MIN);
  headTop -= lift;
  over -= lift;
  const drop = Math.max(0, over);
  return { W, H, insets, sheetH, k, stageLeft: (W - 360 * k) / 2, stageTop: baseTop + drop, headTop, drop };
}

// 묶음을 내렸을 때 — 위 빈자리를 사진 맨 위 하늘색으로 채운다(사진 윗단 이음새는 묶음 안 SkyEdge가 사진 위에서 덮는다)
function SkyFill({ top, drop }: { top: number; drop: number }) {
  if (drop <= 0) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, top) + 1, backgroundColor: SKY_TOP }} />;
}
function SkyEdge({ drop }: { drop: number }) {
  if (drop <= 0) return null;
  return <LinearGradient pointerEvents="none" colors={[SKY_TOP, 'rgba(162,197,224,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 40 }} />;
}
// 사진 자리 — 웰컴 116%(왼쪽 −8%) · 스플래시 122%(왼쪽 −11%, 아래 시트가 없어 조금 크게). 위에 붙이고 높이는 사진 비율대로
function skyRect(k: number, splash: boolean) {
  const w = (splash ? 439.2 : 417.6) * k;
  return { position: 'absolute' as const, left: (splash ? -39.6 : -28.8) * k, top: 0, width: w, height: w * SKY_RATIO };
}
// 사진 묶음의 기준점(가로 108 · 세로 282.2)을 중심으로 키우는 이동량
const OX = 108 - 180, OY = 282.2 - 298;
const HEAD = { fontFamily: fontSerif, fontSize: 23, lineHeight: 37.95, letterSpacing: -0.8, color: colors.inverse, textAlign: 'center', textShadowColor: 'rgba(57,68,77,0.125)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12 } as const;
// 명조에 기울임 글꼴이 없어 브라우저는 스스로 기울여 그린다(약 14°) — 앱은 줄마다 기울인다
const SLANT = Platform.OS === 'web' ? ({ fontStyle: 'italic' } as const) : { transform: [{ skewX: '-14deg' }] };
function Headline() {
  return (
    <View accessibilityRole="header" accessibilityLabel="좋은 인연의 시작은 생각보다 평범한 순간에 있으니까.">
      <Text style={[HEAD, SLANT]}>좋은 인연의 시작은 생각보다</Text>
      <Text style={[HEAD, SLANT]}>평범한 순간에 있으니까.</Text>
    </View>
  );
}

export function Splash() {
  const { H, k, stageLeft, stageTop, headTop, drop } = useStage();
  const still = reduceMotion();
  const o = useRef(new Animated.Value(still ? 1 : 0)).current;
  const z = useRef(new Animated.Value(still ? 1 : 0)).current;
  // 웹: HTML 스플래시(boot)가 같은 첫 장면을 이미 그려 두었으면 — 이 화면의 사진 · 로고 · 하트가 다 그려질 때까지(늦어도 0.8초) boot를 덮어 둔 채 기다렸다가
  // boot를 치우고 그때부터 줌을 시작한다(같은 1.11배 장면이라 이음새가 안 보인다). 옅게 나타나기는 boot에 없는 문구만.
  const [boot] = useState(() => !!bootEl());
  const [ready, setReady] = useState(!boot);
  const loaded = useRef(0);
  const onImg = boot ? () => { loaded.current += 1; if (loaded.current >= 3) setReady(true); } : undefined;
  useEffect(() => {
    if (!boot) return;
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, [boot]);
  useEffect(() => {
    if (!ready) return;
    let id = 0;
    if (boot) id = requestAnimationFrame(() => { id = requestAnimationFrame(() => bootEl()?.remove()); });
    if (!still) {
      Animated.timing(o, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: NATIVE }).start();
      Animated.timing(z, { toValue: 1, duration: 950, easing: Easing.bezier(0.33, 1, 0.68, 1), useNativeDriver: NATIVE }).start();
    }
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const zoom = z.interpolate({ inputRange: [0, 1], outputRange: [1.11, 1] });
  const shift = (v: number) => Animated.multiply(Animated.subtract(1, zoom), v);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: boot ? 1 : o }]}>
        <LinearGradient colors={[palette.sky[300], colors.line]} locations={[0, 220 / H]} style={StyleSheet.absoluteFill} />
        <SkyFill top={stageTop} drop={drop} />
        <View style={{ position: 'absolute', left: stageLeft, top: stageTop, width: 360 * k, height: 596 * k }}>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 360 * k, height: 596 * k, transform: [{ translateX: shift(OX * k) }, { translateY: shift(OY * k) }, { scale: zoom }] }}>
            <Image source={PHOTO} accessibilityLabel="푸른 하늘 아래 마주 보며 웃는 두 사람" resizeMode="cover" onLoad={onImg} style={skyRect(k, true)} />
          </Animated.View>
          <SkyEdge drop={drop} />
          <Image source={LOGO_SCRIPT} accessibilityLabel="야화" resizeMode="contain" onLoad={onImg} style={{ position: 'absolute', left: 3 * k, top: 129 * k, width: 345 * k, height: 199.5 * k, tintColor: colors.inverse }} />
          <Image source={HEART} accessibilityElementsHidden resizeMode="stretch" onLoad={onImg} style={{ position: 'absolute', left: 157 * k, top: 358 * k, width: 57 * k, height: 65 * k, tintColor: colors.inverse }} />
        </View>
        <Animated.View style={{ position: 'absolute', left: 16, right: 16, top: headTop, opacity: boot ? o : 1 }}><Headline /></Animated.View>
      </Animated.View>
    </View>
  );
}

// 하나씩 나타남 — opacity 0 → 1 + translateY rise → 0
function Appear({ delay, ms, rise = 8, on, style, children }: { delay: number; ms: number; rise?: number; on: boolean; style?: any; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) return;
    const still = reduceMotion();
    Animated.timing(v, { toValue: 1, duration: still ? 300 : ms, delay: still ? 0 : delay, easing: ease.out, useNativeDriver: NATIVE }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion() ? 0 : rise, 0] }) }] }]}>{children}</Animated.View>
  );
}

// 웰컴 아래 글자 버튼(시안 welcome-links B안, 11-22) — 밑줄 없이 13/500, 누르는 칸 44
function SheetLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={{ left: 8, right: 8 }} style={{ minHeight: 44, justifyContent: 'center' }}>
      {({ pressed }) => <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: pressed ? colors.text : colors.textSecondary }}>{label}</Text>}
    </Pressable>
  );
}

// enter: first = 스플래시에서 들어옴(시안 S1: 스플래시 모션을 이어 받는다) · back = 시작 화면에서 돌아옴(§3-1 k, 진입 모션은 다시 재생하지 않는다)
function Welcome({ enter, leave, zoomOut, onStart, onBrowse }: { enter: 'first' | 'back'; leave: Animated.Value; zoomOut: Animated.Value; onStart: () => void; onBrowse: () => void }) {
  const { H, sheetH, k, stageLeft, stageTop, headTop, drop } = useStage();
  const first = enter === 'first';
  const still = reduceMotion();

  // 스플래시에서 이어짐: 사진 · 문구 · 로고 · 하트가 이미 보이고, 사진만 스플래시 크기(122%)에서 웰컴 크기(116%)로 줄며(위 가운데 기준) 시트가 올라온다
  const settle = useRef(new Animated.Value(first && !still ? 0 : 1)).current;
  const sheet = useRef(new Animated.Value(first && !still ? 0 : 1)).current;
  const back = useRef(new Animated.Value(first || still ? 1 : 0)).current;      // 돌아올 때 사진 1.04 → 1
  useEffect(() => {
    if (first) {
      if (!still) {
        Animated.timing(settle, { toValue: 1, duration: 500, easing: ease.drawer, useNativeDriver: NATIVE }).start();
        Animated.timing(sheet, { toValue: 1, duration: 500, easing: ease.drawer, useNativeDriver: NATIVE }).start();
      }
    } else if (!still) {
      Animated.timing(back, { toValue: 1, duration: 700, easing: ease.out, useNativeDriver: NATIVE }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 기준점(사진 틀의 가로 30% · 세로 47%)을 중심으로 키운다
  const zoom = Animated.multiply(back.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] }), zoomOut.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }));
  const shift = (o: number) => Animated.multiply(Animated.subtract(1, zoom), o);
  const photo = skyRect(k, false);
  const settleScale = settle.interpolate({ inputRange: [0, 1], outputRange: [439.2 / 417.6, 1] });
  // 문구 → 로고 → 하트: 처음(스플래시에서)은 이미 보이고, 돌아올 때는 220ms부터 50 간격 / 시트 안 3개는 시트와 함께
  const t = (i: number) => 220 + i * 50;
  const ts = (i: number) => (first ? 60 + i * 50 : 220 + (3 + i) * 50);
  const ms = 400;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <LinearGradient colors={[palette.sky[300], colors.line]} locations={[0, 220 / H]} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <SkyFill top={stageTop} drop={drop} />
        <View style={{ position: 'absolute', left: stageLeft, top: stageTop, width: 360 * k, height: 596 * k }}>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 360 * k, height: 596 * k, transform: [{ translateX: shift(OX * k) }, { translateY: shift(OY * k) }, { scale: zoom }] }}>
            <Animated.View style={[photo, { transform: [{ translateY: Animated.multiply(Animated.subtract(settleScale, 1), photo.height / 2) }, { scale: settleScale }] }]}>
              <Image source={PHOTO} accessibilityLabel="푸른 하늘 아래 마주 보며 웃는 두 사람" resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </Animated.View>
          </Animated.View>
          <SkyEdge drop={drop} />
          <Appear on={!first} delay={t(1)} ms={ms} style={{ position: 'absolute', left: 3 * k, top: 129 * k }}>
            <Image source={LOGO_SCRIPT} accessibilityLabel="야화" resizeMode="contain" style={{ width: 345 * k, height: 199.5 * k, tintColor: colors.inverse }} />
          </Appear>
          <Appear on={!first} delay={t(2)} ms={ms} style={{ position: 'absolute', left: 157 * k, top: 358 * k }}>
            {/* 시안에서 보이는 그대로: 57 × 65로 늘려 그리고 기울이지 않는다(떠오르는 모션이 회전을 덮어쓴 결과) */}
            <Image source={HEART} accessibilityElementsHidden resizeMode="stretch" style={{ width: 57 * k, height: 65 * k, tintColor: colors.inverse }} />
          </Appear>
        </View>
        <Appear on={!first} delay={t(0)} ms={ms} style={{ position: 'absolute', left: 16, right: 16, top: headTop }}>
          <Headline />
        </Appear>
      </View>

      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetH, paddingTop: 24, paddingHorizontal: 20,
          borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.paper,
          transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }) }],
        }}
      >
        <Animated.View style={{ opacity: leave.interpolate({ inputRange: [0, 0.54, 1], outputRange: [1, 0, 0] }) }}>
          <Appear on delay={ts(0)} ms={400}>
            <Text style={{ fontSize: 9, lineHeight: 11, letterSpacing: 2.8, color: colors.accentMuted, textAlign: 'center', marginBottom: 16 }}>THE FIRST FRAME</Text>
          </Appear>
          <Appear on delay={ts(1)} ms={400}>
            <Button label="우리의 첫 장면 시작하기" size="welcome" onPress={onStart} />
          </Appear>
          {/* 로그인 | 먼저 둘러볼게요 — 가운데 한 줄, 사이 얇은 세로선(로그인은 주 버튼과 같은 시작 화면으로) */}
          <Appear on delay={ts(2)} ms={400} style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <SheetLink label="로그인" onPress={onStart} />
            <View style={{ width: 1, height: 12, marginHorizontal: 16, backgroundColor: colors.lineControl }} />
            <SheetLink label="먼저 둘러볼게요" onPress={onBrowse} />
          </Appear>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// start: welcome = 첫 실행 웰컴부터 · auth = 둘러보다가 로그인 유도로 열린 시작 화면
// onBrowse: 웰컴의 '먼저 둘러볼게요' / onCloseAuth: 로그인 유도로 열린 시작 화면의 뒤로(웰컴 없이 연 경우)
export function GuestStart({ start, onBrowse, onCloseAuth }: { start: 'welcome' | 'auth'; onBrowse: () => void; onCloseAuth: () => void }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'welcome' | 'toAuth' | 'auth' | 'toWelcome'>(start);
  const [enter, setEnter] = useState<'first' | 'back'>('first');
  const leave = useRef(new Animated.Value(0)).current;      // 웰컴이 나가는 정도 0 → 1
  const authOut = useRef(new Animated.Value(1)).current;    // 시작 화면 내용(돌아갈 때 100ms로 사라짐)
  const zoomOut = useRef(new Animated.Value(0)).current;    // 웰컴 사진이 나가며 1.04배로
  const fromWelcome = start === 'welcome';

  function goAuth() {
    if (phase !== 'welcome') return;
    authOut.setValue(1);
    setPhase('toAuth');
    Animated.timing(zoomOut, { toValue: 1, duration: reduceMotion() ? 0 : 260, easing: ease.out, useNativeDriver: NATIVE }).start();
    Animated.timing(leave, { toValue: 1, duration: reduceMotion() ? 0 : 260, easing: ease.out, useNativeDriver: NATIVE }).start(() => setPhase('auth'));
  }
  function goWelcome() {
    if (phase !== 'auth') return;
    setEnter('back');
    zoomOut.setValue(0);
    setPhase('toWelcome');
    const still = reduceMotion();
    Animated.timing(authOut, { toValue: 0, duration: still ? 0 : 100, easing: ease.out, useNativeDriver: NATIVE }).start();
    Animated.timing(leave, { toValue: 0, duration: still ? 0 : 320, delay: still ? 0 : 100, easing: ease.out, useNativeDriver: NATIVE }).start(() => setPhase('welcome'));
  }
  // 안드로이드 · 웹 뒤로 — 웰컴에서는 기본 동작(앱 닫기), 시작 화면의 뒤로는 Login이 맡는다
  useBackOverride(() => phase === 'toAuth' || phase === 'toWelcome');

  const showAuth = phase !== 'welcome';
  const showWelcome = phase !== 'auth';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showAuth && (
        <Animated.View style={{ flex: 1, paddingTop: insets.top, opacity: authOut }}>
          <Login onBack={fromWelcome ? goWelcome : onCloseAuth} enterDelay={phase === 'toAuth' ? 200 : 100} />
        </Animated.View>
      )}
      {showWelcome && (
        <Animated.View
          pointerEvents={phase === 'welcome' ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { opacity: leave.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) }]}
        >
          <Welcome key={enter} enter={enter} leave={leave} zoomOut={zoomOut} onStart={goAuth} onBrowse={onBrowse} />
        </Animated.View>
      )}
    </View>
  );
}
