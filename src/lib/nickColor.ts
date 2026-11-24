// 커뮤니티 닉네임 앞 색 점 — 남녀 표시(대표 지시 1008): 남 파랑, 여 분홍, 모름 회색.
// 닉네임은 회색 메타 줄, 제목만 진하게 해서 글쓴이와 제목을 구분한다.
export function genderDotColor(gender?: string | null): string {
  return gender === 'M' ? '#6FA8DC' : gender === 'F' ? '#E8829A' : '#B5B5BA';
}
