import '../src/lib/webPhoneFrame';  // PC 웹 앱 기둥 — 다른 모듈보다 먼저
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { forceLightAppearance } from '../src/lib/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/query';
import { Toast } from '../src/components/Toast';
import { ReportSheet } from '../src/components/ReportSheet';
import { ConfirmLeafSpend } from '../src/components/ConfirmLeafSpend';
import { ConfirmCurrency } from '../src/components/ConfirmCurrency';
import { Paywall } from '../src/components/Paywall';
import { CrashGuard } from '../src/components/CrashGuard';
import { useOtaUpdate } from '../src/lib/useOtaUpdate';
import { useScreenCaptureGuard } from '../src/lib/useScreenCaptureGuard';
import { RewardLayer } from '../src/components/RewardLayer';
import { ActionFeedback } from '../src/components/ActionFeedback';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { FONT_FILES, installAppFont } from '../src/lib/appFont';
import { mountDemoPanel } from '../src/demo/panel/mount';

// 야화 시연판 — PC 브라우저 오른쪽 시연도구
if (Platform.OS === 'web' && typeof document !== 'undefined') mountDemoPanel();

// 웹은 CSS로 바로 적용(글꼴 파일은 브라우저가 받아 온다)
if (Platform.OS === 'web') installAppFont();
// 다크 모드 없음(1120) — 폰이 다크여도 알림창·키보드까지 라이트로
forceLightAppearance();

export default function RootLayout() {
  // OTA 즉시 적용 — 콜드 스타트 시 새 번들 확인 후 자동 리로드 (두 번 재실행 불필요)
  useOtaUpdate();
  // 스크린샷·화면녹화 차단 (Android FLAG_SECURE / iOS 13+)
  useScreenCaptureGuard();
  // 앱 글꼴 Pretendard(1013) — 로딩이 끝나야 Text를 Pretendard로 바꿔 끼운다. 그 전엔 잠깐 빈 화면(스플래시 유지)
  const [fontsLoaded, fontError] = useFonts(Platform.OS === 'web' ? {} : FONT_FILES);
  if (Platform.OS !== 'web') {
    if (!fontsLoaded && !fontError) return null;
    // 글꼴 로딩이 실패해도 휴대폰 '글자 크기' 확대 막기(maxFontSizeMultiplier 1)는 건다
    installAppFont(!!fontsLoaded);
  }
  return (
    // 잡히지 않은 JS 에러로 앱이 조용히 꺼지지 않게 — 원인을 화면에 남긴다
    <CrashGuard>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <Toast />
          <RewardLayer />
          <ReportSheet />
          <ConfirmLeafSpend />
          <ConfirmCurrency />
          <Paywall />{/* 전역 마운트 — 모든 화면(오버레이 포함)에서 리프 부족 시 즉시 표시 */}
          <ActionFeedback />{/* 행동 피드백(마음·편지 보냄) — 맨 위에 덮는다 */}
        </SafeAreaProvider>
      </QueryClientProvider>
    </CrashGuard>
  );
}
