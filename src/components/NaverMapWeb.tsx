// 야화 — 네이버 지도 v3 JavaScript SDK (web only).
// 동적 script 로드. 환경변수 EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 필요.
// 핀·내 위치·불러오기 화면은 시안 사이트(플레이스) 실측: 물방울 핀(.venue-pin, 선택 시 와인색 채움),
// 내 위치는 흰 테두리 파란 점, 불러오는 중/실패는 옅은 회색 화면(MapStatusOverlay).
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../tokens';
import { MapStatusOverlay } from './place/MapStatusOverlay';

declare global {
  interface Window {
    naver?: any;
    __yahwaPlacePinCss2?: boolean;
    navermap_authFailure?: () => void;
  }
}

const SDK_BASE = 'https://oapi.map.naver.com/openapi/v3/maps.js';
const LOAD_TIMEOUT_MS = 12_000;  // 시안처럼 12초 안에 못 불러오면 실패 화면
const LABEL_ZOOM_THRESHOLD = 13;  // 실시간 라벨은 이 줌 이상에서만

// 클라이언트 인증 실패(도메인 미등록 등) — SDK가 전역 콜백을 부른다. 지도 화면이 실패 화면으로 바뀌게 알린다.
const authFailureListeners = new Set<() => void>();
let authFailed = false;
function hookAuthFailure() {
  if (typeof window === 'undefined') return;
  window.navermap_authFailure = () => { authFailed = true; authFailureListeners.forEach((l) => l()); };
}

