// 야화 — 앱 다운로드 랜딩. 유튜브 고정댓글·인스타 등 외부 채널에 뿌리는 단일 링크.
// 접속 기기에 맞는 스토어로 자동 이동하고, 데스크톱/자동이동 실패 시 두 스토어 버튼을 노출한다.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import { colors, radius } from '../src/tokens';
import { Icons } from '../src/icons';
import { Image } from 'expo-image';

const APP_STORE = 'https://apps.apple.com/kr/app/id6789592621';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.yahwa.myapp';

export default function Download() {
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    // ?c=코드 — 신규가입 쿠폰 캠페인 코드. 웹 가입 시 로그인 후 자동 청구된다(app/index).
    try {
      const c = new URLSearchParams(window.location.search).get('c');
      if (c) window.localStorage.setItem('yahwa_signup_coupon', c);
    } catch { /* ignore */ }
    const ua = navigator.userAgent || '';
    const target = /iPhone|iPad|iPod/i.test(ua) ? APP_STORE : /Android/i.test(ua) ? PLAY_STORE : null;
    if (!target) return;
    setAuto(true);
    // 즉시 이동하되, 인앱 브라우저에서 막히면 아래 버튼으로 직접 받을 수 있게 화면은 그대로 둔다.
    window.location.href = target;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {/* 스토어에 올라간 실제 앱 아이콘(assets/logo.png) — 리프 아이콘 대체(대표 지시) */}
      <Image
        source={require('../assets/logo.png')}
        style={{ width: 84, height: 84, borderRadius: 20 }}
        contentFit="cover"
      />
      <Text style={{ marginTop: 18, fontSize: 21.5, fontWeight: '800', color: colors.text }}>야화</Text>
      <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.sub, textAlign: 'center', lineHeight: 19 }}>
        앱을 설치하고 가입하면{'\n'}칵테일 한 잔 무료 쿠폰을 드려요
      </Text>

      <View style={{ marginTop: 28, width: '100%', maxWidth: 320, gap: 10 }}>
        <StoreBtn label="App Store에서 받기" url={APP_STORE} primary />
        <StoreBtn label="Google Play에서 받기" url={PLAY_STORE} />
      </View>

      {auto && (
        <Text style={{ marginTop: 16, fontSize: 11, color: colors.mute, textAlign: 'center' }}>
          스토어로 이동 중… 이동되지 않으면 위 버튼을 눌러주세요.
        </Text>
      )}
    </View>
  );
}

function StoreBtn({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{
        height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? colors.primary : colors.surface,
        borderWidth: primary ? 0 : 1.5, borderColor: colors.line,
      }}
    >
      <Text style={{ fontSize: 13.5, fontWeight: '800', color: primary ? '#fff' : colors.text }}>{label}</Text>
    </Pressable>
  );
}
