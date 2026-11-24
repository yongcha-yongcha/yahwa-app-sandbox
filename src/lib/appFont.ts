// 야화 — 앱 전체 글꼴 Pretendard (대표 지시 1013: 디자인 시안 사이트와 폰트까지 동일하게).
//
// · 웹: 시안과 같은 Pretendard Variable(woff2, public/fonts — core·rest로 나눔)을 @font-face(public/index.html)로 올리고 모든 글자에 적용한다.
//   가변 폰트라 시안의 650 같은 굵기도 그대로 나온다.
// · 앱(iOS·Android): 시안 굵기 9단계에 맞춘 정적 글꼴(아래 FONT_FILES)을 expo-font로 올리고,
//   react-native의 Text·TextInput을 굵기에 맞는 글꼴을 고르는 래퍼로 바꿔 끼운다.
//   글 안에 끼운 Text는 굵기를 따로 주지 않으면 부모 굵기를 물려받는다(앱 기본 동작과 같게).
//   (화면마다 fontFamily를 적지 않아도 기존 fontWeight가 그대로 Pretendard 굵기로 바뀐다.
//    안드로이드는 fontFamily와 fontWeight를 같이 주면 가짜 굵게가 겹치므로 fontWeight는 normal로 둔다.)
// 글꼴 로딩 전에는 바꿔 끼우지 않는다 — 없는 글꼴 이름을 쓰면 iOS가 경고를 띄운다.
//
// 리뉴얼(1120) — 제목은 고운바탕(명조) Bold(11-22 Regular → Bold). 화면은 fontFamily: fontSerif(tokens)만 주면 된다(명조는 이 굵기 하나).
// · 앱: FONT_FILES에 같이 올린다. 명조 글자는 Pretendard 굵기 고르기를 건너뛰고, 세로 위치 보정은 고운바탕 높이로 따로 계산한다(Bold도 Regular와 높이값이 같다).
//   명조 Text 안에 끼운 Text는 글꼴을 따로 안 주면 명조를 물려받는다.
// · 웹: public/fonts/GowunBatang-Bold-core·rest.woff2(자주 쓰는 글자 · 나머지로 나눔)를 @font-face(public/index.html)로 올리고, 글꼴을 직접 지정한 글자는 전역 Pretendard 덮어쓰기에서 뺀다.
import React from 'react';
import { PixelRatio, Platform, StyleSheet } from 'react-native';

// 맥 화면(시안 확인 환경)은 글자를 그릴 때 획을 조금 두껍게 칠한다(글꼴 다듬기). 휴대폰은 그러지 않아 같은 굵기가 얇아 보인다.
// 그래서 앱은 시안 굵기보다 90 굵은 정적 글꼴을 쓴다 — 크롬에서 칠하기 켠/끈 잉크 양을 실측해 맞춘 값(1016):
// 300→390 · 400→490 · 450→540 · 500→590 · 550→640 · 600→690 · 650→740 · 700→790 · 800→890 (글자 크기 12~26 모두 같음).
// 모두 Pretendard Variable에서 뽑은 정적 글꼴이고, 390은 기호(× ＋ ‹)용 부분 글꼴(한글 없음)이다.
export const FONT_FILES = {
  'Pretendard-W390': require('../../assets/fonts/Pretendard-W390.ttf'),
  'Pretendard-W490': require('../../assets/fonts/Pretendard-W490.ttf'),
  'Pretendard-W540': require('../../assets/fonts/Pretendard-W540.ttf'),
  'Pretendard-W590': require('../../assets/fonts/Pretendard-W590.ttf'),
  'Pretendard-W640': require('../../assets/fonts/Pretendard-W640.ttf'),
  'Pretendard-W690': require('../../assets/fonts/Pretendard-W690.ttf'),
  'Pretendard-W740': require('../../assets/fonts/Pretendard-W740.ttf'),
  'Pretendard-W790': require('../../assets/fonts/Pretendard-W790.ttf'),
  'Pretendard-W890': require('../../assets/fonts/Pretendard-W890.ttf'),
  // 고운바탕(OFL) — 글꼴 이름은 파일의 PostScript 이름과 같게(iOS)
  'GowunBatang-Bold': require('../../assets/fonts/GowunBatang-Bold.ttf'),
};
export const SERIF = 'GowunBatang-Bold';
// 시안 굵기 → 글꼴(가장 가까운 것, 같으면 굵은 쪽)
const WEIGHTS: [number, string][] = [
  [300, 'Pretendard-W390'], [400, 'Pretendard-W490'], [450, 'Pretendard-W540'], [500, 'Pretendard-W590'], [550, 'Pretendard-W640'],
  [600, 'Pretendard-W690'], [650, 'Pretendard-W740'], [700, 'Pretendard-W790'], [800, 'Pretendard-W890'],
];

