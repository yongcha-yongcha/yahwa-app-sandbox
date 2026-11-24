// 리사이즈된 썸네일을 우선 로드하고, 변환 미지원(렌더 엔드포인트 4xx) 시 원본으로 폴백.
import React, { useState } from 'react';
import { Image } from 'expo-image';
import { thumbUrl } from '../lib/img';

export function SmartImg({ src, width, style, contentFit, blurRadius }: { src: string; width?: number; style?: any; contentFit?: 'cover' | 'contain'; blurRadius?: number }) {
  const [fallback, setFallback] = useState(false);
  const uri = fallback ? src : (thumbUrl(src, width) ?? src);
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit ?? 'cover'}
      cachePolicy="memory-disk"
      transition={150}
      blurRadius={blurRadius}
      onError={() => { if (!fallback) setFallback(true); }}
    />
  );
}
