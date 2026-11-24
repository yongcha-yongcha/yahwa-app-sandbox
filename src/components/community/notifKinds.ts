// 야화 — 커뮤니티 알림 구분(대표 1022): 커뮤니티 알림 화면·종 점·'모두 읽음'은 커뮤니티에서 생긴 알림만 본다.
// 인연(호감·편지·인연 소개)·인증·운영·모임·쿠폰 알림은 여기서 빼고 각자 화면에서 본다.
// 서버 kind: lounge_*(글·댓글·답글·좋아요 등 커뮤니티 활동) · profile_exchange_*(커뮤니티 댓글에서 시작하는 프로필 교환)
export function isCommunityServerKind(kind: string): boolean {
  return kind.startsWith('lounge_') || kind.startsWith('profile_exchange');
}
// 기기 알림(데모용) — 댓글·좋아요만 커뮤니티
export function isCommunityLocalKind(kind: string): boolean {
  return kind === 'comment' || kind === 'like';
}
