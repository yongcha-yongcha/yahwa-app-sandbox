// 야화 — OTA(EAS Update) 적용 훅.
// · 콜드 스타트: 새 번들을 확인·다운로드해 실행 5초 안에 받아지면 그 자리에서 리로드(재실행 1번으로 반영).
//   5초를 넘기면(느린 망) 쓰는 중에 갑자기 리로드하지 않고 받아만 둔다 — 다음 실행이나 아래 복귀 때 적용.
// · 포그라운드 복귀: 10분에 한 번까지 확인·다운로드. 받아 둔 업데이트가 있고 30분 이상 백그라운드였거나
//   받은 지 30분이 지났으면, 안전할 때만(겹쳐 연 화면·로그인/가입 화면 아님, 저장 중 아님, 입력 중 아님) 리로드.
//   오래 비웠다 돌아와 새로 받은 경우도 5초 안에 받아지면 바로 적용한다.
// · 웹: 배포마다 바뀌는 번들 이름(entry-<hash>.js)을 index.html에서 다시 읽어 비교 — 같은 규칙으로 새로고침.
import { useEffect } from 'react';
import { AppState, Platform, TextInput } from 'react-native';
import * as Updates from 'expo-updates';
import { queryClient } from './query';

const QUICK_APPLY_MS = 5_000;
const CHECK_GAP_MS = 10 * 60_000;
const AWAY_MS = 30 * 60_000;

// 지금 리로드해도 되는 화면인지 — app/index.tsx가 갱신한다.
// 기본 false: 관리자·제휴 페이지(웹)는 자동 새로고침하지 않는다.
let reloadSafe = false;
export function setReloadSafe(v: boolean) { reloadSafe = v; }

function typing(): boolean {
  if (Platform.OS === 'web') {
    const el = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  return !!(TextInput as any).State?.currentlyFocusedInput?.();
}
function canReload() { return reloadSafe && queryClient.isMutating() === 0 && !typing(); }

// 웹 — 지금 페이지가 실행 중인 번들 / 서버에 올라와 있는 번들
const ENTRY_RE = /\/_expo\/static\/js\/web\/entry-[^"'\s?]+\.js/;
function loadedEntry(): string | null {
  if (typeof document === 'undefined') return null;
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(ENTRY_RE);
    if (m) return m[0];
  }
  return null;
}
async function latestEntry(): Promise<string | null> {
  const r = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return (await r.text()).match(ENTRY_RE)?.[0] ?? null;
}

export function useOtaUpdate() {
  useEffect(() => {
    if (__DEV__) return;
    const web = Platform.OS === 'web';
    if (web ? !loadedEntry() : !Updates.isEnabled) return;

    let busy = false;
    let lastCheck = 0;
    let pendingSince = 0;  // 새 번들을 받아 둔 시각(0 = 없음)
    let hiddenAt = 0;

    async function check() {
      if (busy || pendingSince) return;
      busy = true;
      lastCheck = Date.now();
      try {
        if (web) {
          const cur = loadedEntry();
          const next = await latestEntry();
          if (cur && next && next !== cur) pendingSince = Date.now();
        } else {
          const res = await Updates.checkForUpdateAsync();
          if (!res.isAvailable) return;
          const fetched = await Updates.fetchUpdateAsync();
          if (fetched.isNew) pendingSince = Date.now();
        }
      } catch {
        // 네트워크 실패 등 — 조용히 무시 (기존 번들로 계속 동작)
      } finally {
        busy = false;
      }
    }
    function apply() {
      if (!pendingSince || !canReload()) return;
      if (web) window.location.reload();
      else Updates.reloadAsync().catch(() => {});
    }
    // 확인을 시작하고 5초 안에 받아졌을 때만 바로 적용 — 늦게 끝나면 쓰는 중일 수 있어 받아만 둔다
    async function checkAndApplyQuick() {
      const t0 = Date.now();
      await check();
      if (pendingSince && Date.now() - t0 <= QUICK_APPLY_MS) apply();
    }

    if (web) lastCheck = Date.now();  // 웹은 방금 최신 페이지를 받았다
    else void checkAndApplyQuick();   // 콜드 스타트

    function onActive() {
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (pendingSince) {
        if (away >= AWAY_MS || Date.now() - pendingSince >= AWAY_MS) apply();
        return;
      }
      if (Date.now() - lastCheck < CHECK_GAP_MS) return;
      if (away >= AWAY_MS) void checkAndApplyQuick();
      else void check();
    }
    function onHidden() { if (!hiddenAt) hiddenAt = Date.now(); }

    if (web) {
      const onVis = () => (document.visibilityState === 'visible' ? onActive() : onHidden());
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') onActive();
      else if (st === 'background') onHidden();
    });
    return () => sub.remove();
  }, []);
}
