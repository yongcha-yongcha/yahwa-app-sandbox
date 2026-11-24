// 야화 — 통합 사진 선택 + Supabase Storage 업로드.
// 웹: <input type=file> + ArrayBuffer 업로드.
// 모바일: expo-image-picker + ArrayBuffer 업로드.
// 결과: Storage public URL (DB에 저장).
import { Platform } from 'react-native';
import { supabase } from './supabase';

const BUCKET = 'profile-photos';
// 원본 상한 — 폰 카메라 원본(보통 2~8MB)을 그대로 받아들이되 비정상 파일만 막는다.
// 버킷에도 동일하게 10MB 제한이 걸려 있어(서버 강제) 이 값은 사용자 안내용.
const MAX_SIZE = 10 * 1024 * 1024;  // 10MB

// 업로드 전 리사이즈 목표 — 긴 변 1440px / JPEG 82%.
// 기기 화면이 최대 3x(약 1290px)라 1440이면 상세 화면에서도 화질 저하가 보이지 않고,
// 폰 원본(3000~4000px) 대비 용량이 보통 1/5~1/10로 줄어 대역폭이 그만큼 절감된다.
const MAX_EDGE = 1440;
const JPEG_QUALITY = 0.82;

export type PickResult = { uri: string; mime: string; bytes: ArrayBuffer | Blob };

// 웹 전용 — file input 클릭 시뮬레이션 (호출자가 input.click() 후 결과를 가져옴).
// 대신 더 깔끔하게, 직접 input 요소 생성해 파일 선택 후 ArrayBuffer 반환.
function pickWebFile(): Promise<PickResult | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 취소 감지 — onchange가 영원히 안 오면 호출자의 로딩 스피너가 멈추지 않는다.
    // Chrome/Safari 최신은 'cancel' 이벤트를 주고, 그 외엔 창 포커스 복귀 후 짧게 기다렸다 폴백.
    let settled = false;
    const finish = (v: PickResult | null) => { if (!settled) { settled = true; resolve(v); } };
    input.addEventListener('cancel', () => finish(null));
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      // 파일 선택 시 focus가 change보다 먼저 올 수 있어 여유를 둔다
      setTimeout(() => { if (!input.files?.length) finish(null); }, 1200);
    };
    window.addEventListener('focus', onFocus);
    input.onchange = async () => {
      window.removeEventListener('focus', onFocus);
      const f = input.files?.[0];
      if (!f) { finish(null); return; }
      if (!f.type.startsWith('image/')) {
        if (typeof window !== 'undefined') window.alert('이미지 파일만 업로드할 수 있어요');
        finish(null); return;
      }
      if (f.size > MAX_SIZE) {
        if (typeof window !== 'undefined') window.alert('10MB 이하 이미지를 사용해주세요');
        finish(null); return;
      }
      const shrunk = await shrinkWebImage(f);
      finish(shrunk ?? { uri: URL.createObjectURL(f), mime: f.type, bytes: await f.arrayBuffer() });
    };
    input.click();
  });
}

// 웹 — canvas로 긴 변 MAX_EDGE까지 축소 후 JPEG 재인코딩. 실패하면 원본으로 폴백한다.
async function shrinkWebImage(f: File): Promise<PickResult | null> {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
    const bmp = await createImageBitmap(f);
    const long = Math.max(bmp.width, bmp.height);
    // 이미 충분히 작으면 재인코딩하지 않는다(불필요한 화질 손실 방지)
    if (long <= MAX_EDGE) { bmp.close?.(); return null; }
    const scale = MAX_EDGE / long;
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close?.(); return null; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return null;
    return { uri: URL.createObjectURL(blob), mime: 'image/jpeg', bytes: await blob.arrayBuffer() };
  } catch {
    return null;   // 리사이즈 실패는 업로드를 막지 않는다
  }
}

// base64 → Uint8Array — RN(Hermes) 환경에 atob가 없을 수 있어 의존성 없이 직접 디코드.
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_CHARS.indexOf(clean[i]);
    const b = B64_CHARS.indexOf(clean[i + 1]);
    const c = i + 2 < len ? B64_CHARS.indexOf(clean[i + 2]) : 0;
    const d = i + 3 < len ? B64_CHARS.indexOf(clean[i + 3]) : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (o < outLen) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < outLen) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