function familyFor(weight: unknown): string {
  const n = weight === 'bold' ? 700 : weight == null || weight === 'normal' ? 400 : parseInt(String(weight), 10) || 400;
  let best = WEIGHTS[1];
  for (const w of WEIGHTS) if (Math.abs(w[0] - n) <= Math.abs(best[0] - n)) best = w;
  return best[1];
}

// 부모 Text의 글꼴 — 글 안에 끼운 Text가 굵기를 따로 안 주면 이걸 물려받는다
const FamilyCtx = React.createContext<string | null>(null);

// 화면이 일부러 다른 글꼴을 지정했으면(숫자 전용 등) null — 그대로 둔다
function familyOf(style: any, parent: string | null): string | null {
  return familyOfFlat(StyleSheet.flatten(style) || {}, parent);
}
function familyOfFlat(flat: any, parent: string | null): string | null {
  if (flat.fontFamily === SERIF) return SERIF;
  if (flat.fontFamily && !String(flat.fontFamily).startsWith('Pretendard')) return null;
  // 명조 글 안에 끼운 글자는 명조를 물려받는다(고딕으로 바꾸려면 fontFamily: 'Pretendard')
  if (parent === SERIF && !flat.fontFamily) return SERIF;
  if (flat.fontWeight != null) return familyFor(flat.fontWeight);
  return parent ?? 'Pretendard-W490';
}

// 글자 세로 위치를 시안(크롬)과 같게(1016) — 줄 높이(lineHeight) 안에서 글자가 놓이는 자리가 플랫폼마다 다르다.
// · 크롬: 글꼴 위·아래 높이(ascent·descent)를 정수 px로 반올림한 뒤, 남는 줄 간격의 절반을 내림해 위에 둔다.
// · 안드로이드: 기기 px로 반올림한 위·아래 높이로 가운데 맞춤(남는 간격 절반은 올림, RN CustomLineHeightSpan), 줄 높이는 px로 올림.
// · iOS: 반올림 없이 정확히 가운데(RN baselineOffset).
// 그래서 같은 16/26.4 글자가 앱에서 0.4~1.4 아래에 찍히고, 안드로이드는 줄마다 높이가 최대 1px씩 커져 아래 요소가 밀린다.
// 바깥 Text에 (1) 안드로이드 줄 높이를 기기 px 반올림값으로, (2) 크롬 기준선과의 차이만큼 translateY를 준다(배치는 그대로, 그림만 이동).
// 실측(에뮬레이터 408dp·3x, 크기 11~31 · 줄 높이 12~40.3 · 굵기 400~800, 31조합): 크롬 식·안드로이드 식이 모두 px 단위까지 맞았다.
type Metrics = { asc: number; desc: number };
const SANS_M: Metrics = { asc: 1950 / 2048, desc: 494 / 2048 };   // Pretendard hhea ascender·descender / upm (8개 굵기 모두 같다)
const SERIF_M: Metrics = { asc: 1160 / 1000, desc: 288 / 1000 };  // 고운바탕 hhea(크롬·안드로이드·iOS 모두 이 값을 쓴다)
function chromeBaseline(fs: number, lh: number, m: Metrics): number {
  const a = Math.round(m.asc * fs), d = Math.round(m.desc * fs);
  return Math.floor((lh - a - d) / 2) + a;
}
// 줄 노트의 실제 줄 간격(dp) — 글이 실제로 그려지는 줄 높이와 같은 값으로 밑줄을 긋는다(allowFontScaling={false}인 글 기준).
// 안드로이드는 줄 높이를 화면 px로 맞춘다: TextInput은 RN이 올림(ceil), Text는 위 보정(verticalFix)이 반올림.
// 줄 높이 × 화면 배율이 딱 떨어지지 않는 기기(예: 28 × 2.625)에서 dp 그대로 그으면 한 줄마다 1px 미만씩 어긋나 쌓인다.
export function rulePitch(lh: number, input = false): number {
  if (Platform.OS !== 'android') return lh;
  const r = PixelRatio.get();
  return Math.max(1, (input ? Math.ceil : Math.round)(lh * r - 0.001)) / r;
}

