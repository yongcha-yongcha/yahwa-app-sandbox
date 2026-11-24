// 야화 — PC 웹에서 앱 화면처럼 보이게 (대표 지시 1003, 레퍼런스: 캐치테이블 웹)
// 넓은 화면(600px 이상)에서는 가운데 폭 430px짜리 '앱 기둥'만 보이고 양옆은 옅은 배경.
// 휴대폰(600px 미만)은 지금처럼 화면 전체를 쓴다. 점주·어드민·제휴 페이지는 PC 업무용이라 제외.
//
// 두 가지를 같이 해야 깨지지 않는다:
//   1) CSS — body를 가운데 기둥으로 좁힌다. body에 transform을 주면 position:fixed 요소
//      (RN-web Modal·시트는 body 바로 아래에 붙는다)가 화면 전체가 아닌 body 기준으로 깔린다.
//   2) Dimensions — 화면 폭으로 카드·스와이프 페이지 크기를 계산하는 곳이 있어서,
//      PC 폭(1440 등)이 그대로 넘어가면 기둥 안에서 레이아웃이 터진다. 폭을 기둥 폭으로 맞춰 준다.
// 이 파일은 다른 화면 모듈보다 먼저 import되어야 한다(app/_layout.tsx 첫 줄).
import { Dimensions, Platform } from 'react-native';

const FRAME_W = 430;
const BREAKPOINT = 600;
const DESKTOP_ROUTES = /^\/(admin|owner|partner)(\/|$)/;

function frameOn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= BREAKPOINT && !DESKTOP_ROUTES.test(window.location.pathname);
}

if (Platform.OS === 'web' && typeof document !== 'undefined' && !DESKTOP_ROUTES.test(window.location.pathname)) {
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: ${BREAKPOINT}px) {
      html { background: #F4F4F6; }   /* 바깥 배경은 다크모드여도 밝은 회백색 고정(대표 지시 1003) */
      body {
        max-width: ${FRAME_W}px; margin: 0 auto; height: 100%;
        transform: translateZ(0);            /* fixed 자식(모달·시트)을 기둥 안에 가둔다 */
        overflow: hidden;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.10);
      }
    }
    /* 휴대폰 웹(iOS Safari)은 16px 미만 입력창에 포커스하면 화면을 확대한다 — 글자 10% 축소(1013) 후에도 확대되지 않게 */
    @media (hover: none) and (pointer: coarse) {
      input, textarea, select { font-size: 16px !important; }
    }
  `;
  document.head.appendChild(style);

  const D: any = Dimensions;
  const rawGet = D.get.bind(D);
  const clamp = (w: any) => (w && frameOn() ? { ...w, width: Math.min(w.width, FRAME_W) } : w);
  D.get = (key: string) => (key === 'window' ? clamp(rawGet(key)) : rawGet(key));
  const rawAdd = D.addEventListener.bind(D);
  const rawRemove = D.removeEventListener.bind(D);
  const wrapped = new WeakMap<Function, (d: any) => void>();
  D.addEventListener = (type: string, handler: (d: any) => void) => {
    const w = (d: any) => handler({ ...d, window: clamp(d?.window) });
    wrapped.set(handler, w);
    return rawAdd(type, w);
  };
  D.removeEventListener = (type: string, handler: (d: any) => void) => rawRemove(type, wrapped.get(handler) ?? handler);
}

export {};
