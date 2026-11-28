// 프로필 선택지 · 형식 도우미 — 가입(SignUp) · 소개 작성 · 프로필 수정이 함께 쓴다.
// 목록은 우리 것(시안 목록 아님, spec-shell §5.4 a-3 · b-12). 음주 '안마심'은 저장값을 지키고 화면에만 '안함'으로 보인다.
export const OPTIONS: Record<string, string[]> = {
  job: ['직장인', 'CEO', '자영업', '프리랜서', '학생', '전문직', '디자이너', '개발자', '교육직', '의료직', '공무원', '기타'],
  mbti: ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'],
  education: ['고등학교 졸업', '전문대 재학', '전문대 졸업', '대학교 재학', '대학교 졸업', '대학원 재학', '석사 졸업', '박사 졸업', '기타'],
  religion: ['무교', '기독교', '천주교', '불교', '기타'],
  smoking: ['비흡연', '가끔', '흡연', '전자담배'],
  drinking: ['안마심', '가끔', '즐김'],
  politics: ['진보', '중도', '보수', '무관심'],
};
export const LABEL: Record<string, string> = {
  job: '직업', region: '사는 곳', height: '키', mbti: 'MBTI', religion: '종교',
  smoking: '흡연', drinking: '음주', politics: '정치 성향', nickname: '닉네임', education: '학력',
};
// 저장값 → 화면 글자
export const shownValue = (v: string) => (v === '안마심' ? '안함' : v);
export const HEIGHTS = Array.from({ length: 111 }, (_, i) => 120 + i);  // 120~230cm

// 사는 곳 — 시·도 → 시·군·구 2단계(시안 features.js regionTree, 11-21). 저장값은 '시·도 / 시·군·구'('서울 / 종로구').
// 단, 추천 필터(나의 취향 PREF_REGIONS)와 서버 매칭(deck_region_match)이 따로 이름을 아는 8곳은 예전 값으로 저장한다
// ('서울 / 강남' 등 — 화면에는 '강남구'). 나머지는 서버 규칙상 '서울 / 기타' · '부산' 같은 넓은 필터에 그대로 맞는다.
// 세종은 세부가 세종시 하나뿐이라 시·도에서 끝난다. 예전 값('서울 / 기타' · '부산')은 그대로 읽힌다.
const REGION_TREE: Record<string, string> = {
  '서울': '종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구',
  '경기': '수원시 성남시 의정부시 안양시 부천시 광명시 평택시 동두천시 안산시 고양시 과천시 구리시 남양주시 오산시 시흥시 군포시 의왕시 하남시 용인시 파주시 이천시 안성시 김포시 화성시 광주시 양주시 포천시 여주시 연천군 가평군 양평군',
  '인천': '제물포구 영종구 미추홀구 연수구 남동구 부평구 계양구 서해구 검단구 강화군 옹진군',
  '부산': '중구 서구 동구 영도구 부산진구 동래구 남구 북구 해운대구 사하구 금정구 강서구 연제구 수영구 사상구 기장군',
  '대구': '중구 동구 서구 남구 북구 수성구 달서구 달성군 군위군',
  '광주': '동구 서구 남구 북구 광산구',
  '대전': '동구 중구 서구 유성구 대덕구',
  '울산': '중구 남구 동구 북구 울주군',
  '세종': '',
  '강원': '춘천시 원주시 강릉시 동해시 태백시 속초시 삼척시 홍천군 횡성군 영월군 평창군 정선군 철원군 화천군 양구군 인제군 고성군 양양군',
  '충북': '청주시 충주시 제천시 보은군 옥천군 영동군 증평군 진천군 괴산군 음성군 단양군',
  '충남': '천안시 공주시 보령시 아산시 서산시 논산시 계룡시 당진시 금산군 부여군 서천군 청양군 홍성군 예산군 태안군',
  '전북': '전주시 군산시 익산시 정읍시 남원시 김제시 완주군 진안군 무주군 장수군 임실군 순창군 고창군 부안군',
  '전남': '목포시 여수시 순천시 나주시 광양시 담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군',
  '경북': '포항시 경주시 김천시 안동시 구미시 영주시 영천시 상주시 문경시 경산시 의성군 청송군 영양군 영덕군 청도군 고령군 성주군 칠곡군 예천군 봉화군 울진군 울릉군',
  '경남': '창원시 진주시 통영시 사천시 김해시 밀양시 거제시 양산시 의령군 함안군 창녕군 고성군 남해군 하동군 산청군 함양군 거창군 합천군',
  '제주': '제주시 서귀포시',
};
const LEGACY_SUB: Record<string, string> = {
  '서울/강남구': '강남', '서울/성동구': '성동', '서울/마포구': '마포', '서울/송파구': '송파',
  '경기/수원시': '수원', '경기/용인시': '용인', '경기/성남시': '성남', '경기/화성시': '화성',
};
const split = (r: string) => r.split(/\s*\/\s*/);
export const SIDO: string[] = Object.keys(REGION_TREE);
export const subRegions = (sido: string): string[] => (REGION_TREE[sido] ? REGION_TREE[sido].split(' ') : []);
export const regionValue = (sido: string, sub: string) => `${sido} / ${LEGACY_SUB[`${sido}/${sub}`] ?? sub}`;
export const sidoOf = (region?: string | null) => (region ? split(region)[0] : '');
// 세부 이름(화면용) — 예전 값 '서울 / 강남'은 '강남구'로
export const subOf = (region?: string | null) => {
  const [sido, sub] = region ? split(region) : [];
  if (!sub) return '';
  return Object.keys(LEGACY_SUB).find((k) => k.startsWith(`${sido}/`) && LEGACY_SUB[k] === sub)?.split('/')[1] ?? sub;
};
// 사는 곳을 다시 골라야 하는 값 — 비었거나, '서울 / 기타' · '경기 / 기타'처럼 목록에 없는 세부, 시·군·구 없이 시·도만('부산').
// 세종(세부 없음)과 예전 8곳('서울 / 강남' 등)은 맞는 값이다. 앱 진입 때 RegionRecheck가 쓴다.
export const regionNeedsRecheck = (region?: string | null) => {
  const [sido, sub] = region?.trim() ? split(region.trim()) : [];
  if (!sido || !(sido in REGION_TREE)) return true;
  const subs = subRegions(sido);
  if (!subs.length) return false;
  return !sub || !subs.includes(subOf(region));
};
// '서울 / 강남' → 선택창에 보이는 글자 '서울 강남구'
export const regionText = (region?: string | null) => (region ? [sidoOf(region), subOf(region)].filter(Boolean).join(' ') : '');

// 010-1234-5678 형태로만 저장 — phone_hash(지인 차단, 0031)가 형식에 민감하다
export function phoneFormatted(raw: string): string {
  const v = raw.replace(/[^0-9]/g, '');
  if (!/^01[016789][0-9]{7,8}$/.test(v)) return '';
  return v.length === 11 ? `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}` : `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`;
}
// 입력하는 동안 자동 하이픈(최대 13자)
export function phoneTyping(raw: string): string {
  const v = raw.replace(/[^0-9]/g, '').slice(0, 11);
  if (v.length < 4) return v;
  if (v.length < 8) return `${v.slice(0, 3)}-${v.slice(3)}`;
  return v.length === 11 ? `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}` : `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`;
}

// 받침에 따라 '을/를' — '직업을', '키를'
export const objJosa = (w: string) => { const c = w.charCodeAt(w.length - 1); if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? '을' : '를'; return /[LMNR]$/i.test(w) ? '을' : '를'; };
