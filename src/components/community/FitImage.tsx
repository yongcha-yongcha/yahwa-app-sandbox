// 커뮤니티 첨부 사진 — 게시글에서는 원본 비율 그대로(잘라내지 않는다, 1017 대표 지시).
// 피드 썸네일은 minRatio로 세로 사진만 조금 줄여 보여준다(그 이상 긴 부분은 위쪽 35% 기준으로 잘림).
// 너비는 칸에 맞추고 높이는 사진 비율로. 비율은 처음 불러올 때 알게 되므로 한 번 본 사진은 기억해 다시 그릴 때 흔들리지 않게 한다.
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { colors, radius } from '../../tokens';

const ratios = new Map<string, number>();

export function FitImage({ uri, src, style, label, minRatio }: { uri: string; src: string; style?: object; label?: string; minRatio?: number }) {
  const [ratio, setRatio] = useState<number | undefined>(ratios.get(uri));
  const shown = ratio === undefined ? 4 / 3 : minRatio ? Math.max(ratio, minRatio) : ratio;
  const cut = ratio !== undefined && shown > ratio;
  return (
    <Image
      source={{ uri: src }}
      cachePolicy="memory-disk"
      transition={120}
      contentFit={cut ? 'cover' : 'contain'}
      contentPosition={{ top: '35%', left: '50%' }}
      accessibilityLabel={label}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) { const r = width / height; ratios.set(uri, r); setRatio(r); }
      }}
      // 모서리 16 · 불러오기 전 자리는 4:3 sky-50(리뉴얼 1120)
      style={[{ width: '100%', aspectRatio: shown, borderRadius: radius.card, backgroundColor: colors.accentSubtle }, style]}
    />
  );
}
