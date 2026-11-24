// 야화 — 인연 화면 전용 시안 아이콘 (1013-B)
// 시안 사이트(F·x·S 컴포넌트) path를 그대로 옮겼다. 시스템 적용 모드의 선 굵기는 1.4.
// 공용 icons.tsx와 모양이 다른 것(더보기 가로 점, 자물쇠, 안내, 신고 깃발, 사람, 다음)만 여기 둔다.
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type P = { size?: number; color: string; stroke?: number };

const line = (d: string) => function LineIcon({ size = 20, color, stroke = 1.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
};

// 시안에서 끝·꺾임을 둥글리지 않은 아이콘(지우개 — .hide-person svg: butt · miter)
const sharp = (d: string) => function SharpIcon({ size = 20, color, stroke = 1.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}>
      <Path d={d} />
    </Svg>
  );
};

export const AIcons = {
  back: line('M15 5l-7 7 7 7'),
  next: line('M9 5l7 7-7 7'),
  lock: line('M6 10h12v11H6Z M8 10V7a4 4 0 0 1 8 0v3'),
  info: line('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 10v7 M12 6v1'),
  flag: line('M5 22V3h14l-3 5 3 5H5'),
  ban: line('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M5 5l14 14'),
  user: line('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-8 16-8 16 0'),
  erase: sharp('M3 13l9-9 8 8-7 8H9Z M7 9l8 8 M12 20h9'),
  chevDown: line('m6 9 6 6 6-6'),
  // 도움말(1020 시안 help-icon, viewBox 28 · 선 2.5) — 동그라미 안 물음표
  help: function Help({ size = 22, color }: P) {
    return (
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={14} cy={14} r={12} />
        <Path d="M10.8 10a3.3 3.3 0 0 1 6.4 1c0 2.4-3.2 2.6-3.2 5" />
        <Circle cx={14} cy={20} r={1} fill={color} stroke="none" />
      </Svg>
    );
  },
  // 리프(1020 시안 leaf-body · leaf-vein, 화면에서는 선 2)
  leaf: function Leaf({ size = 24, color, stroke = 1.7 }: P) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5.1 18.7C.9 13.5 5 4.1 20.4 3.2c2 11.2-3.2 18.6-13.4 16.3L4.8 23l-1.3-.8 1.6-3.5Z" />
        <Path d="M5.4 19C8.2 14.2 11.8 11 15.8 9" />
      </Svg>
    );
  },
  // 더보기 — 가로 점 3개(채움)
  more: function More({ size = 20, color }: P) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="5" cy="12" r="1.4" fill={color} />
        <Circle cx="12" cy="12" r="1.4" fill={color} />
        <Circle cx="19" cy="12" r="1.4" fill={color} />
      </Svg>
    );
  },
};

// 인증 씰 — 기본 인증(파랑) / 선택 인증(보라). 다크 모드에서도 같은 색(시안 고정값)
// 예전 연하늘 톱니(#C8E1FA + 남색 체크)는 디자인 기준과 달라 없앴다(디자이너 2026-11-21: Figma Cert Badge · design-system Cert Tier · features.js certSvg).
// 이름은 그대로 두고 기준 배지를 그린다 — 본인 인증 = 흰 배지, extra(학력 · 직장 · 소득 한 가지) = 파랑 배지.
export function VerificationSeal({ size = 18, extra = false }: { size?: number; extra?: boolean }) {
  return extra ? <CertBlue size={size} /> : <CertBadge size={size} />;
}

// 선택 인증 종류 기호 — 학력(학사모) · 직장(가방) · 소득(지갑)
export type CredentialKind = 'school' | 'company' | 'income';
export function CredentialSymbol({ kind, size = 16, color }: { kind: CredentialKind; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'school' ? (
        <>
          <Path d="m2 9 10-5 10 5-10 5Z" />
          <Path d="M6 11v6c4 3 8 3 12 0v-6M22 9v7" />
        </>
      ) : kind === 'company' ? (
        <>
          <Rect x="3" y="7" width="18" height="14" rx="3" />
          <Path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" />
        </>
      ) : (
        <>
          <Path d="M4 7 18 3v4" />
          <Rect x="3" y="7" width="18" height="14" rx="3" />
          <Path d="M21 12h-6v5h6" />
        </>
      )}
    </Svg>
  );
}

