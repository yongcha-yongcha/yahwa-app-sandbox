// 야화 — "마지막으로 본 시각"을 기기에 남긴다(spec-rest §10 A-2 — 서버 변경 없이 '안 봄' 표시를 계산).
//   exchange-received: 받은 요청 탭을 마지막으로 연 시각(그 뒤에 온 요청 = 새 요청: 빨간 개수 칩 · 파란 점 · 글 상세 머리의 점)
//   exchange-log: 교환 기록 탭을 마지막으로 연 시각(그 뒤의 수락 · 거절 결과 = 새 결과: 빨간 점)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '../../lib/previewStore';

type SeenKey = 'exchange-received' | 'exchange-log';
const key = (k: SeenKey) => `yahwa.seen.${k}.${getCurrentUserId() ?? 'guest'}`;
const mem = new Map<string, number>();

export async function getSeen(k: SeenKey): Promise<number> {
  const id = key(k);
  const m = mem.get(id);
  if (m != null) return m;
  try { const v = Number(await AsyncStorage.getItem(id)) || 0; mem.set(id, v); return v; } catch { return 0; }
}
export function markSeen(k: SeenKey, at: number = Date.now()): void {
  const id = key(k);
  mem.set(id, at);
  AsyncStorage.setItem(id, String(at)).catch(() => {});
}
