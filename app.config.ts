// 야화 시연판 — Expo 설정(웹 시연 전용). 스토어 빌드·OTA·푸시 설정은 뺐다.
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '야화 시연판',
  slug: 'yahwa-demo',
  version: '0.0.0',
  orientation: 'portrait',
  scheme: 'yahwademo',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  icon: './assets/logo.png',
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/logo.png',
  },
  plugins: ['expo-router', 'expo-web-browser'],
  experiments: { typedRoutes: true },
};

export default config;