function loadNaverSdk(clientId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.naver?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src*="${SDK_BASE}"]`);
    // 앞선 시도가 실패한 스크립트는 지우고 새로 붙인다('다시 불러오기')
    if (script && script.dataset.failed === '1') { script.remove(); script = null; }
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      if (err) { if (script) script.dataset.failed = '1'; reject(err); } else resolve();
    };
    // load 이벤트가 이미 지나간 경우도 있어 window.naver 등장을 폴링으로도 확인
    const poll = setInterval(() => { if (window.naver?.maps) finish(); }, 100);
    const timer = setTimeout(() => finish(new Error('Naver SDK load timeout')), LOAD_TIMEOUT_MS);
    if (!script) {
      script = document.createElement('script');
      script.src = `${SDK_BASE}?ncpKeyId=${encodeURIComponent(clientId)}`;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => { if (window.naver?.maps) finish(); });
    script.addEventListener('error', () => finish(new Error('Naver SDK load failed')));
  });
}

// 핀 CSS는 한 페이지에서 한 번만 주입. 지도 타일은 다크 모드에서도 밝으므로 핀은 라이트 색으로 고정.
// 핀 모양은 기존 야화 핀(원형 대표사진, 줌인 시 매장명 라벨) 그대로 — 대표 결정(1014).
function injectPinCssOnce() {
  if (typeof document === 'undefined' || window.__yahwaPlacePinCss2) return;
  const style = document.createElement('style');
  style.textContent = `
    .yahwa-pin { position: relative; display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; }
    .yahwa-pin .dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: #bf3127;
      box-shadow: 0 0 0 2px #fff, 0 2px 4px rgba(0,0,0,0.25);
      transition: transform 0.12s ease, background 0.12s ease;
    }
    .yahwa-pin.hot .dot { background: #bf3127; }
    .yahwa-pin:not(.hot) .dot { background: #212124; }
    .yahwa-pin:hover .dot { transform: scale(1.25); }
    /* 매장 대표 이미지 핀 — 흰 링 + 원형 썸네일 */
    .yahwa-pin.img .dot {
      width: 30px; height: 30px;
      background-size: cover; background-position: center;
      background-color: #FAFAFB;
      box-shadow: 0 0 0 2px #fff, 0 2px 5px rgba(0,0,0,0.28);
    }
    .yahwa-pin.img:hover .dot { transform: scale(1.12); }
    .yahwa-pin .label {
      display: none;
      margin-top: 5px;
      padding: 4px 9px;
      background: #fff;
      color: #212124;
      border: 1px solid #EFEFF1;
      border-radius: 9999px;
      font-size: 11px; font-weight: 700; line-height: 1.25;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.14);
      pointer-events: none;
      display: none;
      align-items: center;
      gap: 5px;
    }
    .yahwa-pin .label .nm { font-weight: 800; }
    .yahwa-pin .label .wait {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 6px; border-radius: 9999px;
      background: #FBECEA; color: #bf3127;
      font-size: 10px; font-weight: 800;
    }
    .yahwa-pin .label .wait .wd { width: 5px; height: 5px; border-radius: 50%; background: #bf3127; }
    .yahwa-pin .label .wait.none { background: #E8F7EF; color: #0EBE6F; }
    .yahwa-pin .label .wait.none .wd { background: #0EBE6F; }
    .yahwa-pin .label .total {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 6px; border-radius: 9999px;
      background: #EEF3FE; color: #212124;
      font-size: 10px; font-weight: 800;
    }
    .yahwa-pin.hot .label { border-color: #EDCFCB; }
    .yahwa-map.labels-on .yahwa-pin .label { display: inline-flex; }

    /* 내 위치 — 시안 circleMarker(반지름 7 · 흰 테두리 3 · 파란 채움) */
    .yahwa-me { box-sizing: border-box; width: 17px; height: 17px; border-radius: 50%; background: #315f83; border: 3px solid #fff; }
  `;
  document.head.appendChild(style);
  window.__yahwaPlacePinCss2 = true;
}

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  hot?: boolean;
  waiting?: number;  // 현재 웨이팅 팀 수 (undefined면 웨이팅 미운영 → 표시 안 함)
  total?: number;    // 실시간 총 인원 (잠금해제한 매장만 전달됨)
  image?: string;    // 매장 대표 이미지 — 있으면 핀을 원형 이미지로 표시
};

export type MapStatus = 'loading' | 'ready' | 'error';
export type MapBounds = { south: number; west: number; north: number; east: number };

// 지도의 보이는 영역 — LatLngBounds(getSW/getNE) 또는 Bounds(getMin/getMax)
function boundsOf(map: any): MapBounds | null {
  try {
    const b = map.getBounds();
    const sw = b.getSW ? b.getSW() : b.getMin();
    const ne = b.getNE ? b.getNE() : b.getMax();
    const lat = (q: any) => (typeof q.lat === 'function' ? q.lat() : q.y);
    const lng = (q: any) => (typeof q.lng === 'function' ? q.lng() : q.x);
    const r = { south: lat(sw), west: lng(sw), north: lat(ne), east: lng(ne) };
    return [r.south, r.west, r.north, r.east].every(Number.isFinite) ? r : null;
  } catch { return null; }
}

// 지도 조작 — 확대/축소 버튼·매장 선택 시 이동
export type NaverMapWebHandle = {
  zoomBy: (delta: number) => void;
  focus: (lat: number, lng: number, zoom?: number) => void;
};

// 기존 핀 — 대표 이미지가 있으면 원형 썸네일(30px), 없으면 점(14px). 줌인 시 매장명(+웨이팅) 라벨.
function pinHtml(p: MapPin): string {
  let waitHtml = '';
  if (typeof p.waiting === 'number') {
    waitHtml = p.waiting > 0
      ? `<span class="wait"><span class="wd"></span>웨이팅 ${p.waiting}팀</span>`
      : `<span class="wait none"><span class="wd"></span>바로 입장</span>`;
  }
  const totalHtml = typeof p.total === 'number' ? `<span class="total">총 ${p.total}명</span>` : '';
  // CSS 인젝션 방어 — https + 안전 문자만 허용
  const safeImg = p.image && /^https:\/\/[^'"()\\\s<>]+$/.test(p.image) && !p.image.includes('&#') ? p.image : undefined;
  const dotHtml = safeImg ? `<div class="dot" style="background-image:url('${safeImg}')"></div>` : `<div class="dot"></div>`;
  return `<div class="yahwa-pin${p.hot ? ' hot' : ''}${safeImg ? ' img' : ''}">`
    + dotHtml
    + `<div class="label"><span class="nm">${escapeHtml(p.label)}</span>${waitHtml}${totalHtml}</div>`
    + `</div>`;
}
const pinAnchor = (p: MapPin) => (p.image ? 15 : 7);  // 점 가운데를 좌표에 맞춤

export const NaverMapWeb = forwardRef<NaverMapWebHandle, {
  center: { lat: number; lng: number };
  pins: MapPin[];
  userLocation?: { lat: number; lng: number } | null;  // 내 위치 마커
  onSelect?: (id: string) => void;
  onStatus?: (s: MapStatus) => void;
  onBounds?: (b: MapBounds) => void;  // 지도가 멈출 때마다 보이는 영역(목록·개수 범위)
  height?: number | string;
}>(function NaverMapWeb({ center, pins, userLocation, onSelect, onStatus, onBounds, height = '100%' }, ref) {
  const divRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [attempt, setAttempt] = useState(0);  // '다시 불러오기'
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, { marker: any; pin: MapPin }>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const clientId = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID;

  useEffect(() => { onStatus?.(status); }, [status, onStatus]);

  useImperativeHandle(ref, () => ({
    zoomBy: (delta) => {
      const m = mapRef.current;
      if (!m) return;
      m.setZoom(m.getZoom() + delta, true);
    },
    focus: (lat, lng, zoom) => {
      const m = mapRef.current;
      const naver = window.naver;
      if (!m || !naver?.maps) return;
      const ll = new naver.maps.LatLng(lat, lng);
      if (zoom != null && typeof m.morph === 'function') m.morph(ll, zoom);
      else m.panTo(ll);
    },
  }), []);

  // 1) Map init — mount 시(그리고 '다시 불러오기' 때) 1회.
  useEffect(() => {
    if (!clientId) { setStatus('error'); return; }
    injectPinCssOnce();
    hookAuthFailure();
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let roTimer: ReturnType<typeof setTimeout> | undefined;
    const onAuthFail = () => { if (!cancelled) setStatus('error'); };
    authFailureListeners.add(onAuthFail);
    setStatus('loading');
    loadNaverSdk(clientId)
      .then(() => {
        if (cancelled || !divRef.current || !window.naver?.maps) return;
        if (authFailed) { setStatus('error'); return; }
        const naver = window.naver;
        const map = new naver.maps.Map(divRef.current, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: 15,  // 시안 첫 화면 줌
          mapTypeControl: false,
          scaleControl: false,
          logoControl: true,
          mapDataControl: false,
          zoomControl: false,
        });
        mapRef.current = map;
        // 줌에 따라 실시간 라벨 보이기(지도 상자 class만 바꾼다)
        const el0 = divRef.current;
        const updateLabels = () => { el0.classList.toggle('labels-on', map.getZoom() >= LABEL_ZOOM_THRESHOLD); };
        naver.maps.Event.addListener(map, 'zoom_changed', updateLabels);
        updateLabels();
        // 지도가 멈추면(이동·줌 끝) 보이는 영역을 알린다 — 시안 moveend
        const emitBounds = () => { const b = boundsOf(map); if (b) onBoundsRef.current?.(b); };
        naver.maps.Event.addListener(map, 'idle', emitBounds);
        emitBounds();
        // 시트를 펼치고 접으면 지도 높이가 바뀐다 — 크기를 다시 맞춘다(시안 invalidateSize)
        if (typeof ResizeObserver !== 'undefined') {
          const el = divRef.current;
          ro = new ResizeObserver(() => {
            clearTimeout(roTimer);
            roTimer = setTimeout(() => {
              // 시안 invalidateSize처럼 가운데를 유지한 채 크기만 바꾸고, 바뀐 영역을 알린다
              try {
                const c = map.getCenter?.();
                map.setSize?.(new naver.maps.Size(el.clientWidth, el.clientHeight));
                if (c) map.setCenter(c);
              } catch { /* 무시 */ }
              const b = boundsOf(map); if (b) onBoundsRef.current?.(b);
            }, 60);
          });
          ro.observe(el);
        }
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => {
      cancelled = true;
      authFailureListeners.delete(onAuthFail);
      clearTimeout(roTimer);
      ro?.disconnect();
      markersRef.current.forEach(({ marker }) => { try { marker.setMap?.(null); } catch { /* SDK 상태 붕괴 — 무시 */ } });
      markersRef.current = new Map();
      try { mapRef.current?.destroy?.(); } catch { /* 무시 */ }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, attempt]);

  const ready = status === 'ready';

  // 2) center 변경 시 setCenter
  useEffect(() => {
    if (!ready || !mapRef.current || !window.naver?.maps) return;
    mapRef.current.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
  }, [ready, center.lat, center.lng]);

  // 2.5) 내 위치 마커
  useEffect(() => {
    if (!ready || !mapRef.current || !window.naver?.maps) return;
    const naver = window.naver;
    if (!userLocation) return;
    try {
      userMarkerRef.current = new naver.maps.Marker({
        position: new naver.maps.LatLng(userLocation.lat, userLocation.lng),
        map: mapRef.current,
        title: '내 위치',
        icon: { content: '<div class="yahwa-me"></div>', anchor: new naver.maps.Point(8.5, 8.5) },
        zIndex: 5000,  // 매장 핀 위
      });
    } catch { userMarkerRef.current = null; return; }
    return () => {
      try { userMarkerRef.current?.setMap?.(null); } catch { /* 무시 */ }
      userMarkerRef.current = null;
    };
  }, [ready, userLocation?.lat, userLocation?.lng]);

  // 3) 매장 핀 — pins가 바뀌거나 지도가 준비되면 다시 만든다.
  // SDK 인증 실패/파괴 상태에서 marker 조작이 throw하면 React 트리 전체가 백지가 된다 — 전부 방어적으로.
  useEffect(() => {
    if (!ready || !mapRef.current || !window.naver?.maps) return;
    const naver = window.naver;
    markersRef.current.forEach(({ marker }) => { try { marker.setMap?.(null); } catch { /* 무시 */ } });
    const next = new Map<string, { marker: any; pin: MapPin }>();
    try {
      pins.forEach((p) => {
        const a = pinAnchor(p);
        const m = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map: mapRef.current,
          title: p.label,
          icon: { content: pinHtml(p), anchor: new naver.maps.Point(a, a) },
          zIndex: p.hot ? 1000 : 100,
        });
        naver.maps.Event.addListener(m, 'click', () => onSelectRef.current?.(p.id));
        next.set(p.id, { marker: m, pin: p });
      });
    } catch { /* 일부만 만들어진 경우에도 정리할 수 있게 그대로 둔다 */ }
    markersRef.current = next;
  }, [ready, pins]);

  // RN-web은 View가 div로 렌더. 네이버 SDK는 순수 DOM 요소 필요 → div 직접 사용.
  return (
    <View style={{ flex: 1 }}>
      <div
        ref={divRef as any}
        className="yahwa-map"
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: colors.bgSoft,
        }}
      />
      {status !== 'ready' && <MapStatusOverlay status={status} onRetry={() => setAttempt((n) => n + 1)} />}
    </View>
  );
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ));
}
