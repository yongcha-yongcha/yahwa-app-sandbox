// 야화 — 웹 HTML 셸 커스터마이즈 (expo-router). <head> 메타 태그 주입용.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Google 사이트 소유권 확인 */}
        <meta name="google-site-verification" content="c9DTQ-kOUQ-MN7aaLbziFMpxfbM4u-9Vf_wJ06HpIMg" />
        <title>야화</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