// scale=false: allowFontScaling={false}인 글자(줄 노트 위 글) — 휴대폰 글자 크기 설정을 따르지 않으니 배율 1로 계산한다
function verticalFix(flat: any, serif = false, scale = true): { lineHeight: number; shift: number } | null {
  const fs = flat.fontSize, lh = flat.lineHeight;
  if (typeof fs !== 'number' || typeof lh !== 'number' || fs <= 0 || lh <= 0) return null;
  // 글자에 바탕·테두리가 있거나 이미 움직임(transform)이 있으면 건드리지 않는다(바탕까지 같이 움직이므로)
  if (flat.transform || flat.backgroundColor || flat.borderWidth || flat.borderBottomWidth || flat.borderTopWidth) return null;
  // 같은 글자 크기·줄 높이는 한 번만 계산한다 — 화면의 모든 글자가 그려질 때마다 거치는 길이다(1110)
  const f = Platform.OS === 'android' && scale ? Math.min(PixelRatio.getFontScale() || 1, 1) : 1;
  const key = `${serif ? 's' : ''}${fs}|${lh}|${f}`;
  const hit = fixCache.get(key);
  if (hit !== undefined) return hit;
  const res = computeVerticalFix(fs, lh, serif ? SERIF_M : SANS_M, f);
  fixCache.set(key, res);
  return res;
}
const fixCache = new Map<string, { lineHeight: number; shift: number } | null>();
function computeVerticalFix(fs: number, lh: number, m: Metrics, f: number): { lineHeight: number; shift: number } | null {
  const ASC = m.asc, DESC = m.desc;
  if (Platform.OS === 'android') {
    const r = PixelRatio.get();
    // 휴대폰 글자 크기를 줄인 경우(키우는 건 maxFontSizeMultiplier 1로 막았다) RN이 글자·줄 높이를 같이 줄인다 — f(위에서 받음)
    const fe = fs * f, le = lh * f;
    const L = Math.max(1, Math.round(le * r));
    const a = Math.round(ASC * fe * r), d = Math.round(DESC * fe * r);  // Paint.getFontMetricsInt는 반올림
    const base = (a + Math.ceil((L - a - d) / 2)) / r;
    // RN이 줄 높이를 px로 올림(ceil)하므로 반올림한 px에서 아주 조금 빼서 넘긴다
    return { lineHeight: (L - 0.01) / (r * f), shift: chromeBaseline(fe, le, m) - base };
  }
  if (Platform.OS === 'ios') {
    if (lh < (ASC + DESC) * fs) return null;  // 줄 높이가 글자보다 작으면 RN이 가운데 맞춤을 하지 않는다 — 그대로 둔다
    return { lineHeight: lh, shift: chromeBaseline(fs, lh, m) - (lh + (ASC - DESC) * fs) / 2 };
  }
  return null;
}

let installed = false;
const ownCache = new Map<string, any>();