// expo-image-picker 모듈을 견고하게 얻는다.
// 동적 import()는 New Architecture/Hermes interop에 따라 함수가 .default 아래로만
// 노출돼 "undefined is not a function"이 날 수 있다. require를 우선 쓰고(네이티브 전용
// 경로라 웹 번들에 문제 없음 — image-picker는 웹 구현도 있음) 실패 시 import로 폴백,
// 어느 쪽이든 default/네임스페이스 양쪽에서 실제 함수가 있는 객체를 골라낸다.
async function loadImagePicker(): Promise<any> {
  let mod: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-image-picker');
  } catch {
    // @ts-ignore — 네이티브 전용
    mod = await import('expo-image-picker');
  }
  // 실제 API가 어디 있는지 확인 (네임스페이스 vs default interop)
  if (mod && typeof mod.launchImageLibraryAsync === 'function') return mod;
  if (mod?.default && typeof mod.default.launchImageLibraryAsync === 'function') return mod.default;
  throw new Error('[사진모듈] 이미지 선택 기능을 불러오지 못했어요');
}

async function pickNativeFile(): Promise<PickResult | null> {
  const ImagePicker = await loadImagePicker();

  // 권한 — iOS 사진 선택(PHPicker)은 사진첩 권한 없이 동작한다. 거절해 둔 사람도 고를 수 있게 iOS는 미리 막지 않는다.
  // 안드로이드만 요청하고, 거절이면 '설정 열기'로 안내한다.
  if (Platform.OS === 'android') {
    if (typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
      throw new Error('[권한] 사진첩 권한 요청 기능을 사용할 수 없어요');
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      const { Alert, Linking } = require('react-native');
      Alert.alert('권한 필요', '사진 업로드를 위해 사진첩 접근 권한이 필요해요. 설정에서 허용해주세요.', [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => { Linking.openSettings?.().catch?.(() => {}); } },
      ]);
      return null;
    }
  }

  // allowsEditing(크롭 UI) 미사용 — iPad에서 구형 피커로 빠져 실패하는 문제 회피(2.1a).
  // mediaTypes는 신규 API(문자열 배열)로 지정 — deprecated enum 경로 회피.
  // base64: true — RN의 Blob에는 arrayBuffer()가 없어서("undefined is not a function")
  // fetch(uri).blob() 경로는 네이티브에서 항상 실패한다. 피커가 주는 base64를 직접 디코드해 업로드.
  // ⚠️ 이 옵션을 빼지 말 것. 해상도 축소는 expo-image-manipulator(네이티브 모듈)가 하는데
  //    그 모듈이 없는 기존 빌드에서는 동작하지 않으므로, 추가 네이티브 모듈 없이 항상
  //    얻을 수 있는 피커의 base64가 최종 안전망이다. (제거했다가 업로드 전면 실패)
  //    단, 축소 모듈이 있는 빌드에서는 원본 해상도 base64(수십 MB 문자열)를 받지 않는다 — 저사양 안드로이드 메모리 부족.
  //    그때 축소가 실패하면 아래 폴백 2(파일 직접 읽기)로 간다.
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: !hasImageManipulator(),
  });
  if (res?.canceled || !res?.assets?.[0]) return null;
  const asset = res.assets[0];

  // 긴 변 MAX_EDGE로 축소 + JPEG 재인코딩. 실패 시 아래 폴백들로 내려간다.
  const shrunk = await shrinkNativeImage(asset.uri, asset.width, asset.height);
  if (shrunk) {
    const bytes = base64ToBytes(shrunk.base64);
    return { uri: shrunk.uri, mime: 'image/jpeg', bytes: bytes.buffer as ArrayBuffer };
  }
  // 폴백 1 — 피커가 준 base64 (네이티브 모듈 불필요, 가장 안정적)
  let b64: string | null = asset.base64 ?? null;
  // 폴백 2 — 파일 URI를 직접 읽기 (피커가 base64를 안 준 기기/포맷 대비)
  if (!b64 && asset.uri) {
    b64 = await uriToBase64(asset.uri);
  }
  if (!b64) {
    const { Alert } = require('react-native');
    Alert.alert('업로드 실패', '이미지를 읽지 못했어요. 다른 사진으로 시도해주세요');
    return null;
  }
  // base64 길이로 용량 추정 (bytes ≈ len * 3/4)
  if ((b64.length * 3) / 4 > MAX_SIZE) {
    const { Alert } = require('react-native');
    Alert.alert('용량 초과', '10MB 이하 이미지를 사용해주세요');
    return null;
  }
  const bytes = base64ToBytes(b64);
  const mime = asset.mimeType || 'image/jpeg';
  return { uri: asset.uri, mime, bytes: bytes.buffer as ArrayBuffer };
}

