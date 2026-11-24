// 야화 — 탭 첫 방문 안내(커뮤니티·플레이스·MY) 한 덩어리.
// 화면이 보이는 중일 때만 띄운다(숨겨 둔 탭 화면에서는 뜨지 않게 — KeepAlive).
// 보이는지 여부를 여기서 읽어, 탭을 바꿀 때 화면 전체가 아니라 이 작은 컴포넌트만 다시 그려진다.
import React from 'react';
import { useTabGuide, type TourTab } from '../../lib/tabGuides';
import { useScreenActive } from '../KeepAlive';
import { FirstTour } from './FirstTour';

export function TabTour({ tab, active = true }: { tab: Exclude<TourTab, 'profile'>; active?: boolean }) {
  const shown = useScreenActive();
  const guide = useTabGuide(tab, shown && active);
  if (guide.step == null || !active) return null;
  return <FirstTour tab={tab} step={guide.step} onNext={guide.next} onClose={guide.close} />;
}