// 웹 — @font-face + 전역 글꼴(아이콘은 SVG라 글꼴을 덮어도 안전)
function installWeb() {
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  // @font-face는 public/index.html(#yahwa-fonts)에 있다 — 자주 쓰는 글자(core)와 나머지(rest)로 나눈 파일(11-22, 2MB → 보통 500KB)
  style.textContent = `
    /* 글꼴을 직접 지정한 글자(명조 제목 등 — 인라인 font-family 또는 RN-web의 r-fontFamily- 클래스)는 덮어쓰지 않는다(입력칸도 — 명조 편지지) */
    html, body, body *:not([style*="font-family"]):not([class*="r-fontFamily-"]), input:not([class*="r-fontFamily-"]), textarea:not([class*="r-fontFamily-"]), select, button {
      font-family: YahwaPretendard, Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }
    /* 명조 글 안에 끼운 글자는 명조를 물려받는다 */
    body [style*="${SERIF}"] *:not([style*="font-family"]) { font-family: inherit !important; }
  `;
  document.head.appendChild(style);
}

// 앱 — 글꼴 로딩이 끝난 뒤 한 번 호출.
// withFonts=false — 글꼴 로딩이 실패했을 때: 시스템 글꼴 그대로 두고 글자 크기 고정(maxFontSizeMultiplier 1)만 건다
export function installAppFont(withFonts = true) {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') { installWeb(); return; }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  const OrigText = RN.Text;
  const OrigTextInput = RN.TextInput;
  function AppText(props: any) {
    const parent = React.useContext(FamilyCtx);
    if (!withFonts) return React.createElement(OrigText, { maxFontSizeMultiplier: 1, ...props });
    const flat = StyleSheet.flatten(props.style) || {};
    const fam = familyOfFlat(flat, parent);
    if (!fam) return React.createElement(OrigText, { maxFontSizeMultiplier: 1, ...props });
    // 세로 위치 보정은 바깥 Text에만(안쪽 Text는 같은 줄에 함께 그려진다)
    const fix = parent ? null : verticalFix(flat, fam === SERIF, props.allowFontScaling !== false);
    // 덧붙이는 스타일은 같은 값이면 같은 객체를 다시 쓴다(글자마다 새로 만들지 않게)
    const ownKey = fix ? `${fam}|${fix.lineHeight}|${fix.shift}` : fam;
    let own = ownCache.get(ownKey);
    if (!own) {
      own = { fontFamily: fam, fontWeight: 'normal' };
      if (fix) {
        own.lineHeight = fix.lineHeight;
        if (Math.abs(fix.shift) >= 0.01) own.transform = [{ translateY: fix.shift }];
      }
      ownCache.set(ownKey, own);
    }
    // 휴대폰 '글자 크기' 설정으로 시안 크기가 바뀌지 않게(1016) — 화면이 따로 정하면 그 값
    const el = React.createElement(OrigText, { maxFontSizeMultiplier: 1, ...props, style: [props.style, own] });
    // 글자만 든 Text는 안쪽 Text가 없으니 굵기를 물려줄 필요가 없다
    const kids = props.children;
    if (kids == null || typeof kids === 'string' || typeof kids === 'number') return el;
    return React.createElement(FamilyCtx.Provider, { value: fam }, el);
  }
  function AppTextInput(props: any) {
    const fam = withFonts ? familyOf(props.style, null) : null;
    const base = { maxFontSizeMultiplier: 1, ...props };
    return React.createElement(OrigTextInput, fam ? { ...base, style: [props.style, { fontFamily: fam, fontWeight: 'normal' }] } : base);
  }
  AppText.displayName = 'Text';
  AppTextInput.displayName = 'TextInput';
  Object.assign(AppTextInput, OrigTextInput);  // TextInput.State 등 정적 멤버 유지
  Object.defineProperty(RN, 'Text', { configurable: true, enumerable: true, get: () => AppText });
  Object.defineProperty(RN, 'TextInput', { configurable: true, enumerable: true, get: () => AppTextInput });
}