// expo-image-manipulator 네이티브 모듈이 이 빌드에 있는지(없으면 require만으로 FATAL — 아래 주석 참고)
function hasImageManipulator(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core: any = require('expo-modules-core');
    return !!core?.requireOptionalNativeModule?.('ExpoImageManipulator');
  } catch {
    return false;
  }
}

// 네이티브 — expo-image-manipulator로 긴 변 MAX_EDGE까지 축소 후 JPEG 재인코딩.
// 실패하면 null을 반환해 기존(원본) 경로로 폴백한다 — 업로드 자체를 막지 않는다.
async function shrinkNativeImage(
  uri: string, width?: number, height?: number,
): Promise<{ uri: string; base64: string } | null> {
  try {
    // 주의: try/catch만으로는 부족하다. expo-image-manipulator는 모듈 최상위에서
    // requireNativeModule('ExpoImageManipulator')를 호출하는데, 모듈 팩토리에서 던진
    // 에러는 Metro의 guardedLoadModule이 rethrow 없이 ErrorUtils.reportFatalError로
    // 직행시켜 catch에 안 걸리고 FATAL 크래시가 된다(구빌드 OTA 사고의 원인).
    // → requireOptionalNativeModule로 네이티브 모듈 존재를 먼저 확인하고,
    //   없으면(모듈 미포함 구빌드) 리사이즈 없이 원본 업로드로 폴백한다.
    if (!hasImageManipulator()) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IM: any = require('expo-image-manipulator');
    const long = Math.max(width ?? 0, height ?? 0);
    const actions = long > MAX_EDGE
      ? [{ resize: (width ?? 0) >= (height ?? 0) ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];   // 이미 작으면 리사이즈 없이 JPEG 재인코딩만
    const out = await IM.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: IM.SaveFormat?.JPEG ?? 'jpeg',
      base64: true,
    });
    return out?.base64 ? { uri: out.uri, base64: out.base64 } : null;
  } catch {
    return null;
  }
}

// 파일 URI → base64 (피커가 base64를 안 준 경우 폴백). 없으면 조용히 실패.
// ⚠️ SDK 54부터 readAsStringAsync는 'expo-file-system/legacy'로 이동했다. 기본 진입점의
//    동명 함수는 남아 있지만 호출하면 런타임에 throw한다("import from legacy") —
//    그래서 legacy를 먼저 시도하고, 없을 때만(구버전 SDK 빌드) 기본 진입점을 쓴다.
async function uriToBase64(uri: string): Promise<string | null> {
  const load = (): any => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L: any = require('expo-file-system/legacy');
      if (typeof (L?.readAsStringAsync ?? L?.default?.readAsStringAsync) === 'function') {
        return L.readAsStringAsync ? L : L.default;
      }
    } catch { /* 구버전 SDK — legacy 경로 없음 */ }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FS: any = require('expo-file-system');
      return FS?.readAsStringAsync ? FS : FS?.default;
    } catch {
      return null;
    }
  };
  try {
    const FS = load();
    if (typeof FS?.readAsStringAsync !== 'function') return null;
    return await FS.readAsStringAsync(uri, { encoding: FS.EncodingType?.Base64 ?? 'base64' });
  } catch {
    return null;
  }
}

