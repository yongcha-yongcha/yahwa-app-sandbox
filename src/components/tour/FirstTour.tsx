// 야화 — 탭 첫 방문 안내 화면(시안 1022 .first-tour)
// 화면 전체를 어둡게(#191e23cc) 덮고 대상만 둥근 구멍 + 흰 테두리로 남긴 뒤, 위나 아래에 화살표 · 단계 · 제목 · 설명 · 버튼을 띄운다.
// · 대상(구멍)을 누르면 실제 동작 대신 다음 단계로 넘어간다 — 안내 중에는 편지 전송·리프 사용이 일어나지 않는다.
// · 휴대폰 보정(대표 지시): 글 상자는 안전 영역·하단 탭바 안쪽에 머물고, 공간이 모자라면 대상의 반대쪽으로 옮긴다.
//   화살표는 글 상자 안에서만 움직이고, 구멍은 화면 밖으로 나가지 않는다.
import { pressFx } from '../../lib/press';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Platform, useWindowDimensions, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { measureTourTarget, type Rect, type TourTargetId } from './tourTargets';
import type { TourTab } from '../../lib/tabGuides';
import { colors, getThemeMode } from '../../tokens';

const DIM = 'rgba(25,30,35,0.8)';      // --ds-tour-dim #191e23cc
const CHIP = '#4b5056';                // --ds-nav-active
const LS = -0.24;
// 제목·설명은 낱말 단위로 줄을 바꾼다(시안 word-break: keep-all) — 웹은 CSS, iOS는 한글 낱말 우선
const KEEP_ALL = (Platform.OS === 'web' ? { wordBreak: 'keep-all' } : {}) as object;

// 강조 테두리 둥글기 — 시안이 대상 요소의 둥글기를 그대로 쓴다(실측)
const TARGET_RADIUS: Record<TourTargetId, number | 'round'> = {
  'profile.card': 22, 'profile.like': 'round', 'profile.letter': 'round', 'community.write': 18, 'place.search': 16, 'my.shortcuts': 12,
};
const TARGET: Record<TourTab, TourTargetId[]> = {
  profile: ['profile.card', 'profile.like', 'profile.letter'],
  community: ['community.write'],
  place: ['place.search'],
  my: ['my.shortcuts'],
};
const COPY: Record<Exclude<TourTab, 'profile'>, [string, string, string]> = {
  community: ['커뮤니티', '익명으로 일상을 나눠보세요.', '글을 읽고 하트·댓글로 공감하거나, 글쓰기로 이야기를 남겨보세요.'],
  place: ['플레이스', '가까운 매장과 혜택을 찾아보세요.', '지도에서 매장을 고르고, 이용할 수 있는 혜택과 쿠폰을 확인해보세요.'],
  my: ['MY', '내 프로필과 혜택을 한곳에서.', '프로필을 관리하고 리프·포인트·쿠폰을 확인해보세요.'],
};
const PROFILE_TITLE = ['사진을 눌러 오늘의 인연을 만나보세요.', '마음에 들면 호감을 보내보세요.', '더 알아가고 싶다면 편지를 보내보세요.'];
const PROFILE_BODY = ['시간이 표시된 카드는 해당 시간에 열려요. 사진을 누르면 프로필을 확인할 수 있어요.', '하루 두 분까지, 호감을 보내면 리프가 쌓여요.', '안내 중에는 편지가 전송되거나 리프가 사용되지 않아요.'];
const PROFILE_LABEL = ['사진 열고 다음 안내 보기', '호감 안내 확인, 다음', '편지 안내 확인, 시작하기'];

