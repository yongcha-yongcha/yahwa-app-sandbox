// 야화 — 빌드 플래그.
import { Platform } from 'react-native';

// DEMO 모드는 v0.5에서 제거됨. 항상 실제 Supabase 데이터만 사용.
// 폴백 시드는 더 이상 노출하지 않음 — 빈 상태 UI로 처리.
export const IS_DEMO = false;

// iOS 리프 재오픈(2026-08-18 대표 지시) — 심사(3.1.1) 때만 숨겼던 충전·결제 개념을
// 다시 노출. 되돌릴 땐 두 값을 Platform.OS === 'ios' 로만 바꾸면 전 화면이 다시 은닉된다.
export const HIDE_IOS_LEAF_TOPUP = false;
export const HIDE_IOS_CURRENCY = false;

// 홈 좌측 상단 내 위치/지역명 표시 — 초기엔 유저가 적어 지역 개념을 숨김.
// 지역 기반 노출을 되살릴 때 true로 변경.
export const SHOW_HOME_LOCATION = false;

// 티어(등급) 개념 노출 — 2026-07 리뉴얼에서 잠시 숨김(마이페이지 티어 카드·충전 보너스 문구).
// 되살릴 때 true로 변경.
export const SHOW_TIER = false;

// 인연 리뉴얼 — '호감' 탭 노출 (관심/메시지/모자이크 만료).
export const SHOW_MUTUAL_TAB = true;

// '오늘의 운세'(타로) 탭 노출 — 인연 리뉴얼에서 숨김. 되살릴 때 true.
export const SHOW_FORTUNE_TAB = false;

// 플레이스 실시간 기능(원격 웨이팅·실시간 인원) — 대표 지시(2026-08-21)로 당분간 미제공.
// 복구 시 이 플래그만 true로 되돌리면 지도/상세의 관련 UI가 모두 되살아난다.
export const SHOW_STORE_LIVE = false;
