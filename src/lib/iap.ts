// 야화 — RevenueCat IAP. 리프 충전 → RevenueCat 영수증 검증 → Supabase credit_leaf 호출.
// Edge Function이 RevenueCat webhook을 받아 credit_leaf를 호출하는 게 정식. 클라이언트는
// purchase만 하고 잔액은 fetchMe로 polling 또는 Realtime users row subscribe.
import { Platform } from 'react-native';

// react-native-purchases는 web에서 동작 안 함 → lazy require로 web 빌드 깨짐 방지
type PurchasesPackage = any;
let Purchases: any = null;
function loadPurchases(): boolean {
  if (Purchases) return true;
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Purchases = require('react-native-purchases').default;
    return !!Purchases;
  } catch {
    return false;
  }
}

let configured = false;

export function configureIAP() {
  if (configured) return;
  if (!loadPurchases()) {
    if (__DEV__) console.warn('[iap] purchases unavailable on this platform');
    return;
  }
  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });
  if (!apiKey) {
    if (__DEV__) console.warn('[iap] RevenueCat key missing — purchases disabled');
    return;
  }
  Purchases.configure({ apiKey });
  configured = true;
}

let boundUserId: string | null = null;

export async function bindIAPUser(userId: string): Promise<boolean> {
  if (!configured) configureIAP();
  if (!configured) return false;
  if (boundUserId === userId) return true;
  try {
    await Purchases.logIn(userId);
    boundUserId = userId;
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[iap] logIn failed', e);
    return false;
  }
}

export function isIAPBound(userId: string): boolean {
  return configured && boundUserId === userId;
}

export async function unbindIAPUser() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {}
  boundUserId = null;
}

export async function listLeafPackages(): Promise<PurchasesPackage[]> {
  if (!configured) configureIAP();
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buyPackage(pkg: PurchasesPackage) {
  if (!configured) throw new Error('IAP가 설정되지 않았어요');
  if (!boundUserId) throw new Error('사용자 식별이 끝나지 않았어요. 잠시 후 다시 시도해 주세요');
  // RevenueCat 측 구매 (영수증 검증 + entitlement 갱신)
  const { customerInfo, transaction } = await Purchases.purchasePackage(pkg);
  // 정식 경로: RevenueCat → webhook → Edge Function credit_leaf.
  // 클라이언트는 영수증 ID만 확인하고 잔액은 서버 push로 갱신.
  return { customerInfo, transaction };
}

