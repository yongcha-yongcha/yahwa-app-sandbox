// 지금 시각 — 화면을 켜 둔 동안에도 'N분 전'·D-n·7일 규칙 같은 시간 표시가 멈추지 않게 주기적으로, 그리고 앱으로 돌아올 때 다시 그린다.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') tick(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [intervalMs]);
  return now;
}
