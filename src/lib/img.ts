// Supabase Storage 공개 URL → 리사이즈된 렌더링 URL (이미지 변환 미지원 플랜이면 원본 fallback)
const PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

// ⚠️ resize=contain 필수. width만 지정하면 Supabase가 높이를 그대로 두기 때문에
//    cover(기본)에서는 1080x2640 → 240x2640처럼 세로로 짓눌린 이미지가 나오고,
//    그걸 화면에서 contentFit="cover"로 채우면 확대·잘림으로 보인다.
//    contain은 지정한 폭에 맞춰 높이를 비례 축소해 원본 비율을 그대로 유지한다.
export function thumbUrl(url: string | null | undefined, width = 240): string | null {
  if (!url || !url.includes(PUBLIC_PATH)) return url ?? null;
  return url.replace(PUBLIC_PATH, RENDER_PATH) + `?width=${width}&quality=60&resize=contain`;
}

// 대표 사진 자르기(1017) — 잘라낸 사진은 '원본 경로__crop<시각>.jpg'로 저장한다.
// 카드·목록 썸네일은 잘라낸 사진을, 프로필 페이지는 이 함수로 찾은 원본을 보여준다.
export const CROP_MARK = '__crop';
export function originalPhoto<T extends string | number | null | undefined>(url: T): T {
  if (typeof url !== 'string') return url;
  const i = url.indexOf(CROP_MARK);
  return (i > 0 ? url.slice(0, i) : url) as T;
}
