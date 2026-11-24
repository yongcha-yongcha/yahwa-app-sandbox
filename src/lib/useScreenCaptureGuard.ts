// 야화 — 앱 전역 화면 캡처 차단.
//
// 회원 사진·연락처가 그대로 노출되는 서비스라 스크린샷/화면녹화를 막는다.
//   · Android: 윈도우에 FLAG_SECURE — 스크린샷·녹화 모두 차단(검은 화면으로 저장)
//   · iOS 13+: 스크린샷·녹화 시 앱 화면이 가려짐. iOS 12 이하는 OS가 지원하지 않아 무동작.
//
// ⚠️ expo-screen-capture는 네이티브 모듈이라 OTA로 추가되지 않는다. 모듈이 없는
//    기존 빌드에서 그냥 require하면 모듈 최상위 requireNativeModule이 던지는 에러를
//    Metro가 catch 없이 FATAL로 올려버린다(현위치 크래시와 동일 함정).
//    → requireOptionalNativeModule로 존재를 먼저 확인한 뒤에만 require한다.
import { useEffect } from 'react';

function loadScreenCapture(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core: any = require('expo-modules-core');
    if (!core?.requireOptionalNativeModule?.('ExpoScreenCapture')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: any = require('expo-screen-capture');
    const api = typeof mod?.preventScreenCaptureAsync === 'function' ? mod
              : typeof mod?.default?.preventScreenCaptureAsync === 'function' ? mod.default
              : null;
    return api;
  } catch {
    return null;
  }
}

export function useScreenCaptureGuard() {
  useEffect(() => {
    // 개발 빌드(에뮬레이터 화면 대조)에서는 캡처를 막지 않는다 — 배포 앱(__DEV__ false)은 그대로 차단
    if (__DEV__) return;
    const SC = loadScreenCapture();
    if (!SC) return;               // 모듈 미포함 빌드 — 다음 네이티브 빌드부터 적용된다
    let alive = true;
    SC.preventScreenCaptureAsync().catch(() => { /* 차단 실패해도 앱은 정상 동작 */ });
    return () => {
      alive = false;
      void alive;
      // 앱이 살아있는 동안 계속 차단 — 해제는 하지 않는다.
    };
  }, []);
}
