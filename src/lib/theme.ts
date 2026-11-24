// 야화 — 테마. 다크 모드는 없다(대표 결정 11-20, docs/renewal-1120/decisions.md) —
// 폰이 다크 모드여도 항상 시안의 라이트 디자인으로 그린다. 아래는 기존 import가 깨지지 않게 남긴 껍데기다.
// 네이티브 부품(알림창·키보드·날짜 고르기)도 라이트로 고정한다 — app.config의 userInterfaceStyle은 스토어 빌드에만 반영되므로
// JS에서 Appearance.setColorScheme('light')를 함께 건다(OTA로 반영).
import { Appearance, Platform } from 'react-native';
import type { ThemeMode } from '../tokens';

export function forceLightAppearance() {
  if (Platform.OS === 'web') return;
  try { Appearance.setColorScheme?.('light'); } catch { /* 지원하지 않는 버전 — 화면 색은 어차피 라이트 고정 */ }
}

export async function loadPersistedTheme(): Promise<void> { /* 다크 모드 없음 */ }
export function toggleTheme(): ThemeMode { return 'light'; }
export function useThemeTick(): ThemeMode { return 'light'; }
export function useThemeMode(): ThemeMode { return 'light'; }