// 둥근 사각형 구멍 경로(짝홀 규칙으로 바깥만 칠한다)
function holePath(W: number, H: number, r: Rect, rad: number) {
  const { x, y, w, h } = r;
  const k = Math.min(rad, w / 2, h / 2);
  return `M0 0H${W}V${H}H0Z M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

export function FirstTour({ tab, step, onNext, onClose }: { tab: TourTab; step: number; onNext: () => void; onClose: () => void }) {
  const win = useWindowDimensions();
  // 웹: 화면 밖으로 조금 넘친 요소가 있으면 window 크기(=고정 레이어 크기)가 보이는 화면보다 커진다.
  // 안내는 실제 보이는 영역(documentElement.clientWidth/Height)에 맞춰 깐다 — 오른쪽·아래 기준 위치가 밀리지 않게
  // 폭은 앱 기둥(body, 넓은 화면에선 430으로 가운데) 기준 — 고정 레이어가 body 안에 깔려 창 폭을 쓰면 오른쪽으로 넘친다
  const doc = Platform.OS === 'web' && typeof document !== 'undefined' ? document.documentElement : null;
  const W = (doc && document.body?.clientWidth) || doc?.clientWidth || win.width;
  const H = doc?.clientHeight || win.height;
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [copyH, setCopyH] = useState(0);
  const isProfile = tab === 'profile';
  const targetId = TARGET[tab][isProfile ? step : 0];

  // 대상 위치 — 안내 화면 자체의 원점을 함께 재서 빼므로 상태 표시줄·창 좌표 차이와 무관하다(시안처럼 0.12초마다 다시 잰다)
  const measure = useCallback(async () => {
    const t = await measureTourTarget(targetId);
    const root: any = rootRef.current;
    if (!t || !root?.measureInWindow) { setRect(null); return; }
    root.measureInWindow((ox: number, oy: number) => {
      const next = { x: t.x - ox, y: t.y - oy, w: t.w, h: t.h };
      setRect((p) => (p && Math.abs(p.x - next.x) < 0.5 && Math.abs(p.y - next.y) < 0.5 && Math.abs(p.w - next.w) < 0.5 && Math.abs(p.h - next.h) < 0.5 ? p : next));
    });
  }, [targetId]);
  useEffect(() => {
    setRect(null);
    void measure();
    const id = setInterval(() => { void measure(); }, 120);
    return () => clearInterval(id);
  }, [measure]);

  const title = isProfile ? PROFILE_TITLE[step] : COPY[tab][1];
  useEffect(() => { AccessibilityInfo.announceForAccessibility?.(title); }, [title]);

  // 강조 — 시안 1027 .tour-target: 대상 크기 그대로 · 테두리 1 흰색 · 둥글기는 대상의 둥글기(원형 버튼은 원)
  const hole = rect && { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  const r0 = TARGET_RADIUS[targetId];
  const rad = hole ? (r0 === 'round' ? Math.min(hole.w, hole.h) / 2 : r0) : 12;

  // 글 카드 — 시안 1027: 흰 카드(좌우 16 · 안 20 · 둥글기 20). 대상 아래 공간이 카드+24보다 넓으면 아래(대상 아래 16), 아니면 위(대상 위 16).
  // 위치는 위 60 ~ 아래(높이 − 카드 − 16) 안으로 맞춘다(안전 영역 포함).
  const side = 16;
  const ch = copyH || 210;
  let below = true;
  let top = Math.max(insets.top + 60, H * 0.3);
  if (rect) {
    below = H - (rect.y + rect.h) > ch + 24;
    top = Math.max(insets.top + 60, Math.min(H - insets.bottom - ch - 16, below ? rect.y + rect.h + 16 : rect.y - ch - 16));
  }
  const dark = getThemeMode() === 'dark';

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View ref={rootRef} style={Platform.OS === 'web' ? { position: 'absolute', left: 0, top: 0, width: W, height: H } : { flex: 1 }} accessibilityViewIsModal>
        {/* 어둡게 + 구멍 */}
        <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Path d={hole ? holePath(W, H, hole, rad) : `M0 0H${W}V${H}H0Z`} fill={DIM} fillRule="evenodd" />
        </Svg>
        {/* 구멍 밖을 눌러도 아래 화면이 반응하지 않게 막는다 */}
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />

        {/* 대상 — 흰 테두리 2 · 누르면 다음(실제 동작 없음) */}
        {hole && (
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={isProfile ? PROFILE_LABEL[step] : '안내 확인'}
            style={({ pressed }) => ({
              position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h,
              borderRadius: rad, borderWidth: 1, borderColor: '#fff',
              alignItems: 'center', justifyContent: 'center', ...pressFx(pressed),
              // 웹 기본 파란 포커스 테두리 대신 흰 테두리만(시안 focus-visible도 흰색)
              ...(Platform.OS === 'web' ? ({ outlineColor: '#fff', outlineOffset: 2 } as object) : null),
            })}
          >
          </Pressable>
        )}

        {/* 건너뛰기 — 오른쪽 위(안전 영역 아래 8) */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => ({
            position: 'absolute', top: insets.top + 8, right: 16, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12,
            borderRadius: 12, backgroundColor: CHIP, justifyContent: 'center', ...pressFx(pressed),
          })}
        >
          <Text style={{ fontSize: 13, lineHeight: 21.45, color: '#fff', letterSpacing: LS }}>건너뛰기</Text>
        </Pressable>

        {/* 글 카드(시안 1027 .tour-copy) — 단계 12/600(16px 줄 26.4 안) · 제목 19/26.6 650(위 8) · 설명 14/23.8 회색(위 8) · 버튼(위 18, 꽉 찬 폭 48) */}
        <View
          pointerEvents="box-none"
          onLayout={(e) => setCopyH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute', left: side, right: side, top, maxHeight: Math.max(120, H - 88),
            padding: 20, borderRadius: 20, backgroundColor: colors.surface,
            boxShadow: '0px 18px 60px rgba(36,30,48,0.12)', opacity: copyH ? 1 : 0,
          }}
        >
          <Text style={{ fontSize: 16, lineHeight: 26.39, letterSpacing: LS }}>
            {/* 시안은 단계 표시를 흰색으로 둔다(카드 위에서는 보이지 않음) — 그대로 따른다 */}
            <Text style={{ fontSize: 12, lineHeight: 19.8, fontWeight: '600', color: '#fff', letterSpacing: LS }}>{isProfile ? `${step + 1} / 3` : COPY[tab][0]}</Text>
          </Text>
          <Text accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={[{ marginTop: 8, fontSize: 19, lineHeight: 26.59, fontWeight: '650' as any, color: colors.text, letterSpacing: -0.57 }, KEEP_ALL]}>{title}</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 23.8, color: colors.sub, letterSpacing: LS }}>{isProfile ? PROFILE_BODY[step] : COPY[tab][2]}</Text>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 18, height: 48, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14,
              backgroundColor: dark ? colors.bgSoft : '#f1f2f3', alignItems: 'center', justifyContent: 'center', ...pressFx(pressed),
            })}
          >
            <Text style={{ fontSize: 13, lineHeight: 21.45, fontWeight: '700', color: dark ? colors.text : '#42474d', letterSpacing: LS }}>
              {isProfile ? (step === 2 ? '시작하기' : '다음') : '확인했어요'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
