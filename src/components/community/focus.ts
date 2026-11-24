// 야화 — 알림에서 연 화면이 무엇을 강조할지(앱 라우터 app/index에 자리가 없어 한 번만 읽는 값으로 넘긴다)
//   · 댓글 알림 → 게시글에서 그 댓글을 펼쳐 강조(시안 focused-comment)
//   · 교환 요청 알림 → 프로필 교환에서 그 요청 하나만, 탭 없이
//   · 수락 후 상대 프로필에서 돌아오면 '교환 기록' 탭(시안)
let focusComment: string | null = null;
let exchangeFocus: string | null = null;

export function setFocusComment(id: string) { focusComment = id; }
export function consumeFocusComment(): string | null { const v = focusComment; focusComment = null; return v; }

export function setExchangeFocus(id: string) { exchangeFocus = id; }
export function consumeExchangeFocus(): string | null { const v = exchangeFocus; exchangeFocus = null; return v; }

let exchangeTab: '받은 요청' | '보낸 요청' | '교환 기록' | null = null;
export function setExchangeReturnTab(t: '받은 요청' | '보낸 요청' | '교환 기록') { exchangeTab = t; }
export function consumeExchangeReturnTab() { const v = exchangeTab; exchangeTab = null; return v; }
