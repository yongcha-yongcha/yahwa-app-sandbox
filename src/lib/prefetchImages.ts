// 야화 — 앱 시작 시 플레이스 매장 사진을 미리 받아 둔다(대표 지시 1004: 이미지 로딩이 느리다).
// 플레이스 탭을 열 때 받기 시작하면 첫 화면이 빈 칸으로 보인다. 앱을 켜고 잠시 뒤
// 목록·지도 핀에 쓰는 작은 썸네일만 조용히 받아 둔다(매장당 수 KB~20KB).
// 첫 화면(인연 덱) 사진과 겹치지 않게 덱이 뜬 뒤(7초 뒤)에, 로그인 회원만 받는다.
// 매장 목록은 지도 탭과 같은 캐시(['stores'])로 받아 둬 지도 탭이 다시 받지 않게 한다.
import { Image } from 'expo-image';
import { thumbUrl } from './img';
import { queryClient } from './query';
import { fetchStores } from './hooks';

let done = false;
export function prefetchStoreThumbs() {
  if (done) return;
  done = true;
  setTimeout(async () => {
    try {
      const stores = await queryClient.fetchQuery({ queryKey: ['stores'], queryFn: fetchStores, staleTime: 60_000 });
      const firsts = stores.map((s) => s.imageUrls.filter(Boolean)[0]).filter(Boolean) as string[];
      // 매장 줄 사진(PlaceShopRow)·지도 핀이 같이 쓰는 200 한 크기만 — 화면과 같은 URL이어야 캐시가 맞는다.
      // 디스크에만 받아 둔다(전 매장 × 여러 크기를 메모리에 올리면 저사양 기기에서 메모리를 크게 먹었다)
      const urls = firsts.map((u) => thumbUrl(u, 200)).filter(Boolean) as string[];
      await Image.prefetch(urls, { cachePolicy: 'disk' });
    } catch { /* 미리받기 실패는 무시 — 화면에서 평소대로 받는다 */ }
  }, 7000);
}
