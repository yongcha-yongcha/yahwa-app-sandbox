// 야화 — 앱 전역 화면 열기 (1013).
// 편지 쓰기·편지 상세·나의 취향은 인연 덱·상세·알림 등 여러 곳에서 열린다.
// 화면 전환을 쥔 app/index.tsx가 핸들러를 등록하고, 나머지는 이 함수만 부른다(props 줄줄이 넘기기 방지).
export type LetterReceiver = { id: string; nickname: string; photo?: string | null };
export type AppNavTarget =
  | { kind: 'letterCompose'; receiver: LetterReceiver; mode: 'new' | 'reply'; letterId?: string; invitedReply?: boolean }
  | { kind: 'letterDetail'; letterId: string }
  | { kind: 'friend'; userId: string; free?: boolean }
  | { kind: 'matchPrefs' }
  | { kind: 'letters' }   // 편지함 탭으로
  // 받은 편지 도착 팝업 — 알림을 눌렀을 때(안 읽었으면 팝업, 아니면 그 편지·편지함). 예전 '메시지' 알림은 보낸 사람으로 찾는다
  | { kind: 'letterPopup'; letterId?: string; fromUserId?: string }
  // 하단 탭 전환 — 오늘의 인연을 다 본 뒤 '커뮤니티 둘러보기'(1015). 탭 이름은 리뉴얼 1120 하단 메뉴 그대로
  | { kind: 'tab'; tab: 'affinity' | 'heart' | 'letters' | 'lounge' | 'me' }
  // 플레이스(지도 + 매장) — 하단 메뉴에서 빠져 MY 아래 겹쳐 여는 화면이 됐다
  | { kind: 'place' }
  // 프로필 수정 — 마음함 빈 화면 '내 소개 다듬기'
  | { kind: 'profileEdit' };

let handler: ((t: AppNavTarget) => void) | null = null;

export function registerAppNav(h: (t: AppNavTarget) => void): () => void {
  handler = h;
  return () => { if (handler === h) handler = null; };
}

export function appNav(t: AppNavTarget) {
  handler?.(t);
}
