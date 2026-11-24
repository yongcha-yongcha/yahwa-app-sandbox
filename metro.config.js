// 야화 — Metro 설정(Expo 기본값 + 웹 빌드에서 네이티브 전용 패키지 빼기)
// react-native-purchases(RevenueCat)는 웹에서 쓰지 않는데(src/lib/iap.ts가 웹이면 안 불러옴) 웹 SDK가 765KB나 묶여 들어가
// 첫 로딩을 늦춘다. 네이버 지도 네이티브 패키지도 웹은 v3 SDK(MapScreen)를 쓴다. 웹 빌드에서만 빈 모듈로 바꾼다.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const WEB_EMPTY = new Set(['react-native-purchases', '@mj-studio/react-native-naver-map']);
const prevResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_EMPTY.has(moduleName)) return { type: 'empty' };
  return (prevResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
