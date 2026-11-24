// 야화 — 디자인 토큰 (리뉴얼 1120 · 시안 yahwa-ui-demo `tokens.css` 기준, 대표 설정 bg=white · btn=deep · gnb=gray)
// 값의 출처·쓰임은 docs/renewal-1120/spec-shell.md §1, 쓰는 법은 docs/renewal-1120/kit.md.
// · 화면 코드는 hex를 직접 쓰지 않고 colors.* 를 쓴다(원색 palette는 토큰을 새로 만들 때만).
// · 다크 모드는 없다(대표 결정 11-20) — 폰이 다크여도 항상 이 라이트 값. getThemeMode() 등은 기존 import가 깨지지 않게 남긴 껍데기다.
import { Easing, Platform, type TextStyle } from 'react-native';

// ── 원색 팔레트(tokens.css) ───────────────────────────────────────────────────
export const palette = {
  white: '#FFFFFF', paper: '#F8F9F6', black: '#000000', kakao: '#FEE500',
  neutral: { 50: '#F1F4F6', 100: '#E3E7EA', 200: '#CFD5DA', 300: '#B5BDC4', 400: '#98A2AA', 500: '#818C94', 600: '#69757E', 700: '#505C65', 800: '#39444D', 900: '#273037', 950: '#1A2126' },
  sky: { 50: '#ECF5FC', 100: '#D6EAF8', 200: '#B7D7EC', 300: '#92C0DF', 400: '#6EA5C9', 500: '#4E8AB0', 600: '#377398', 700: '#245D7E', 800: '#154662', 900: '#0A3147', 950: '#062232' },
  rose: { 50: '#FCF5F6', 100: '#F6E9EC', 200: '#EBD0D5', 300: '#DDAFB7', 400: '#C78693', 500: '#B26073', 600: '#994A5D', 700: '#7D3749', 800: '#612736', 900: '#451824', 950: '#301018' },
  gold: { 50: '#FAF7EF', 100: '#F3EDDE', 200: '#E7D9BE', 300: '#D1BF9A', 400: '#B6A074', 500: '#9E8655', 600: '#856E3E', 700: '#6C582C', 800: '#53421D', 900: '#3B2E11', 950: '#29200B' },
  sage: { 50: '#EAF2EE', 100: '#D7E7E0', 200: '#BDD8CF', 300: '#9FC4B7', 400: '#80AA9B', 500: '#659482', 600: '#507D6B', 700: '#3C6555', 800: '#2B4D40', 900: '#1C362C', 950: '#13261E' },
  red: { 50: '#FFEEEE', 100: '#FEDBDB', 200: '#FFC0C1', 300: '#F99EA1', 400: '#E47A80', 500: '#CF5C65', 600: '#B3434E', 700: '#94303B', 800: '#74202B', 900: '#54131C', 950: '#3B0D12' },
} as const;
const { neutral: N, sky: S, rose: R, red: RD } = palette;

