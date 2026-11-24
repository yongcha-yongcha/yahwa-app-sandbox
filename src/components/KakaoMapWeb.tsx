// 야화 — 카카오맵 v2 JavaScript SDK (web only).
// 동적 script 로드. EXPO_PUBLIC_KAKAO_MAP_KEY 필요.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { colors } from '../tokens';

declare global {
  interface Window {
    kakao?: any;
  }
}

const KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY || '';  // 시연판: 키 없음 — 지도 대신 빈 바탕
const SDK_BASE = 'https://dapi.kakao.com/v2/maps/sdk.js';

function loadKakaoSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.kakao?.maps?.LatLng) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // 카카오 콘솔 미등록 도메인일 때 발생하는 에러 캐치 (window.onerror)
    const origErr = window.onerror;
    let sdkErrMsg: string | null = null;
    window.onerror = (msg, src) => {
      if (typeof src === 'string' && src.includes('dapi.kakao.com')) {
        sdkErrMsg = String(msg);
      }
      return origErr ? (origErr as any)(msg, src) : false;
    };

    const finalize = () => {
      if (window.kakao?.maps?.load) {
        try {
          window.kakao.maps.load(() => resolve());
        } catch (e: any) {
          reject(new Error(`Kakao maps.load 실패: ${e?.message ?? e}`));
        }
        return;
      }
      if (window.kakao?.maps?.LatLng) { resolve(); return; }
      // 폴링
      let n = 0;
      const t = setInterval(() => {
        if (window.kakao?.maps?.LatLng) { clearInterval(t); resolve(); return; }
        if (window.kakao?.maps?.load) {
          clearInterval(t);
          try { window.kakao.maps.load(() => resolve()); }
          catch (e: any) { reject(new Error(`Kakao maps.load 실패: ${e?.message ?? e}`)); }
          return;
        }
        if (++n > 200) {
          clearInterval(t);
          reject(new Error(
            sdkErrMsg
              ? `카카오 SDK 에러: ${sdkErrMsg} — 카카오 디벨로퍼스 → 앱 → 플랫폼 → Web 사이트 도메인에 ${window.location.origin} 등록 필요`
              : `카카오 SDK가 응답하지 않아요. 카카오 디벨로퍼스 → 앱 → 플랫폼 → Web 사이트 도메인에 ${window.location.origin} 추가 후 새로고침해 주세요`,
          ));
        }
      }, 50);
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src*="${SDK_BASE}"]`);
    if (existing) {
      existing.addEventListener('load', finalize);
      existing.addEventListener('error', () => reject(new Error('Kakao SDK 스크립트 로드 실패 — 네트워크/도메인 확인')));
      finalize();
      return;
    }
    const s = document.createElement('script');
    s.src = `${SDK_BASE}?appkey=${encodeURIComponent(KEY)}&autoload=false`;
    s.async = true;
    s.onload = finalize;
    s.onerror = () => reject(new Error('Kakao SDK 스크립트 로드 실패 — 네트워크 또는 카카오 콘솔 도메인 미등록'));
    document.head.appendChild(s);
  });
}

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
};

export function KakaoMapWeb({
  center,
  pins,
  onSelect,
  height = '100%',
}: {
  center: { lat: number; lng: number };
  pins: MapPin[];
  onSelect?: (id: string) => void;
  height?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  // Init map (1회)
  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        if (cancelled || !ref.current || !window.kakao?.maps) return;
        const kakao = window.kakao;
        mapRef.current = new kakao.maps.Map(ref.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 5,
        });
      })
      .catch((e) => setErr(e?.message ?? 'SDK 로드 실패'));
    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => o.setMap?.(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // center 변경
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [center.lat, center.lng]);

  // pins 변경 — CustomOverlay로 라벨+핀
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao;
    overlaysRef.current.forEach((o) => o.setMap?.(null));
    overlaysRef.current = pins.map((p) => {
      const node = document.createElement('div');
      node.style.transform = 'translate(-50%, -100%)';
      node.style.cursor = 'pointer';
      node.innerHTML = `<div style="
        padding:5px 11px; background:${colors.night};
        color:#fff; border-radius:9999px;
        font-size:11px; font-weight:800; box-shadow:0 2px 8px rgba(0,0,0,0.18);
        white-space:nowrap;
      ">${p.label}</div>`;
      if (onSelect) node.addEventListener('click', () => onSelect(p.id));
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: node,
        yAnchor: 1,
      });
      ov.setMap(mapRef.current);
      return ov;
    });
  }, [pins, onSelect]);

  if (err) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EFE6', padding: 20 }}>
        <Text style={{ fontSize: 11.5, color: colors.sub, textAlign: 'center', lineHeight: 17 }}>
          카카오 지도를 띄울 수 없어요{'\n'}{err}
        </Text>
      </View>
    );
  }

  return (
    <div
      ref={ref as any}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: '#E8EFE6',
      }}
    />
  );
}
