// 야화 — 쿠폰함(지도 + 매장 목록). 리뉴얼 1120 · spec-rest §4.1 · §9.2 — 하단 탭이 아니라 MY › 쿠폰함으로 들어오는 쌓이는 화면이다.
// 화면 전체가 한 장의 세로 스크롤: 요약 카드(내 쿠폰함 · 매장 포인트) → 검색 칸 → 분류 칩 → 지도 카드 → '혜택 매장 N곳 | 전체 M곳' → 매장 티켓 줄(10곳씩).
// 지도(웹: 네이버 지도 v3 SDK / 네이티브: @mj-studio/react-native-naver-map) · 실제 매장 데이터 · 거리순 정렬 · 위치 권한 흐름은 예전 그대로다.
// Expo Go에서는 네이티브 모듈 로드 불가 → 실패 화면. dev/prebuild 빌드에서만 정상 동작.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, TextInput, useWindowDimensions } from 'react-native';
import { colors, radius, shadow } from '../tokens';
import { Store } from '../data/mock';
import { useStores, useGenderStats, useUnlockGenderFlow } from '../lib/hooks';
import { SHOW_STORE_LIVE } from '../lib/flags';
import { NaverMapWeb, type MapPin, type MapStatus, type MapBounds, type NaverMapWebHandle } from '../components/NaverMapWeb';
import { Image as ExpoImage } from 'expo-image';
import { thumbUrl } from '../lib/img';
import { Icons } from '../icons';
import { restoreRef, saveScroll } from '../lib/scrollMemory';
import { apiOrigin } from '../lib/apiOrigin';
import { requireAuth, previewSelectors, usePreview } from '../lib/previewStore';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { ZoomIcon } from '../components/place/PlaceIcons';
import { PlaceShopRow } from '../components/place/PlaceShopRow';
import { MapStatusOverlay } from '../components/place/MapStatusOverlay';
import { CatChip, PlaceButton } from '../components/place/ui';
import { useCouponList, useStoreCouponFlow, isUsable } from '../components/place/coupons';
import { PointHelpSheet } from '../components/place/PointLedger';
import { BottomSheet, Button, Icon, SheetHeader } from '../ui';
import { Screen } from '../components/my/ui';
import { myParams, type MyNav } from '../components/my/nav';
import { TabTour } from '../components/tour/TabTour';
import { tourRef } from '../components/tour/tourTargets';

// 동적 import — Expo Go에서는 native module 없음 → fallback 렌더링
let NaverMapView: any = null;
let NaverMapMarkerOverlay: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@mj-studio/react-native-naver-map');
  NaverMapView = mod.NaverMapView;
  NaverMapMarkerOverlay = mod.NaverMapMarkerOverlay;
} catch {
  /* native module 없음 — fallback */
}

// 첫 화면 지도 중심 — 시안 setView(성수뚝섬점 부근, 줌 15)와 같은 자리
const SEOUL_CENTER = { latitude: 37.5465, longitude: 127.0432 };  // 성수동
const START_ZOOM = 15;

// 플레이스 카테고리 탭(1013 고정, 순서 그대로) — stores.category 값과 같은 이름을 쓴다
const PLACE_CATEGORIES = ['전체', '혼술바', '술집', '음식점', '카페', '뷰티', '숙박'];
// 매장 목록을 끊어 보여 주는 단위(130곳을 한 번에 늘어놓지 않는다)
const PAGE = 10;

// 매장 대표 사진(네이버에서 가져온 사진 중 첫 장)
const firstPhoto = (s: Store): string | undefined => (s.imageUrls ?? []).filter(Boolean)[0] ?? (s as any).image_urls?.[0] ?? undefined;