// ── 역할(시맨틱) 색 ───────────────────────────────────────────────────────────
// 위쪽은 예전부터 쓰던 키(값만 새 시안으로 — spec-shell §1.10 대응표), 아래쪽은 리뉴얼에서 새로 생긴 자리.
export const colors = {
  // 예전 키(화면이 이미 쓰고 있다)
  primary: S[600],        // 주 버튼(예전 와인 브랜드색 자리 — 시안에 브랜드색이 없다)
  primaryDark: S[700],    // 주 버튼 누름
  primarySoft: S[100],    // 보조 버튼 바탕
  primaryLine: S[200],    // 보조 버튼 누름
  night: N[800],          // 진한 바탕(토스트)
  text: N[800],           // 제목·본문 (fg-primary)
  sub: N[600],            // 안내 문구 (fg-tertiary)
  mute: N[500],           // 작은 문구 (fg-muted)
  line: N[100],           // 구분선 (border-default)
  lineSoft: N[50],
  bg: '#FFFFFF',          // 화면 바탕
  bgSoft: N[50],          // 회색 카드·칩
  surface: '#FFFFFF',     // 입력칸·카드·시트
  success: palette.sage[600],
  danger: RD[600],        // 오류 글자·삭제 버튼
  warn: '#F2A53E',        // 시안에 대응 없음 — 예전 값 유지
  leaf: N[800],           // 리프 아이콘은 뉴트럴(보상 숫자만 accent)
  action: S[600],
  actionSoft: S[100],
  notice: N[700],         // 시안은 보라를 쓰지 않는다 — 뉴트럴로
  noticeSoft: N[50],
  heart: R[500],          // 호감 (fg-love)
  letterStatus: N[700],
  disabled: N[400],       // 꺼진 입력 글자
  letterPerson: N[700],
  inactiveNav: N[800],    // 고르지 않은 하단 메뉴 = 진회색 선 아이콘

  // 글자·아이콘
  textSecondary: N[700],  // 보조 본문·글자 링크 (fg-secondary)
  subtle: N[400],         // 꺼진 입력 글자·빈 사진 칸 ＋ (fg-subtle)
  chevron: N[300],        // 목록 줄 끝 꺾쇠
  inverse: '#FFFFFF',     // 진한 바탕 위 글자
  accent: S[500],         // 강조 파랑 — 체크박스 채움·글자 링크·스위치
  accentStrong: S[600],
  accentMuted: S[400],
  love: R[500],
  loveStrong: R[600],
  loveMuted: R[400],
  loveSoft: R[100],
  valid: palette.sage[600],
  validSoft: palette.sage[50], // 쿠폰 '사용 가능' 칩 바탕
  validInk: palette.sage[700],  // 쿠폰 '사용 가능' 칩 글자
  dueSoon: R[600],              // 기한이 3일 안으로 남은 쿠폰의 D-n
  markLine: S[200],             // 편지 '마음이 간 곳' — 고른 문장 밑줄 띠
  // 바탕
  paper: palette.paper,   // 미색 — 스플래시·웰컴 시트·하단 메뉴 유리에만
  muted: N[100],          // 꺼진 버튼 바탕·닫기 원·눌림 바탕 (bg-muted)
  control: N[200],        // 시트 손잡이·스위치 꺼짐 (bg-control)
  fieldClear: N[300],     // 입력 지우기 원
  selected: S[100],       // 안내 상자·OTP 채운 칸 (bg-selected)
  accentSubtle: S[50],    // 휠 가운데 띠·옅은 안내 상자
  inverseStrong: N[900],  // 말풍선·고른 칩·하단 메뉴 채운 아이콘
  filterSub: S[200],      // 걸러짐 칩의 뒤 글자(진회색 위 하늘, 취향 지역 '서울 | 종로구')
  inverseDeep: N[950],
  dangerPress: RD[700],
  dangerSoft: RD[100],    // OTP 오류 칸
  goldSoft: palette.gold[100],
  goldInk: palette.gold[700],
  kakao: palette.kakao,
  ringFill: S[300],       // 마이페이지 소개 채움 링·% 알약 바탕
  ringInk: S[900],        // % 알약 글자
  activityDot: '#26C6A0', // 공개 중 점(시안 --color-fg-activity-dot)
  positive: '#2E9E6B',    // 인연 공개 '공개 중' 점(시안 .ip-dot = --color-fg-positive)
  mintSoft: '#DFFBF3',    // 편지 소식 아이콘 원 바탕(시안 .nt-ico.is-lt = --mint-50)
  mintInk: '#0B7A66',     // 편지 소식 아이콘 봉투(--mint-700)
  // 테두리
  lineControl: N[200],    // 입력칸·선택 카드 테두리 (border-control)
  lineHover: N[300],      // 점선 칸
  lineMuted: N[400],      // 빈 체크박스·라디오·글자 링크 밑줄
  focus: S[600],          // 포커스 테두리·커서
  errorLine: RD[500],     // 오류 테두리(오류 글자는 danger)
  badge: RD[500],         // 알림 점
  // 버튼(buttons.css, btn=deep)
  btnPrimaryBg: S[600], btnPrimaryFg: '#FFFFFF', btnPrimaryPress: S[700],
  btnSecondaryBg: S[100], btnSecondaryFg: S[700], btnSecondaryPress: S[200],
  btnTertiaryBg: '#FFFFFF', btnTertiaryFg: N[900], btnTertiaryLine: N[200], btnTertiaryPress: N[50],
  btnTextFg: S[700], btnTextPress: S[50],
  btnDisabledBg: N[100], btnDisabledFg: N[500],
  sheetRowPress: '#E7EBEE',   // 시트 줄 누름 면
  // 하단 메뉴(gnb=gray)
  gnbBg: 'rgba(248,249,246,0.60)',
  gnbBgSolid: 'rgba(248,249,246,0.94)',  // 흐림을 못 쓰는 곳(안드로이드)
  gnbBorder: 'rgba(255,255,255,0.20)',
  gnbCapsule: 'rgba(207,213,218,0.85)',
  gnbIcon: N[800],
  gnbIconActive: N[900],
  gnbKnock: '#D5DADE',
  gnbAvatarRing: N[700],
  // 막(scrim)
  scrim: 'rgba(57,68,77,0.32)',
  scrimDialog: 'rgba(57,68,77,0.40)',
  scrimDeep: 'rgba(26,33,38,0.58)',
};