export async function pickPhoto(): Promise<PickResult | null> {
  return Platform.OS === 'web' ? pickWebFile() : pickNativeFile();
}

// Storage 업로드 → public URL 반환. userId/timestamp로 경로 부여.
// path를 주면 그 경로로(대표 사진 자르기 — 원본 경로 + __crop), 없으면 userId/시각.확장자
export async function uploadPhotoToStorage(picked: PickResult, userId: string, path?: string): Promise<string> {
  const ext = picked.mime.split('/')[1]?.split('+')[0] ?? 'jpg';
  path ??= `${userId}/${Date.now()}.${ext}`;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, picked.bytes as any, {
      contentType: picked.mime,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) throw error;
  } catch (e: any) {
    // 어느 단계에서 실패했는지 사용자 메시지에 남긴다(네이티브 원격 진단).
    throw new Error(`[업로드] ${e?.message ?? '스토리지 업로드 실패'}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// 통합 — pick + upload 한 번에. 실패는 호출자가 catch.
export async function pickAndUploadPhoto(userId: string): Promise<string | null> {
  const picked = await pickPhoto();
  if (!picked) return null;
  return await uploadPhotoToStorage(picked, userId);
}

// 신분증/학생증 — PII라 프라이빗 버킷(id-verifications)에 올리고 "객체 경로"만 반환.
// public URL 없음 — 관리자만 대시보드/service_role로 열람 (0061).
export async function pickAndUploadIdPhoto(userId: string): Promise<string | null> {
  const picked = await pickPhoto();
  if (!picked) return null;
  const ext = picked.mime.split('/')[1]?.split('+')[0] ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('id-verifications').upload(path, picked.bytes as any, {
    contentType: picked.mime,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// ── 사진 자르기(대표 사진 보이는 부분 고르기, 1017) ─────────────────────────────
// rect는 원본 픽셀 좌표. 결과는 긴 변 MAX_EDGE 이하 JPEG.
export type CropRect = { originX: number; originY: number; width: number; height: number };

// 앱에 자르기 모듈이 있는지(2026-07-26 이후 빌드에 포함). 없으면 자르기 화면을 건너뛴다
export function canCropPhoto(): boolean {
  if (Platform.OS === 'web') return typeof document !== 'undefined';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core: any = require('expo-modules-core');
    return !!core?.requireOptionalNativeModule?.('ExpoImageManipulator');
  } catch {
    return false;
  }
}

export async function cropPhoto(uri: string, rect: CropRect): Promise<PickResult> {
  const r = {
    originX: Math.max(0, Math.round(rect.originX)), originY: Math.max(0, Math.round(rect.originY)),
    width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)),
  };
  const scale = Math.min(1, MAX_EDGE / Math.max(r.width, r.height));
  if (Platform.OS === 'web') {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('사진을 불러오지 못했어요')); img.src = uri; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(r.width * scale); canvas.height = Math.round(r.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('사진을 자르지 못했어요');
    ctx.drawImage(img, r.originX, r.originY, r.width, r.height, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('사진을 자르지 못했어요');
    return { uri: URL.createObjectURL(blob), mime: 'image/jpeg', bytes: await blob.arrayBuffer() };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IM: any = require('expo-image-manipulator');
  let local = uri;
  if (/^https?:/i.test(uri)) {  // 이미 올린 사진 — 기기로 받아서 자른다
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L: any = require('expo-file-system/legacy');
    const FS = L?.downloadAsync ? L : L?.default;
    const dest = `${FS.cacheDirectory}crop_${Date.now()}.jpg`;
    local = (await FS.downloadAsync(uri, dest)).uri;
  }
  const actions: any[] = [{ crop: r }];
  if (scale < 1) actions.push({ resize: { width: Math.round(r.width * scale) } });
  const out = await IM.manipulateAsync(local, actions, { compress: JPEG_QUALITY, format: IM.SaveFormat?.JPEG ?? 'jpeg', base64: true });
  if (!out?.base64) throw new Error('사진을 자르지 못했어요');
  const bytes = base64ToBytes(out.base64);
  return { uri: out.uri, mime: 'image/jpeg', bytes: bytes.buffer as ArrayBuffer };
}
