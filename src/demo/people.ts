// 야화 시연판 — 목업 인물 목록. 사진은 public/demo/people 에 있다(모두 AI로 만든 가상 인물).
// 이름·나이·지역을 바꾸면 덱·마음함·편지·커뮤니티 어디서나 같이 바뀐다.
export type Person = {
  id: string;
  nickname: string;
  gender: 'F' | 'M';
  birthYear: number;
  region: string;       // 시·도
  district: string;     // 구·시
  job: string;
  photos: string[];     // 첫 장이 대표 사진
};

const P = (n: string) => `/demo/people/${n}.jpg`;
const four = (k: string) => [1, 2, 3, 4].map((i) => P(`${k}-${i}`));

export const PEOPLE: Person[] = [
  { id: 'u-f01', nickname: '봄빛', gender: 'F', birthYear: 2000, region: '서울', district: '마포구', job: '출판 편집자', photos: [P('person-01-0'), ...four('person-01')] },
  { id: 'u-f02', nickname: '느린오후', gender: 'F', birthYear: 1997, region: '경기', district: '성남시', job: 'UX 디자이너', photos: four('person-02') },
  { id: 'u-f03', nickname: '여름산책', gender: 'F', birthYear: 1999, region: '부산', district: '해운대구', job: '초등학교 교사', photos: four('person-03') },
  { id: 'u-f04', nickname: '작은파도', gender: 'F', birthYear: 1996, region: '서울', district: '성동구', job: '간호사', photos: four('person-04') },
  { id: 'u-f05', nickname: '하늘조각', gender: 'F', birthYear: 2001, region: '인천', district: '연수구', job: '대학원생', photos: four('person-05') },
  { id: 'u-f06', nickname: '포근한날', gender: 'F', birthYear: 1998, region: '경기', district: '수원시', job: '마케터', photos: four('person-06') },
  { id: 'u-f07', nickname: '달빛편지', gender: 'F', birthYear: 1995, region: '대전', district: '유성구', job: '연구원', photos: four('person-07') },
  { id: 'u-f08', nickname: '푸른밤', gender: 'F', birthYear: 2000, region: '서울', district: '강남구', job: '플로리스트', photos: four('person-08') },
  { id: 'u-m01', nickname: '새벽러너', gender: 'M', birthYear: 1997, region: '서울', district: '송파구', job: '백엔드 개발자', photos: four('person-09') },
  { id: 'u-m02', nickname: '안경너머', gender: 'M', birthYear: 1995, region: '서울', district: '용산구', job: '건축가', photos: four('person-10') },
  { id: 'u-m03', nickname: '주말요리사', gender: 'M', birthYear: 1996, region: '경기', district: '고양시', job: '회계사', photos: four('person-11') },
  { id: 'u-m04', nickname: '느긋한곰', gender: 'M', birthYear: 1998, region: '서울', district: '마포구', job: '사진작가', photos: four('person-12') },
  { id: 'u-m05', nickname: '한강산책', gender: 'M', birthYear: 1999, region: '서울', district: '영등포구', job: '은행원', photos: four('person-13') },
  { id: 'u-m06', nickname: '제주바람', gender: 'M', birthYear: 1997, region: '서울', district: '서초구', job: '변호사', photos: [1, 2, 3, 4].map((i) => P(`added-a${i}`)) },
  { id: 'u-m07', nickname: '책방지기', gender: 'M', birthYear: 1993, region: '경기', district: '용인시', job: '고등학교 교사', photos: [1, 2, 3, 4].map((i) => P(`added-b${i}`)) },
  { id: 'u-m08', nickname: '오늘의커피', gender: 'M', birthYear: 1998, region: '인천', district: '부평구', job: '바리스타', photos: [1, 2, 3, 4].map((i) => P(`added-c${i}`)) },
];

export const person = (id: string) => PEOPLE.find((p) => p.id === id);
export const women = PEOPLE.filter((p) => p.gender === 'F');
export const men = PEOPLE.filter((p) => p.gender === 'M');