// ── 다크 모드 껍데기 — 항상 라이트 ────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark';
export function getThemeMode(): ThemeMode { return 'light'; }
export function setThemeMode(_mode: ThemeMode) { /* 다크 모드 없음 */ }
export function subscribeTheme(_cb: () => void): () => void { return () => {}; }
// 시트·모달 뒤 막(시안 rgba(57,68,77,.32)).
// 웹은 RN-web이 투명도를 소수 둘째 자리로 반올림해서 CSS 변수 기본값으로 감싸 시안 값 그대로 내보낸다
export function scrimColor(): string {
  return Platform.OS === 'web' ? `var(--yh-exact, ${colors.scrim})` : colors.scrim;
}

// ── 모서리(spec §1.5) ─────────────────────────────────────────────────────────
export const radius = {
  // 예전 키(값만 새 단계로)
  sm: 10, md: 12, lg: 14, xl: 16,
  card: 16,
  sheet: 24,
  pill: 9999,
  // 쓰임새별
  field: 12,    // 입력칸·선택창·공용 버튼 L/M·사진 칸·OTP 칸
  cta: 14,      // 화면 아래 주 버튼·시트 2버튼
  chip: 18,     // 높이 36 칩
  photo: 20,    // 대표 사진·대화상자
  toast: 10,
  gnb: 32,
  gnbCapsule: 27,
} as const;

// ── 간격·배치(spec §1.6) ──────────────────────────────────────────────────────
export const space = { 0: 0, 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16, 20: 20, 24: 24, 28: 28, 32: 32, 36: 36, 40: 40, 48: 48, 56: 56, 64: 64 } as const;
export const layout = {
  gutter: 20,          // 화면 좌우 여백
  topPad: 4,           // 화면 위 여백(상태 표시줄 아래부터) — 11-22 24 → 4(다른 앱보다 머리 줄이 많이 내려와 있었다)
  headerH: 44,         // 머리 줄
  touch: 44,           // 터치 영역 최소
  dockBottom: 30,      // 아래 고정 버튼: max(30, 안전 영역 + 12)
  dockBtnH: 54,
  gnbH: 64,
  gnbBottom: 20,       // 하단 메뉴: max(20, 안전 영역)
  gnbGap: 12,          // 하단 메뉴 위 여유
  sheetPadBottom: 32,  // 시트 아래: 32 + 안전 영역
} as const;

// ── 층(spec §1.8) ─────────────────────────────────────────────────────────────
export const z = { screen: 0, sticky: 3, gnb: 5, toast: 40, tooltip: 55, sheet: 60, top: 100 } as const;

// ── 글꼴 ─────────────────────────────────────────────────────────────────────
// 제목은 고운바탕(명조) Bold 하나, 나머지는 Pretendard(굵기는 fontWeight로 — src/lib/appFont.ts가 글꼴 파일을 고른다).
// 11-22 Regular → Bold(폰에서 명조가 너무 얇아 보였다 · 시안 type-icons A안)
export const fontSerif = 'GowunBatang-Bold';
// iOS system font is the design intent. RN uses font family undefined → system on iOS.
// Android: Pretendard bundled as a font (loaded in app/_layout).
export const fontFamily = Platform.select({
  ios: undefined,
  android: 'Pretendard',
  default: undefined,
});

const serif = (fontSize: number, lineHeight: number, letterSpacing = 0): TextStyle =>
  ({ fontFamily: fontSerif, fontWeight: '400', fontSize, lineHeight, letterSpacing, color: colors.text });
const sans = (fontWeight: TextStyle['fontWeight'], fontSize: number, lineHeight: number, color: string = colors.text): TextStyle =>
  ({ fontWeight, fontSize, lineHeight, letterSpacing: 0, color });

