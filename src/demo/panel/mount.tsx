// 야화 시연도구 — 패널을 <html> 바로 아래에 붙인다(앱 화면 기둥인 <body> 밖).
// 넓은 화면(1000px 이상): 오른쪽에 붙어 있고 앱 화면은 왼쪽 가운데로 비켜 선다.
// 좁은 화면: 오른쪽 아래 '시연도구' 버튼으로 열고 닫는다.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DemoPanel } from './DemoPanel';

const W = 360;
const CSS = `
@media (min-width: 1000px) {
  html.ydp-docked { padding-right: ${W}px; }
  html.ydp-docked .ydp-wrap { transform: none !important; }
  html.ydp-docked .ydp-fab { display: none; }
}
.ydp-wrap { position: fixed; top: 0; right: 0; bottom: 0; width: ${W}px; z-index: 2147483000; transform: translateX(100%); transition: transform .25s ease; }
.ydp-wrap.open { transform: none; box-shadow: -12px 0 40px rgba(0,0,0,.12); }
.ydp-fab { position: fixed; right: 16px; bottom: 16px; z-index: 2147483001; border: 0; border-radius: 999px; padding: 10px 16px; background: #1F2A37; color: #fff; font: 600 13px/1 Pretendard, -apple-system, system-ui, sans-serif; box-shadow: 0 6px 20px rgba(0,0,0,.2); cursor: pointer; }
.ydp { box-sizing: border-box; height: 100%; overflow-y: auto; background: #FBFAF7; border-left: 1px solid #E7E3DA; color: #24272B; font: 13px/1.45 Pretendard, -apple-system, system-ui, sans-serif; padding: 0 0 24px; }
.ydp *, .ydp *::before, .ydp *::after { box-sizing: border-box; }
.ydp button { font: inherit; cursor: pointer; }
.ydp-head { position: sticky; top: 0; z-index: 1; background: #FBFAF7; padding: 18px 18px 12px; border-bottom: 1px solid #EEEAE2; }
.ydp-title { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.ydp-safe { margin-top: 4px; font-size: 12px; color: #2F7D55; font-weight: 600; }
.ydp-now { margin-top: 8px; font-size: 12px; color: #6B6F76; }
.ydp-now b { color: #24272B; font-weight: 700; margin-left: 4px; }
.ydp-msg { margin: 12px 18px 4px; padding: 10px 12px; border-radius: 10px; background: #EEF3F8; color: #2B4560; font-size: 12.5px; }
.ydp-sec { border-bottom: 1px solid #EEEAE2; }
.ydp-sec-h { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: 0; padding: 14px 18px; font-weight: 700 !important; font-size: 13.5px !important; color: #24272B; }
.ydp-sec-b { padding: 0 18px 14px; }
.ydp-group { margin-top: 10px; }
.ydp-group:first-child { margin-top: 0; }
.ydp-sub { font-size: 11.5px; color: #8A8E95; font-weight: 600; margin-bottom: 6px; }
.ydp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ydp-chip { border: 1px solid #E1DDD3; background: #fff; color: #24272B; border-radius: 999px; padding: 6px 11px; font-size: 12.5px !important; }
.ydp-chip:hover { border-color: #9DB4CC; background: #F4F8FC; }
.ydp-act { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; border: 1px solid #E1DDD3; background: #fff; border-radius: 10px; padding: 9px 12px; margin-bottom: 6px; }
.ydp-act:hover { border-color: #9DB4CC; background: #F4F8FC; }
.ydp-act span { font-weight: 600; font-size: 12.5px; }
.ydp-act small { color: #8A8E95; font-size: 11.5px; }
.ydp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
.ydp-row-l { color: #4A4E55; font-weight: 600; font-size: 12.5px; white-space: nowrap; }
.ydp-seg { display: inline-flex; border: 1px solid #E1DDD3; border-radius: 999px; overflow: hidden; background: #fff; }
.ydp-seg button { border: 0; background: none; padding: 6px 12px; font-size: 12.5px !important; color: #6B6F76; }
.ydp-seg button.on { background: #1F2A37; color: #fff; }
.ydp-note { font-size: 11.5px; color: #8A8E95; margin-top: 6px; }
.ydp-warn { font-size: 11.5px; color: #9A5B13; background: #FFF6E8; border-radius: 8px; padding: 6px 8px; margin-top: 8px; word-break: break-all; }
.ydp-log { list-style: none; margin: 8px 0 0; padding: 0; max-height: 280px; overflow-y: auto; }
.ydp-log li { display: flex; gap: 6px; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed #EEEAE2; font-size: 11.5px; }
.ydp-log li.miss .n { color: #B4561B; }
.ydp-log .k { flex: none; color: #8A8E95; width: 44px; }
.ydp-log .n { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #24272B; word-break: break-all; }
.ydp-log .t { color: #8A8E95; margin-left: auto; text-align: right; }
.ydp-foot { padding: 16px 18px 0; }
.ydp-foot-top { padding: 12px 18px 4px; }
.ydp-reset { width: 100%; border: 1px solid #E5C9C0; background: #fff; color: #A8432A; border-radius: 10px; padding: 10px; font-weight: 600 !important; }
`;

export function mountDemoPanel() {
  if (typeof document === 'undefined' || document.getElementById('ydp-root')) return;
  // 점주·관리자처럼 PC 업무 화면 주소는 이 시연판에 없다
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.documentElement.classList.add('ydp-docked');

  const wrap = document.createElement('div');
  wrap.id = 'ydp-root';
  wrap.className = 'ydp-wrap';
  document.documentElement.appendChild(wrap);  // body 밖 — 앱 화면 기둥과 겹치지 않는다

  const fab = document.createElement('button');
  fab.className = 'ydp-fab';
  fab.textContent = '시연도구';
  fab.onclick = () => wrap.classList.toggle('open');
  document.documentElement.appendChild(fab);

  // 패널 안 클릭·스크롤이 앱(react-native-web)의 터치 처리로 새지 않게
  ['mousedown', 'touchstart', 'pointerdown', 'wheel'].forEach((ev) => wrap.addEventListener(ev, (e) => e.stopPropagation()));

  createRoot(wrap).render(<DemoPanel />);
}