// ── 리뉴얼 1120 — 시안(yahwa-ui-demo) 아이콘. path는 시안 원본 그대로(spec-dating §7) ─────────────────
type LineP = { size?: number; color: string; stroke?: number };
const svgLine = (vb: number, d: string, sw: number) => function RIcon({ size = 20, color, stroke = sw }: LineP) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
};
const svgFill = (d: string, vb = '0 0 24 24') => function RFill({ size = 24, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox={vb} fill={color}><Path d={d} /></Svg>;
};

export const HEART32_LINE = 'M16 26C12 23 4.5 17.5 5 11.3C5.4 5.5 12.2 5.5 15.6 12.2C18.1 5.2 25.8 4.9 27 10.8C28.1 16.1 21.6 23.1 16 26Z';
export const HEART32_FILL = 'M16 27C12 24 3.6 18 4 11.2C4.4 4.5 12.1 4.3 15.6 10.2C18.3 3.9 26.8 3.8 28 10.6C29.1 16.5 22 24 16 27Z';
export const HEART24 = 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z';
export const ENVELOPE_HAND = 'M3 6Q12 5 21 6V19H3Z M3 7L12 14L21 7 M3 19L9 13 M21 19L15 13';

export const RIcons = {
  // 해("이 사람의 한 장면", 열기 전 카드) 14 · 선 1.35
  sun: svgLine(24, 'M16.8 12.1a4.8 4.8 0 1 1-9.6-.2 4.8 4.8 0 0 1 9.6.2ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5', 1.35),
  heartLine: svgLine(32, HEART32_LINE, 2),
  heartFill: svgFill(HEART32_FILL, '0 0 32 32'),
  // 알약 · 완료 모션용 하트(viewBox 24)
  heart24: svgFill(HEART24),
  envelope: svgLine(24, ENVELOPE_HAND, 1.5),
  check: svgLine(24, 'M5 12.5l4.5 4.5L19 7.5', 2),
  lock: svgLine(24, 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3', 1.8),
  // 더보기 시트(채움)
  eyeOff: svgFill('M1.29288 1.29288C1.68341 0.902383 2.31643 0.902367 2.70694 1.29288L7.67666 6.26358C7.69203 6.27773 7.70703 6.29231 7.72159 6.30752L11.6933 10.2802C11.6961 10.2829 11.6993 10.2852 11.7021 10.288C11.7052 10.2911 11.7078 10.2947 11.7108 10.2978L22.7069 21.2948C23.0974 21.6854 23.0974 22.3184 22.7069 22.7089C22.3164 23.0994 21.6834 23.0994 21.2929 22.7089L16.7958 18.2118C15.2747 18.8527 13.5034 19.0019 11.9999 19.0019C7.65647 19.0019 3.74139 16.3911 2.07608 12.3866C1.9739 12.1406 1.97453 11.8639 2.07706 11.6181C2.81801 9.84151 3.88707 8.08827 5.43741 6.85147L1.29288 2.70694C0.902383 2.31641 0.902367 1.68338 1.29288 1.29288ZM6.86319 8.27823C5.68773 9.14947 4.78043 10.4658 4.0917 11.996C5.52895 15.0393 8.60187 17.0019 11.9999 17.0019C13.124 17.0019 14.2482 16.9075 15.2255 16.6405L13.12 14.5351C12.8778 14.7741 12.5191 15.0009 11.9999 15.0009C10.3502 15.0009 8.99991 13.6617 8.99991 12.0028C8.99992 11.4825 9.22632 11.1228 9.46573 10.8808L6.86319 8.27823ZM11.9999 4.99991C16.3435 4.99991 20.2585 7.61047 21.9237 11.619C22.0263 11.866 22.0254 12.144 21.9218 12.3905C21.6463 13.045 21.3132 13.8774 20.8163 14.579C20.4971 15.0297 19.8725 15.1364 19.4218 14.8173C18.9711 14.4981 18.8643 13.8734 19.1835 13.4228C19.4615 13.0302 19.6755 12.5613 19.9091 12.0126C18.4724 8.96402 15.399 6.99991 11.9999 6.99991C11.4476 6.99991 10.9999 6.55219 10.9999 5.99991C10.9999 5.44762 11.4476 4.99991 11.9999 4.99991Z'),
  ban: svgFill('M20 11.999C20 7.58316 16.4176 3.99902 12 3.99902C10.1514 3.99902 8.44951 4.62714 7.09473 5.68066L18.3164 16.9043C19.37 15.5495 20 13.8487 20 11.999ZM4 11.999C4 16.4186 7.58214 19.999 12 19.999C13.8479 19.999 15.5479 19.3705 16.9023 18.3184L5.68164 7.0957C4.62858 8.45051 4 10.1514 4 11.999ZM22 11.999C22 17.5235 17.5221 21.999 12 21.999C6.47786 21.999 2 17.5235 2 11.999C2 6.47888 6.47757 1.99902 12 1.99902C17.5224 1.99902 22 6.47888 22 11.999Z'),
  siren: svgFill('M18.0009 17.9849L17.998 17.98H6.00383L6.0009 17.9849V19.9897L6.00383 19.9937H17.998L18.0009 19.9897V17.9849ZM3.2968 4.27393C3.68824 3.8847 4.32136 3.88657 4.71087 4.27783L6.70891 6.28467C7.09832 6.67609 7.09633 7.30917 6.70501 7.69873C6.31359 8.08819 5.68053 8.08714 5.29094 7.6958L3.2929 5.68896C2.90325 5.29756 2.9054 4.66357 3.2968 4.27393ZM19.2958 4.27686C19.6858 3.88591 20.3189 3.88505 20.7099 4.2749C21.1009 4.6649 21.1018 5.29794 20.7118 5.68896L18.7099 7.6958C18.3199 8.08681 17.6868 8.08779 17.2958 7.69775C16.9049 7.30771 16.9039 6.67468 17.2939 6.28369L19.2958 4.27686ZM11.0029 4.98291V2.97607C11.0029 2.42379 11.4506 1.97607 12.0029 1.97607C12.5551 1.97607 13.0029 2.42379 13.0029 2.97607V4.98291C13.0029 5.53519 12.5551 5.98291 12.0029 5.98291C11.4506 5.98291 11.0029 5.53519 11.0029 4.98291ZM15.0038 12.9663C15.0038 11.3361 13.6661 9.99756 12.0029 9.99756C10.3366 9.99756 9.00286 11.3351 9.00286 12.9663V15.98H11.0029V12.9663C11.0029 12.414 11.4506 11.9663 12.0029 11.9663C12.5551 11.9663 13.0029 12.414 13.0029 12.9663V15.98H15.0038V12.9663ZM17.0038 15.98H18.0019C19.1146 15.98 20.0008 16.8922 20.0009 17.9829V19.9897C20.0009 21.0808 19.1153 21.9937 18.0019 21.9937H5.99993C4.88658 21.9937 4.0009 21.0809 4.0009 19.9897V17.9829C4.00097 16.8921 4.88731 15.98 5.99993 15.98H7.00286V12.9663C7.00286 10.2175 9.24512 7.99756 12.0029 7.99756C14.7556 7.99756 17.0038 10.2165 17.0038 12.9663V15.98Z'),
  // 취향 설정 MBTI 머리(손그림 선 1.5) — 프로필 정보 아이콘은 entry/art의 FactIcon(11-22 피그마 Line 세트)
  mbti: svgLine(24, 'M4 5h16v12H9l-5 4ZM8 9h8M8 13h5', 1.5),
  // 취향 설정 섹션 제목(viewBox 48)
  prefPerson: svgLine(48, 'M8 44C8 22 40 22 40 44M16 14C16 16.1217 16.8429 18.1566 18.3431 19.6569C19.8434 21.1571 21.8783 22 24 22C26.1217 22 28.1566 21.1571 29.6569 19.6569C31.1571 18.1566 32 16.1217 32 14C32 11.8783 31.1571 9.84344 29.6569 8.34315C28.1566 6.84285 26.1217 6 24 6C21.8783 6 19.8434 6.84285 18.3431 8.34315C16.8429 9.84344 16 11.8783 16 14Z', 2.8),
  prefHome: svgLine(48, 'M6 21L24 6L42 21M11 18V40H21V28H27V40H37V18', 3),
  prefReligion: svgLine(48, 'M24 6V42M12 18H36', 3),
  prefSmoking: svgLine(48, 'M32 26V36M14 6C10 10 10 13.3333 14 16M24 6C20 10 20 13.3333 24 16M6 26H42V36H6V26Z', 3),
  prefDrinking: svgLine(48, 'M24 26C26.6522 26 29.1957 24.9464 31.0711 23.0711C32.9464 21.1957 34 18.6522 34 16V6H14V16C14 18.6522 15.0536 21.1957 16.9289 23.0711C18.8043 24.9464 21.3478 26 24 26ZM24 26V42M16 42H32', 3),
  prefTalk: svgLine(48, 'M16 20H32M16 26H26M8 12C18.6667 9.33333 29.3333 9.99999 40 14V32L26 34L14 42V34L8 32V12Z', 2.7),
  prefFilter: svgLine(48, 'M8 14H18M26 14H40M8 34H26M34 34H40M22 8V20M30 28V40', 3.2),
};

// 겹친 하트(서로 호감 · 서로 연결됨 알약) — 22×18
export function TwoHearts({ color, width = 22 }: { color: string; width?: number }) {
  return (
    <Svg width={width} height={(width * 24) / 28} viewBox="0 0 28 24" fill={color}>
      <Path d="M10 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0117 10c0 5.6-7 10-7 10z" opacity={0.95} />
      <Path d="M18 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0125 10c0 5.6-7 10-7 10z" opacity={0.6} />
    </Svg>
  );
}
// 봉투(홈 알약 "편지 받음") — 선 1.8
export function EnvelopePill({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      <Rect x={3.5} y={5.5} width={17} height={13} rx={2} />
      <Path d="M4 7l8 6 8-6" />
    </Svg>
  );
}

// 인증 배지(시안 "인증 배지 위계") — 본인 인증만: 흰 톱니 + 파랑 체크(흰 화면에서는 옅은 테두리, 사진 위에서는 테두리 없음).
// 학력 · 직장 · 소득이 하나라도 있으면(hi): 파랑 톱니 + 흰 체크, 오른쪽 아래에 작은 흰 배지(14/24)가 흰 띠를 두르고 겹친다.
const CERT_OUTER = 'M20.2099 8.532C22.5899 10.183 22.5899 13.814 20.2099 15.47C20.8299 18.257 18.2499 20.834 15.4699 20.218C13.8099 22.59 10.1799 22.59 8.52994 20.218C5.73994 20.834 3.15994 18.257 3.77994 15.47C1.40994 13.814 1.40994 10.183 3.77994 8.532C3.15994 5.745 5.73994 3.16798 8.52994 3.78298C10.1799 1.40698 13.8099 1.40698 15.4699 3.78298C18.2499 3.16798 20.8299 5.745 20.2099 8.532Z';
const CERT_CK = 'M8.6 12l2.4 2.4 4.4-4.6';
const CERT_BLUE = '#4E8AB0';   // sky-500 — 배지 그림 고정값(tokens colors.accent와 같은 색)
const CERT_EDGE = '#B5BDC4';   // cool-neutral-300
export function CertBadge({ size = 22, hi, onPhoto }: { size?: number; hi?: boolean; onPhoto?: boolean }) {
  const white = (
    <>
      <Path d={CERT_OUTER} fill="#FFFFFF" stroke={onPhoto ? 'none' : CERT_EDGE} strokeWidth={1.3} />
      <Path d={CERT_CK} fill="none" stroke={CERT_BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  if (!hi) return <Svg width={size} height={size} viewBox="0 0 24 24">{white}</Svg>;
  // 작은 배지가 오른쪽 아래로 4/24만큼 나온다 → 그만큼 넓힌 캔버스에 그린다(겉 크기는 size 그대로, 넘친 부분은 overflow)
  const k = 14 / 24;
  return (
    <Svg width={(size * 28) / 24} height={(size * 28) / 24} viewBox="0 0 28 28" style={{ marginBottom: -(size * 4) / 24 }}>
      <Path d={CERT_OUTER} fill={CERT_BLUE} />
      <Path d={CERT_CK} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={CERT_OUTER} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={5} strokeLinejoin="round" transform={`translate(14 14) scale(${k})`} />
      <Path d={CERT_OUTER} fill="#FFFFFF" stroke={onPhoto ? 'none' : CERT_EDGE} strokeWidth={1.3} transform={`translate(14 14) scale(${k})`} />
      <Path d={CERT_CK} fill="none" stroke={CERT_BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" transform={`translate(14 14) scale(${k})`} />
    </Svg>
  );
}
// 파랑 배지 한 장(인증 팝업의 학력 · 직장 · 소득 줄)
export function CertBlue({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={CERT_OUTER} fill={CERT_BLUE} />
      <Path d={CERT_CK} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