// 글자 프리셋(spec §1.4 "화면에서 실제로 쓰는 값" + tokens.css 스타일 토큰). 본문 자간은 0.
export const type = {
  // 명조
  display1: serif(30, 45, -1),
  display2: serif(26, 39, -1),
  title1: serif(24, 36, -0.6),
  title2: serif(22, 33, -0.6),
  title3: serif(20, 30, -0.6),
  title4: serif(18, 27, -0.6),
  tabTitle: serif(26, 40, 0),        // 탭 화면 큰 제목(오늘의 인연·마음함·편지함·커뮤니티·마이페이지)
  stepTitle: serif(29, 43.5, -1),    // 가입 단계 큰 제목
  stepTitleM: serif(27, 40.5, -1),   // 상세 정보·미리보기 제목
  stepTitleS: serif(25, 37.5, -1),   // 자기소개 제목
  sheetTitleSerif: serif(20, 29, 0), // 질문 시트 제목
  quote: serif(12, 20.4, 0),
  // 고딕 — 제목
  heading1: sans('600', 26, 36.4),
  heading2: sans('600', 20, 28),
  heading3: sans('600', 18, 25.2),
  heading4: sans('600', 16, 22.4),
  pageTitle: sans('600', 16, 20.8),  // 안쪽 화면 머리 줄 가운데 제목
  sheetTitle: sans('600', 17, 23.8), // 확인 시트 제목
  // 고딕 — 본문
  body1: sans('400', 15, 22.5),
  body2: sans('400', 14, 21),
  body3: sans('400', 13, 19.5),
  body1Reading: sans('400', 15, 25.5),
  body2Reading: sans('400', 14, 23.8),
  body3Reading: sans('400', 13, 22.1),
  sheetBody: sans('400', 14, 22.4, colors.textSecondary),  // 확인 시트 설명
  intro: sans('400', 13, 23.4, colors.sub),                // 가입 안내 문구(.ob-intro)
  // 고딕 — 라벨
  label1: sans('500', 15, 21),
  label2: sans('500', 14, 19.6),
  label3: sans('500', 13, 18.2),
  label4: sans('500', 12, 16.8),
  fieldLabel: sans('400', 12, 14),
  // 고딕 — 작은 글
  caption1: sans('400', 12, 18, colors.sub),
  caption2: sans('400', 11, 16.5, colors.sub),   // 11은 최소 크기(푸터·보조 글 전용)
  help: sans('400', 12, 18, colors.sub),
  error: sans('400', 12, 18, colors.danger),
  subtitle: sans('400', 12, 19.2, colors.mute),  // 탭 화면 부제목
  // 버튼
  btnL: sans('600', 15, 21),
  btnM: sans('600', 14, 19.6),
  btnS: sans('600', 13, 18.2),
  btnDock: sans('500', 15, 21),                  // 화면 아래 주 버튼(.ob-next)
  toast: sans('500', 12, 20, '#FFFFFF'),
} satisfies Record<string, TextStyle>;

// ── 그림자(spec §1.7) — RN 새 아키텍처·웹 공통 boxShadow 문자열 ─────────────────
export const shadow = {
  // 예전 키
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16 },
    android: { elevation: 2 },
    default: {},
  }),
  sheet: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 24 },
    android: { elevation: 8 },
    default: {},
  }),
  fab: Platform.select({
    ios: { shadowColor: N[800], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 20 },
    android: { elevation: 6 },
    default: {},
  }),
  // 시안 값 그대로
  gnb: { boxShadow: '0px 8px 24px rgba(57,68,77,0.14)' },
  note: { boxShadow: '0px 1px 2px rgba(57,68,77,0.06), 0px 8px 20px rgba(57,68,77,0.06)' },
  drag: { boxShadow: '0px 12px 24px rgba(57,68,77,0.18)' },
  notice: { boxShadow: '0px 4px 20px rgba(57,68,77,0.071)' },
  tooltip: { boxShadow: '0px 6px 18px rgba(26,33,38,0.18)' },
  roundBtn: { boxShadow: '0px 10px 24px -6px rgba(39,48,55,0.32), 0px 2px 6px rgba(39,48,55,0.12)' },
} as const;

// ── 모션(spec §1.9) ───────────────────────────────────────────────────────────
export const ease = {
  drawer: Easing.bezier(0.32, 0.72, 0, 1),      // 시트·화면 밀기·캡슐·진행 막대
  out: Easing.bezier(0.23, 1, 0.32, 1),         // 페이드·눌림 되돌림
  inOut: Easing.bezier(0.77, 0, 0.175, 1),      // 웰컴 사진 초점·OTP 칸 모임
  toast: Easing.bezier(0.16, 1, 0.3, 1),
  zoom: Easing.bezier(0.22, 1, 0.36, 1),        // "끝낸 순간" 화면 다가옴
  // 튕김 없는 단계 스프링 — 가입 단계 내용 떠오름
  step: (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-9 * t) * (1 + 9 * t)),
} as const;
// 웹 CSS transition용 같은 곡선
export const easeCss = {
  drawer: 'cubic-bezier(.32,.72,0,1)',
  out: 'cubic-bezier(.23,1,.32,1)',
  inOut: 'cubic-bezier(.77,0,.175,1)',
  toast: 'cubic-bezier(.16,1,.3,1)',
} as const;
export const dur = {
  press: 120, pressFast: 100, color: 160,
  tipIn: 180, tipOut: 140,
  fade: 170, swap: 220,
  sheetIn: 300, sheetOut: 240, scrim: 200, reduced: 160,
  capsule: 260, navIcon: 140, navLayer: 160,
  push: 300, pop: 280,
  progress: 360, progressChapter: 520,
  rise: 800, riseStagger: 50,
  toastIn: 460, toastOut: 380, toastStay: 2800,
} as const;
