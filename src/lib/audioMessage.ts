// 야화 — 커뮤니티 음성 메시지 (녹음·업로드·재생).
//
// ⚠️ expo-audio는 네이티브 모듈. AudioModule.js가 모듈 최상위에서
//    requireNativeModule('ExpoAudio')를 호출하므로, 정적 import하면 모듈이 없는
//    기존 빌드에서 FATAL이 난다(현위치 사고와 동일 함정).
//    → requireOptionalNativeModule로 존재 확인 후에만 require. 없으면 기능을 숨긴다.
//
// 용량: AAC 모노 32kbps·22.05kHz → 최대 90초 ≈ 360KB (사진 1장의 1/3 수준).
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const MAX_AUDIO_SEC = 90;

// 저용량 녹음 옵션 — RecordingPresets.LOW_QUALITY의 Android 3gp/amr(저음질)를 피하고
// 양 플랫폼 AAC m4a로 통일한다.
const RECORD_OPTIONS = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,   // 녹음 막대가 실제 소리 크기를 따라가게(시안 11-21: 소리가 없으면 막대도 가만히)
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: 'aac ', audioQuality: 64, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 48000 },
} as const;

export function loadAudioApi(): any | null {
  try {
    if (Platform.OS !== 'web') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const core: any = require('expo-modules-core');
      if (!core?.requireOptionalNativeModule?.('ExpoAudio')) return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: any = require('expo-audio');
    return typeof mod?.setAudioModeAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

// 이 빌드에서 음성 기능을 쓸 수 있는가 — 없으면 UI 자체를 숨긴다(OTA 구빌드)
export function audioAvailable(): boolean {
  return loadAudioApi() != null;
}

// hook의 createRecordingOptions와 동일: base + 플랫폼 키 병합
function platformOptions(): any {
  const { android, ios, web, ...base } = RECORD_OPTIONS as any;
  const p = Platform.OS === 'android' ? android : Platform.OS === 'ios' ? ios : { ...web, mimeType: webMimeType() };
  return { ...base, ...(p ?? {}) };
}

// 웹 녹음 형식 — Safari는 webm을 못 써서 mp4로 녹음한다(1013)
function webMimeType(): string {
  const MR = (globalThis as any).MediaRecorder;
  if (MR?.isTypeSupported?.('audio/webm')) return 'audio/webm';
  if (MR?.isTypeSupported?.('audio/mp4')) return 'audio/mp4';
  return 'audio/webm';
}

// level(): 지금 소리 크기 0~1(앱은 녹음기 metering, 웹은 마이크 분석기). 알 수 없으면 0 — 막대가 움직이지 않는다
export type ActiveRecording = { stop: () => Promise<{ uri: string; durationSec: number } | null>; level: () => number };

// 웹 — 녹음기와 따로 같은 마이크를 분석기에 물려 소리 크기를 읽는다(권한은 이미 받은 뒤라 다시 묻지 않는다)
async function webMeter(): Promise<{ level: () => number; close: () => void } | null> {
  try {
    const md = (globalThis as any).navigator?.mediaDevices;
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!md?.getUserMedia || !AC) return null;
    const stream = await md.getUserMedia({ audio: true });
    const ac = new AC();
    const an = ac.createAnalyser();
    an.fftSize = 256;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    return {
      level: () => { an.getByteTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x - 128)); return Math.min(1, m / 64); },
      close: () => { stream.getTracks().forEach((t: any) => t.stop()); ac.close?.().catch?.(() => {}); },
    };
  } catch {
    return null;
  }
}