// 네이티브 매장 핀 — 원형 프레임(흰 링) + 대표사진. 상호명(캡션) + 웨이팅(서브캡션, 줌인 시).
// iOS는 커스텀 View 자식을 이미지 로드 전에 스냅샷해 흰 원이 되므로: (1) 배경을 브랜드색으로 둬
// 로드 전에도 원형 핀처럼 보이게 하고, (2) 이미지 onLoad 시 자식 key를 한 번 바꿔 SDK 재스냅샷을 유도.
// memo — 지도를 멈출 때마다(목록 재정렬)·실시간 갱신·폴링마다 모든 핀이 다시 그려지고(=재스냅샷) 않게. onTap은 id를 받는 고정 함수.
const StoreMarker = React.memo(function StoreMarker({
  id, lat, lng, img, name, waitingText, waitingColor, selected, onTap,
}: {
  id: string; lat: number; lng: number; img?: string; name: string;
  waitingText?: string; waitingColor: string; selected?: boolean; onTap: (id: string) => void;
}) {
  const [snapKey, setSnapKey] = useState(0);
  return (
    <NaverMapMarkerOverlay
      latitude={lat}
      longitude={lng}
      width={40}
      height={40}
      anchor={{ x: 0.5, y: 0.5 }}
      caption={{ text: name, color: '#212124', haloColor: '#ffffff', textSize: 11, minZoom: 13 }}
      subCaption={waitingText ? { text: waitingText, color: waitingColor, haloColor: '#ffffff', textSize: 10, minZoom: 14 } : undefined}
      isHideCollidedCaptions
      isHideCollidedSymbols
      onTap={() => onTap(id)}
    >
      <View
        key={snapKey}
        style={{ width: 40, height: 40, borderRadius: 20, borderWidth: selected ? 3 : 2, borderColor: selected ? colors.primary : colors.surface, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
      >
        {img ? (
          <ExpoImage
            source={{ uri: thumbUrl(img, 200) ?? img }}  // 목록 줄 사진과 같은 크기 — 미리받은 캐시를 같이 쓴다
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={() => setSnapKey((k) => (k === 0 ? 1 : k))}
          />
        ) : (
          <Icons.pin size={16} color="#fff" />
        )}
      </View>
    </NaverMapMarkerOverlay>
  );
});

// 태그히어 좌석수(테이블 링크 개수) 동기화 — 앱 세션당 1회, 지도 진입 시 fire-and-forget.
let seatSyncDone = false;
async function syncSeatCapacityOnce(onSynced?: () => void) {
  if (seatSyncDone) return;
  seatSyncDone = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { seatSyncDone = false; return; }
    const r = await fetch(`${apiOrigin()}/api/taghere-sync-stores`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const body = await r.json().catch(() => null);
    if (body?.ok && body.updated > 0) onSynced?.();
  } catch { seatSyncDone = false; /* 다음 진입 때 재시도 */ }
}

export function MapScreen({ nav }: { nav: MyNav }) {
  const storesQ = useStores();
  const allStores = (storesQ.data as Store[] | undefined) ?? [];
  // 매장 쿠폰 (0103) — 카드의 '쿠폰 받기 / 내 쿠폰 보기'
  const { coupons: storeCoupons, busyStoreId, onCoupon } = useStoreCouponFlow(nav);
  // 요약 카드 — 쓸 수 있는 쿠폰 수 · 매장 포인트
  const usableCount = useCouponList().list.filter(isUsable).length;
  const points = usePreview(previewSelectors.points);
  const genderQ = useGenderStats(SHOW_STORE_LIVE);  // 잠금해제한 매장만 값이 옴 (30초 폴링) — 실시간 현황을 숨긴 동안엔 안 받는다
  const unlockFlow = useUnlockGenderFlow();  // 목록에서 바로 실시간 인원 잠금해제
  const totalOf = (storeId: string): number | undefined => {
    const g = genderQ.data?.[storeId];
    return g && g.totalCount > 0 ? g.totalCount : undefined;
  };
  // 실시간 현황(웨이팅·인원) 공개 요일 — 점주 설정(기본 금·토). 비공개 요일엔 지도/목록에서 숨김.
  const kstDow = new Date(Date.now() + 9 * 3600_000).getUTCDay();
  const statusOpenToday = (s: Store): boolean =>
    ((((s as any).genderStatsOpenDays ?? [5, 6]) as number[])).includes(kstDow);

  const hasNative = !!NaverMapView;
  const mapRef = useRef<any>(null);           // 네이티브 지도
  const webMapRef = useRef<NaverMapWebHandle>(null);
  // 현재 카메라 상태(줌 +/- 기준) — onCameraChanged로 갱신
  const camRef = useRef({ lat: SEOUL_CENTER.latitude, lng: SEOUL_CENTER.longitude, zoom: START_ZOOM });
  function zoomBy(delta: number) {
    if (Platform.OS === 'web') { webMapRef.current?.zoomBy(delta); return; }
    const c = camRef.current;
    const zoom = Math.max(1, Math.min(21, c.zoom + delta));
    mapRef.current?.animateCameraTo?.({ latitude: c.lat, longitude: c.lng, zoom, duration: 250 });
    camRef.current = { ...c, zoom };
  }
  // 지도 준비 상태 — 불러오는 중/실패면 시안처럼 라벨·버튼을 덮는다(검색 버튼만 남김)
  const [webMapStatus, setWebMapStatus] = useState<MapStatus>('loading');
  const mapStatus: MapStatus = Platform.OS === 'web' ? webMapStatus : hasNative ? 'ready' : 'error';

  // 좌석수 최신화 — 성공 시 stores 캐시 재조회로 "N/총좌석" 분모 즉시 반영
  const qcSeat = useQueryClient();
  // 좌석수는 실시간 현황(SHOW_STORE_LIVE)에서만 쓴다 — 숨긴 동안엔 동기화하지 않는다
  useEffect(() => { if (SHOW_STORE_LIVE) void syncSeatCapacityOnce(() => qcSeat.invalidateQueries({ queryKey: ['stores'] })); }, [qcSeat]);

  // 지도 카드 높이 — 시안 190을 최소로, 큰 화면에서는 화면 높이의 28%까지
  const { height: winH } = useWindowDimensions();
  const mapBoxH = Math.max(190, Math.round(winH * 0.28));
  // 지도 위 손가락은 지도가 먼저 받는다 — 누르는 동안만 바깥 세로 스크롤을 잠근다(누름 시작·끝에만 상태 변경)
  const [mapTouch, setMapTouch] = useState(false);

  // 사용자 현재 위치 — 정렬/지도 중심에 사용.
  const [mapCenter, setMapCenter] = useState({ lat: SEOUL_CENTER.latitude, lng: SEOUL_CENTER.longitude });
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // 지도를 내 위치로 옮겼는지 — 지역 라벨 '내 위치 주변' / '서울 · 성수'
  const [nearMe, setNearMe] = useState(false);
  // 시트 안내 줄(시안 .location-notice) — 위치·검색 결과 안내
  const [notice, setNotice] = useState('');

  // 지도가 보여주는 영역 — 목록을 이 가운데에서 가까운 순으로 정렬한다. 지도를 못 불러오면 null → 내 위치(성수) 기준.
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  // 목록 정렬은 영역 가운데만 쓴다 — 가운데·크기가 영역의 1% 안으로만 바뀌었으면(제자리 카메라 이동 등) 그대로 둬 재정렬·재렌더를 막는다
  const onBounds = useCallback((b: MapBounds) => {
    setBounds((prev) => {
      if (!prev) return b;
      const tol = Math.max(prev.north - prev.south, prev.east - prev.west) * 0.01;
      const near = (x: number, y: number) => Math.abs(x - y) <= tol;
      return near((prev.south + prev.north) / 2, (b.south + b.north) / 2)
        && near((prev.west + prev.east) / 2, (b.west + b.east) / 2)
        && near(prev.north - prev.south, b.north - b.south)
        && near(prev.east - prev.west, b.east - b.west) ? prev : b;
    });
  }, []);
  // 사용자가 지도를 직접 움직였는지 — 첫 진입 자동 이동이 손가락과 다투지 않게
  const userMovedMap = useRef(false);
  // 네이티브 지도 준비 전에 받은 내 위치 — 준비되면 그리로 옮긴다
  const nativeReady = useRef(false);
  const pendingCenter = useRef<{ lat: number; lng: number } | null>(null);
  function centerNativeOnce(lat: number, lng: number) {
    if (userMovedMap.current) return;
    setNearMe(true);
    if (!nativeReady.current) { pendingCenter.current = { lat, lng }; return; }
    camRef.current = { ...camRef.current, lat, lng };
    mapRef.current?.animateCameraTo?.({ latitude: lat, longitude: lng, duration: 0 });
  }

  // 첫 진입 — 위치 권한이 '이미' 허용돼 있으면 묻지 않고 내 위치를 가운데로. 아니면 서울 · 성수 그대로.
  // (권한을 묻는 건 현재 위치 버튼뿐)
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      const perms = (navigator as any).permissions;
      if (!perms?.query) return;  // 권한 상태를 알 수 없으면 묻지 않는다
      let alive = true;
      perms.query({ name: 'geolocation' }).then((st: { state: string }) => {
        if (!alive || st.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!alive) return;
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLoc(loc);
            setMapCenter(loc);
            setNearMe(true);
          },
          () => { /* 실패 — 기본 위치 유지 */ },
          { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
        );
      }).catch(() => { /* 무시 */ });
      return () => { alive = false; };
    }
    // 네이티브 — 예전엔 웹에서만 위치를 잡아 userLoc이 null로 남았고, 목록이 성수동
    // 기준으로 정렬됐다(권한을 허용해도 뚝섬점이 833m로 먼저 뜨던 원인).
    // 여기서는 '이미 허용된 경우'에만 조용히 읽는다 — 권한 요청 팝업은 현재위치 버튼이 담당.
    let alive = true;
    (async () => {
      const Location = loadLocationModule();
      if (!Location?.getForegroundPermissionsAsync) return;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || !alive) return;
        // 캐시 위치로 먼저 정렬을 맞추고(체감 속도), 이어서 정확한 좌표로 보정
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last?.coords && alive) {
          setUserLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
          centerNativeOnce(last.coords.latitude, last.coords.longitude);
        }
        const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced }), 10_000) as any;
        if (!alive) return;
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        centerNativeOnce(pos.coords.latitude, pos.coords.longitude);
      } catch {
        // 좌표 획득 실패(타임아웃 포함) — 권한은 있으니 지도 SDK 위치추적으로 받는다(onCameraChanged)
        if (alive) setTimeout(() => { try { mapRef.current?.setLocationTrackingMode?.('Follow'); } catch { /* noop */ } }, 800);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 위치 조회가 응답 없이 멈추는 기기가 있다(실내·GPS 약할 때). 기다리다 영영 성수 기준으로
  // 남지 않도록 시간 제한을 두고, 실패하면 지도 SDK 위치추적 → onCameraChanged(reason=Location)로 받는다.
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  }

  // 거리순 정렬 — userLoc 있으면 가까운 순, 없으면 성수동 기준. 각 매장에 dist(km) 부여.
  const sorted = useMemo(() => {
    const origin = userLoc ?? { lat: SEOUL_CENTER.latitude, lng: SEOUL_CENTER.longitude };
    const withDist = allStores.map((s) => ({
      s,
      dist: Number.isFinite(s.lat) && Number.isFinite(s.lng)
        ? haversineKm(origin.lat, origin.lng, s.lat as number, s.lng as number)
        : Number.POSITIVE_INFINITY,
    }));
    withDist.sort((a, b) => a.dist - b.dist);
    return withDist;
  }, [allStores, userLoc]);
  // 1013(대표 지시): 카테고리 탭 고정 — 매장이 없는 카테고리도 항상 노출.
  // stores.category 기준으로 거른다(제휴 업종 미용·네일아트는 승인 시 '뷰티'로 묶임).
  const [cat, setCat] = useState('전체');
  // 지도 핀 — 카테고리만 반영(지도를 끌 때 핀이 바로 보이게)
  const catView = useMemo(() => sorted.filter(({ s }) => cat === '전체' || s.cat === cat), [sorted, cat]);
  // 목록·개수 — 전체 매장을 보여 주되, 지금 보고 있는 지도 가운데에서 가까운 순(1014: 화면 안 매장만 보이면 너무 적다).
  // 표시 거리(dist)는 그대로 내 위치 기준이다.
  const view = useMemo(() => {
    if (!bounds) return catView;
    const c = { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
    const key = (x: { s: any }) => (Number.isFinite(x.s.lat) && Number.isFinite(x.s.lng)
      ? haversineKm(c.lat, c.lng, x.s.lat as number, x.s.lng as number) : Number.POSITIVE_INFINITY);
    return [...catView].sort((a, b) => key(a) - key(b));
  }, [catView, bounds]);
  // 고른 매장 — 시안처럼 처음엔 첫 매장(가장 가까운 곳)이 골라져 있다. 고른 매장은 목록 맨 위.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = chosenId ?? sorted[0]?.s.id ?? null;
  const listed = useMemo(
    () => [...view].sort((a, b) => Number(b.s.id === chosen) - Number(a.s.id === chosen)),
    [view, chosen],
  );

  // 뒤로 돌아와도 보던 위치 복원 — 마운트 때 한 번만(콜백을 고정해 렌더마다 다시 불리지 않게)
  const setListRef = useCallback((r: ScrollView | null) => { restoreRef('map-store-list')(r); }, []);
  const onScrollY = useCallback((y: number) => saveScroll('map-store-list', y), []);
  // 매장 고르기 — 핀·검색 결과. 지도를 그 매장으로 옮긴다(검색은 줌 15).
  function choose(id: string, zoom?: number) {
    setChosenId(id);
    const s = allStores.find((x) => x.id === id);
    if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
    if (Platform.OS === 'web') webMapRef.current?.focus(s.lat as number, s.lng as number, zoom);
    else {
      mapRef.current?.animateCameraTo?.({ latitude: s.lat, longitude: s.lng, ...(zoom ? { zoom } : null), duration: 300 });
      camRef.current = { lat: s.lat as number, lng: s.lng as number, zoom: zoom ?? camRef.current.zoom };
    }
  }

  // 핀·카드에 넘기는 고정 콜백(id 기반) — 렌더마다 새 함수를 만들면 memo된 핀·카드가 전부 다시 그려진다
  const actRef = useRef({ choose, nav });
  actRef.current = { choose, nav };
  const onPinTap = useCallback((id: string) => actRef.current.choose(id), []);
  const onRowOpen = useCallback((id: string) => actRef.current.nav.openStore(id), []);

  // 매장 상세 '지도에서 보기'로 들어오면 그 매장을 가운데로(줌 16) — 매장 목록을 받은 뒤 한 번
  useEffect(() => {
    const id = myParams.placeFocusStoreId;
    if (!id || !allStores.length) return;
    myParams.placeFocusStoreId = null;
    const t = setTimeout(() => actRef.current.choose(id, 16), 400);  // 지도가 준비될 틈
    return () => clearTimeout(t);
  }, [allStores.length]);

  // ── 검색 칸 — 매장 이름·주소로 찾는다
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Store[]>([]);
  function runSearch() {
    const q = query.trim();
    if (!q) return;
    setNotice('');
    // 가까운 매장부터(거리순 목록 순서 그대로)
    const r = sorted.map(({ s }) => s).filter((s) => `${s.name} ${s.address ?? ''}`.includes(q));
    setResults(r);
    if (!r.length) setNotice('검색 결과가 없어요. 지역이나 매장명을 다시 확인해주세요.');
  }
  function pickResult(s: Store) {
    setCat('전체');
    setResults([]);
    setNotice('');
    choose(s.id, 15);
  }

  // 목록 — 접힌 상태는 지도 안의 매장만(범위를 모르면 가까운 순 앞쪽 3곳), '전체 보기'면 전부
  const [expanded, setExpanded] = useState(false);
  const inMap = useMemo(() => (bounds
    ? listed.filter(({ s }) => Number.isFinite(s.lat) && Number.isFinite(s.lng)
      && (s.lat as number) >= bounds.south && (s.lat as number) <= bounds.north && (s.lng as number) >= bounds.west && (s.lng as number) <= bounds.east)
    : listed.slice(0, 3)), [listed, bounds]);
  const shown = expanded ? listed : inMap;
  // 한 번에 보여 줄 매장 수 — 범위 · 분류를 바꾸면 처음 10곳으로
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [expanded, cat]);

  // 안내 시트 — 포인트 · 지도
  const [help, setHelp] = useState<'point' | 'map' | null>(null);

  // 네이티브 현재 위치 — expo-location으로 실제 좌표를 받아 카메라를 직접 이동한다.
  // (이전엔 지도 SDK의 Follow 모드에만 의존했는데, iOS는 런타임 권한 요청 경로가 아예 없어
  //  위치를 못 잡고 카메라가 멈춰 있었다. 좌표를 직접 받으면 거리순 정렬에도 쓸 수 있다.)
  // expo-location은 네이티브 모듈이라 OTA로 추가되지 않는다. 모듈이 없는 기존 빌드에서는
  // ⚠️ try/catch만으로는 절대 막을 수 없다. expo-location은 모듈 최상위에서
  //    requireNativeModule('ExpoLocation')을 호출하는데, 모듈 팩토리에서 던진 에러는
  //    Metro의 guardedLoadModule이 rethrow 없이 ErrorUtils.reportFatalError로 직행시킨다
  //    (metro-runtime/src/polyfills/require.js). → catch에 안 걸리고 CrashGuard 에러화면.
  // → requireOptionalNativeModule로 네이티브 모듈 존재를 먼저 확인한 뒤에만 require한다.
  //   (photoUpload.ts의 expo-image-manipulator와 동일한 패턴)
  function loadLocationModule(): any | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const core: any = require('expo-modules-core');
      if (!core?.requireOptionalNativeModule?.('ExpoLocation')) return null;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod: any = require('expo-location');
      const api = mod?.requestForegroundPermissionsAsync ? mod
                : mod?.default?.requestForegroundPermissionsAsync ? mod.default
                : null;
      return typeof api?.getCurrentPositionAsync === 'function' ? api : null;
    } catch {
      return null;
    }
  }

  // 폴백 — expo-location이 없는 빌드에서는 지도 SDK 내장 위치추적을 쓴다.
  // (정확한 좌표를 받지 못하므로 거리순 정렬 기준은 갱신되지 않는다)
  function recenterViaMapSdk() {
    try {
      mapRef.current?.setLocationTrackingMode?.('Follow');
      setTimeout(() => { try { mapRef.current?.setLocationTrackingMode?.('Follow'); } catch { /* noop */ } }, 700);
      setTimeout(() => setLocating(false), 1600);
      setNearMe(true);
    } catch {
      setLocating(false);
      setNotice('위치 권한을 확인해주세요. 성수 지도로 계속 볼 수 있어요.');
    }
  }

  async function recenterNative() {
    setLocating(true);
    const Location = loadLocationModule();
    if (!Location) {
      // 구버전 빌드 — 크래시 대신 지도 SDK 위치추적으로 처리(안드로이드는 SDK 위치추적에도 권한이 필요해 여기서만 묻는다)
      if (Platform.OS === 'android') {
        const { PermissionsAndroid } = require('react-native');
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).catch(() => null);
      }
      recenterViaMapSdk();
      return;
    }
    try {
      // 권한은 expo-location으로 한 번만 묻는다 — 예전엔 안드로이드에서 PermissionsAndroid로 먼저 묻고 또 물어,
      // 한 번 거절이 Android 11+에서 '다시 묻지 않음'(영구 거절)이 됐다
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocating(false);
        setNotice('위치 권한을 확인해주세요. 성수 지도로 계속 볼 수 있어요.');
        const { Alert, Linking } = require('react-native');
        Alert.alert(
          '위치 권한이 필요해요',
          '현재 위치를 보려면 설정에서 위치 권한을 허용해주세요.',
          [{ text: '취소', style: 'cancel' }, { text: '설정 열기', onPress: () => Linking.openSettings?.() }],
        );
        return;
      }
      // 마지막 캐시 위치가 있으면 즉시 이동(체감 속도) → 이어서 정확한 현재 위치로 보정
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last?.coords) moveTo(last.coords.latitude, last.coords.longitude);

      const pos = await withTimeout(Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.Balanced,
      }), 10_000) as any;
      moveTo(pos.coords.latitude, pos.coords.longitude);
      try { mapRef.current?.setLocationTrackingMode?.('NoFollow'); } catch { /* 선택 기능 */ }
      setLocating(false);
    } catch {
      // 권한은 있으나 좌표 획득 실패 — 지도 SDK 경로로 한 번 더 시도
      recenterViaMapSdk();
    }
  }

  // 좌표로 카메라 이동 + 거리순 정렬 기준 갱신
  function moveTo(lat: number, lng: number) {
    const loc = { lat, lng };
    setUserLoc(loc);
    setMapCenter(loc);
    setNearMe(true);
    setNotice('');
    camRef.current = { ...camRef.current, lat, lng };
    mapRef.current?.animateCameraTo?.({ latitude: lat, longitude: lng, zoom: 15, duration: 500 });
  }

  // 웹 현재 위치 — 시안처럼 내 위치로 옮기고 줌 15, 실패하면 시트에 안내 줄
  function recenterToMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice('이 기기에서는 위치를 확인할 수 없어요.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        setNearMe(true);
        setNotice('');
        webMapRef.current?.focus(loc.lat, loc.lng, 15);
      },
      () => {
        setLocating(false);
        setNotice('위치 권한을 확인해주세요. 성수 지도로 계속 볼 수 있어요.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // 웹 핀 — 기존 야화 핀(원형 대표사진 · 줌인 시 매장명). 매 렌더마다 핀을 다시 만들지 않게 메모.
  const webPins = useMemo(() => catView
    .filter(({ s }) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map(({ s }): MapPin => {
      const u = firstPhoto(s);
      return {
        id: s.id,
        lat: s.lat as number,
        lng: s.lng as number,
        label: s.name,
        waiting: SHOW_STORE_LIVE && s.waitingEnabled !== false && statusOpenToday(s) ? (s.waitingCount ?? 0) : undefined,
        total: SHOW_STORE_LIVE && statusOpenToday(s) ? totalOf(s.id) : undefined,
        // 30px 원형 핀 — 원본을 수십 장 받으면 지도가 느려진다. 작은 썸네일로(목록 줄 사진과 같은 200 — 캐시 공유).
        image: u ? (thumbUrl(u, 200) ?? u) : undefined,
      };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [catView, genderQ.data]);

  const mapReady = mapStatus === 'ready';

  return (
    <Screen title="쿠폰함" onBack={nav.back} scrollRef={setListRef} onScrollY={onScrollY} scrollEnabled={!mapTouch}>
      {/* 요약 카드 — 내 쿠폰함 N장 | 매장 포인트 N P */}
      <View style={{ flexDirection: 'row', paddingVertical: 12, borderRadius: radius.cta, backgroundColor: colors.bgSoft }}>
        <SummaryCell label="내 쿠폰함" value={String(usableCount)} unit="장" onPress={() => { if (!requireAuth('로그인하면 쿠폰함을 쓸 수 있어요')) return; myParams.couponTab = 'usable'; nav.push('couponWallet'); }} />
        <View style={{ width: 1, backgroundColor: colors.line }} />
        <SummaryCell label="매장 포인트" value={points.toLocaleString()} unit="P" onPress={() => { if (requireAuth('로그인하면 매장 포인트를 볼 수 있어요')) nav.push('myPointLedger'); }} />
      </View>

      {/* 검색 칸 — 첫 방문 안내 대상 */}
      <View ref={tourRef('place.search')} collapsable={false} style={{ marginTop: 16, height: 46, borderRadius: radius.cta, backgroundColor: colors.bgSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={(t) => { setQuery(t); setResults([]); }}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder="지역이나 매장을 찾아보세요"
          placeholderTextColor={colors.subtle}
          accessibilityLabel="지역 또는 매장 검색"
          selectionColor={colors.focus}
          style={[{ flex: 1, height: 46, padding: 0, fontSize: 14, color: colors.text }, Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as any) : null]}
        />
        <Pressable onPress={runSearch} accessibilityRole="button" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.accentStrong }}>검색</Text>
        </Pressable>
      </View>
      {results.map((s) => (
        <Pressable key={s.id} onPress={() => pickResult(s)} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Icon name="map-pin" size={16} color={colors.mute} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 21, color: colors.text }}>{s.name}</Text>
        </Pressable>
      ))}
      {/* 위치·검색 안내 */}
      {!!notice && <Text accessibilityLiveRegion="polite" style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.sub }}>{notice}</Text>}

      {/* 분류 칩 — 우리 7개 고정, 가로 스크롤 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20 }} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
        {PLACE_CATEGORIES.map((c) => <CatChip key={c} label={c} selected={c === cat} onPress={() => setCat(c)} />)}
      </ScrollView>

      {/* 지도 카드 */}
      <View
        onTouchStart={() => setMapTouch(true)}
        onTouchEnd={() => setMapTouch(false)}
        onTouchCancel={() => setMapTouch(false)}
        style={{ height: mapBoxH, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.bgSoft }}
      >
        {Platform.OS === 'web' ? (
          <NaverMapWeb
            ref={webMapRef}
            center={mapCenter}
            userLocation={userLoc}
            pins={webPins}
            onSelect={(id) => choose(id)}
            onStatus={setWebMapStatus}
            onBounds={onBounds}
          />
        ) : hasNative ? (
          <NaverMapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialCamera={{ latitude: SEOUL_CENTER.latitude, longitude: SEOUL_CENTER.longitude, zoom: START_ZOOM }}
            // SDK 기본 위치/줌 컨트롤은 끄고 시안 자리에 직접 둔다.
            isShowLocationButton={false}
            isShowZoomControls={false}
            isShowCompass={false}
            // 북쪽 고정 — 회전·기울기가 있으면 보이는 영역(목록 범위)이 어긋난다
            isRotateGesturesEnabled={false}
            isTiltGesturesEnabled={false}
              onInitialized={() => {
                nativeReady.current = true;
                const pc = pendingCenter.current;
                pendingCenter.current = null;
                const c = pc && !userMovedMap.current ? pc : camRef.current;
                camRef.current = { ...camRef.current, lat: c.lat, lng: c.lng };
                mapRef.current?.animateCameraTo?.({ latitude: c.lat, longitude: c.lng, duration: 0 });
              }}
              onCameraChanged={(c: any) => {
                camRef.current = { lat: c.latitude, lng: c.longitude, zoom: c.zoom };
                if (c.reason === 'Gesture') userMovedMap.current = true;
                // 지도 SDK 위치추적이 카메라를 옮긴 경우 = 실제 내 위치. 목록 거리순 기준도 갱신한다.
                if (c.reason === 'Location' && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
                  setUserLoc({ lat: c.latitude, lng: c.longitude });
                  setLocating(false);
                }
              }}
              onCameraIdle={(c: any) => {
                camRef.current = { lat: c.latitude, lng: c.longitude, zoom: c.zoom };
                const r = c.region;
                if (r && [r.latitude, r.longitude, r.latitudeDelta, r.longitudeDelta].every(Number.isFinite)) {
                  onBounds({ south: r.latitude, west: r.longitude, north: r.latitude + r.latitudeDelta, east: r.longitude + r.longitudeDelta });
                }
              }}
            >
              {catView.map(({ s }) => {
                if (!NaverMapMarkerOverlay || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return null;
                const img = firstPhoto(s);
                // 웨이팅 현황은 노출 요일(statusOpenToday)에만. 줌인 시 상호명 아래 서브캡션으로 노출.
                const showWaiting = SHOW_STORE_LIVE && statusOpenToday(s) && s.waitingEnabled !== false;
                const wc = s.waitingCount ?? 0;
                const waitingText = showWaiting ? (wc > 0 ? `웨이팅 ${wc}팀` : '입장 가능') : undefined;
                return (
                  <StoreMarker
                    key={s.id}
                    id={s.id}
                    lat={s.lat as number}
                    lng={s.lng as number}
                    img={img}
                    name={s.name}
                    waitingText={waitingText}
                    waitingColor={wc > 0 ? colors.primary : colors.success}
                    selected={chosenId === s.id}
                    onTap={onPinTap}
                  />
                );
              })}
            </NaverMapView>
          ) : (
            <MapStatusOverlay status="error" />
          )}
        {mapReady && (
          <>
            {/* 확대 · 축소 — 오른쪽 위 세로 묶음 */}
            <View style={[{ position: 'absolute', top: 12, right: 12, width: 44, borderRadius: radius.cta, backgroundColor: colors.surface, overflow: 'hidden' }, shadow.note]}>
              <ZoomButton label="지도 확대" onPress={() => zoomBy(1)} />
              <ZoomButton label="지도 축소" minus onPress={() => zoomBy(-1)} />
            </View>
            {/* 내 위치 — 오른쪽 아래 알약 */}
            <Pressable
              onPress={Platform.OS === 'web' ? recenterToMe : recenterNative}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel="현재 위치"
              style={[{ position: 'absolute', right: 12, bottom: 12, height: 41, paddingHorizontal: 12, borderRadius: radius.cta, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', opacity: locating ? 0.5 : 1 }, shadow.note]}
            >
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>내 위치</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* 목록 머리 — 지금 보는 범위 개수 + 전체 개수(시안 coupon-box B안). 알약을 누르면 전체 ↔ 지도 안 */}
      <View style={{ marginTop: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View accessibilityRole="header">
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{expanded ? '지도 가운데에서 가까운 순' : '지금 지도 안'}</Text>
          <Text style={{ marginTop: 2, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.inverseStrong }}>
            {expanded ? '전체 혜택' : '혜택 매장'} <Text style={{ color: colors.accentStrong, fontVariant: ['tabular-nums'] }}>{shown.length}곳</Text>
          </Text>
        </View>
        {(expanded || listed.length > 0) && (
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? '지도 안 매장만 보기' : `전체 ${listed.length}곳 보기`}
            hitSlop={6}
            style={({ pressed }) => ({ height: 32, paddingLeft: 12, paddingRight: 4, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: pressed ? colors.muted : colors.bgSoft })}
          >
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{expanded ? '지도 안만' : `전체 ${listed.length}곳`}</Text>
            <Icon name="chevron-right" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* 빈 범위 */}
      {!shown.length && !!storesQ.data && (
        <View style={{ paddingTop: 8, paddingBottom: 8 }}>
          <Text style={{ marginBottom: 12, fontSize: 14, lineHeight: 22.4, color: colors.sub }}>이 주변에는 아직 입점 매장이 없어요.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PlaceButton label="범위 넓히기" onPress={() => { setCat('전체'); zoomBy(-2); }} />
            {!expanded && listed.length > 0 && <PlaceButton label="전체 보기" onPress={() => setExpanded(true)} />}
          </View>
        </View>
      )}
      <View style={{ marginTop: 8, gap: 8 }}>
        {shown.slice(0, limit).map(({ s, dist }) => (
          <PlaceShopRow
            key={s.id}
            s={s}
            photo={firstPhoto(s)}
            distance={userLoc && Number.isFinite(dist) ? fmtDistance(dist) : undefined}
            coupon={storeCoupons[s.id]}
            busy={busyStoreId === s.id}
            onOpen={onRowOpen}
            onCoupon={onCoupon}
          />
        ))}
      </View>
      {/* 긴 목록은 끊어 보여 준다 — 10곳씩 */}
      {shown.length > limit && (
        <PlaceButton
          label={`${Math.min(PAGE, shown.length - limit)}곳 더 보기 · ${shown.length - limit}곳 남음`}
          style={{ marginTop: 16 }}
          onPress={() => setLimit((n) => n + PAGE)}
        />
      )}

      {/* 아래 안내 줄 */}
      <FootRow label="포인트 적립·사용 안내" onPress={() => setHelp('point')} top={8} />
      <FootRow label="지도 이용 안내" onPress={() => setHelp('map')} />

      <PointHelpSheet open={help === 'point'} onClose={() => setHelp(null)} />
      <BottomSheet open={help === 'map'} onClose={() => setHelp(null)}>
        <SheetHeader
          title="지도"
          desc={`지도를 움직이거나 매장 핀을 눌러 주변 혜택을 확인하세요. 내 위치를 누르면 현재 위치로 이동해요.${userLoc ? ' 매장 목록은 지도 가운데에서 가까운 순이에요.' : ' 위치 권한을 허용하면 매장까지의 거리를 함께 보여드려요.'}`}
        />
        <Button size="sheet" block label="확인" onPress={() => setHelp(null)} />
      </BottomSheet>

      {/* 첫 방문 안내(새 가입자 한 번) — 검색 칸을 가리킨다 */}
      <TabTour tab="place" active={!help} />
    </Screen>
  );
}

// 요약 카드 한 칸 — 이름 12/17.4 → 숫자 20/26 600 + 단위 12 + 오른쪽 끝 꺾쇠
function SummaryCell({ label, value, unit, onPress }: { label: string; value: string; unit: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value}${unit}`} style={{ flex: 1, minHeight: 52, paddingHorizontal: 14 }}>
      <Text style={{ fontSize: 12, lineHeight: 17.4, color: colors.sub }}>{label}</Text>
      <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
        <Text style={{ marginLeft: 4, flex: 1, fontSize: 12, lineHeight: 21, color: colors.sub }}>{unit}</Text>
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </View>
    </Pressable>
  );
}

// 아래 안내 줄 — 높이 44 · 12 글자-안내 + 꺾쇠
function FootRow({ label, onPress, top = 0 }: { label: string; onPress: () => void; top?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ marginTop: top, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

// 확대/축소 버튼 — 44×44, 아래 버튼은 위 1px 선
function ZoomButton({ label, minus, onPress }: { label: string; minus?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: minus ? 1 : 0, borderTopColor: colors.line }}>
      <ZoomIcon minus={minus} color={colors.accent} />
    </Pressable>
  );
}


// 두 좌표 간 거리(km) — Haversine
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}