// 녹음 시작 — 권한 요청 포함. 실패 시 null (호출부가 안내).
export async function startRecording(): Promise<ActiveRecording | null> {
  const Audio = loadAudioApi();
  if (!Audio) return null;
  try {
    const perm = await Audio.requestRecordingPermissionsAsync();
    if (!perm?.granted) return null;
    await Audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    // 웹 엔트리는 클래스 이름이 다르다(AudioRecorderWeb) — expo-audio 훅 내부와 동일 분기
    const RecorderCls = Platform.OS === 'web'
      ? Audio.AudioModule?.AudioRecorderWeb
      : Audio.AudioModule?.AudioRecorder;
    if (!RecorderCls) return null;
    const recorder = new RecorderCls(platformOptions());
    await recorder.prepareToRecordAsync();
    const startedAt = Date.now();
    recorder.record();
    const meter = Platform.OS === 'web' ? await webMeter() : null;
    let stopped = false;
    return {
      level: () => {
        if (stopped) return 0;
        if (meter) return meter.level();
        try {
          const db = recorder.getStatus?.()?.metering;   // dB(−160 ~ 0)
          return typeof db === 'number' ? Math.min(1, Math.max(0, (db + 50) / 50)) : 0;
        } catch { return 0; }
      },
      stop: async () => {
        if (stopped) return null;
        stopped = true;
        meter?.close();
        try {
          await recorder.stop();
          const durationSec = Math.min(MAX_AUDIO_SEC, Math.round((Date.now() - startedAt) / 1000));
          const uri: string | null = recorder.uri ?? null;
          // 녹음 세션 종료 — 스피커 재생 모드로 복귀
          Audio.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
          try { recorder.release?.(); } catch { /* 이미 해제 */ }
          return uri ? { uri, durationSec } : null;
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

// 파일 → Storage 업로드. 전용 버킷 lounge-audio(0102) — 경로는 정책상 {uid}/ 로 시작.
export async function uploadAudio(userId: string, uri: string): Promise<string | null> {
  try {
    const isWeb = Platform.OS === 'web';
    let ext = isWeb ? 'webm' : 'm4a';
    let contentType = isWeb ? 'audio/webm' : 'audio/mp4';
    let bytes: ArrayBuffer | Blob;
    if (isWeb) {
      const blob = await (await fetch(uri)).blob();
      // Safari 등 mp4로 녹음된 경우 확장자·형식을 맞춘다
      if (blob.type.includes('mp4')) { ext = 'm4a'; contentType = 'audio/mp4'; }
      bytes = blob;
    } else {
      // 네이티브 — FS legacy로 base64 읽기(photoUpload와 동일 경로)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      let FS: any = null;
      try { FS = require('expo-file-system/legacy'); } catch { /* 아래 폴백 */ }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (typeof FS?.readAsStringAsync !== 'function') FS = require('expo-file-system');
      if (typeof FS?.readAsStringAsync !== 'function') return null;
      const b64: string = await FS.readAsStringAsync(uri, { encoding: 'base64' });
      const bin = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      bytes = arr.buffer;
    }
    const path = `${userId}/audio-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('lounge-audio').upload(path, bytes as any, {
      contentType, upsert: false,
    });
    if (error) return null;
    return supabase.storage.from('lounge-audio').getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// 재생 — 네이티브는 expo-audio 플레이어, 웹은 DOM Audio 폴백.
// 반환: 정지 함수. onEnd는 재생 완료/실패 시 호출.
export function playAudio(url: string, onEnd: () => void): () => void {
  if (Platform.OS === 'web') {
    try {
      const el = new (globalThis as any).Audio(url);
      el.onended = onEnd; el.onerror = onEnd;
      // 재생이 안 되는 소리(빈 녹음 · 못 여는 형식)면 멈춘 채 남지 않게 바로 끝낸다(시안 11-21)
      Promise.resolve(el.play()).catch(onEnd);
      return () => { try { el.pause(); } catch { /* noop */ } onEnd(); };
    } catch { onEnd(); return () => {}; }
  }
  const Audio = loadAudioApi();
  if (!Audio) { onEnd(); return () => {}; }
  try {
    const player = Audio.createAudioPlayer({ uri: url });
    const sub = player.addListener?.('playbackStatusUpdate', (st: any) => {
      if (st?.didJustFinish) { cleanup(); }
    });
    let done = false;
    const cleanup = () => {
      if (done) return; done = true;
      try { sub?.remove?.(); } catch { /* noop */ }
      try { player.release?.(); } catch { /* noop */ }
      onEnd();
    };
    player.play();
    return cleanup;
  } catch { onEnd(); return () => {}; }
}

export function fmtAudioTime(sec: number): string {
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
