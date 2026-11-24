// 야화 — 크래시 가드. 잡히지 않은 JS 에러를 앱 종료 대신 화면에 띄운다.
//
// 배경: 전역 에러 핸들러가 없어서 JS 예외가 나면 프로덕션 앱이 아무 정보 없이 그냥 꺼졌다.
// (카카오 로그인 직후 앱 종료 원인을 못 잡던 이유) 이제 원인이 화면에 남는다.
//
// 잡는 것: 렌더 중 예외(ErrorBoundary), 그 외 잡히지 않은 JS 예외(ErrorUtils),
//          처리되지 않은 Promise 거부(rejection-tracking).
// 못 잡는 것: 네이티브 크래시. 이 화면조차 안 뜨면 원인은 네이티브 쪽이다.
import React from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { copyText } from '../lib/clipboard';
import { colors } from '../tokens';

type Listener = (msg: string) => void;
let listener: Listener | null = null;
let pending: string | null = null;   // 리스너 등록 전에 터진 에러 보관

function report(msg: string) {
  if (listener) listener(msg);
  else pending = msg;
}

function fmt(prefix: string, error: any): string {
  const name = error?.name ?? 'Error';
  const message = error?.message ?? String(error);
  const stack = typeof error?.stack === 'string' ? error.stack.slice(0, 1200) : '';
  return `[${prefix}] ${name}: ${message}\n\n${stack}`;
}

// ── 전역 훅 설치 (모듈 로드 시 1회) ─────────────────────────────────────────
let installed = false;
function install() {
  if (installed) return;
  installed = true;

  // 1) 잡히지 않은 JS 예외 — 기본 핸들러를 부르지 않아 앱이 죽지 않게 한다
  const EU = (global as any).ErrorUtils;
  if (EU?.setGlobalHandler) {
    EU.setGlobalHandler((error: any, isFatal?: boolean) => {
      report(fmt(isFatal ? 'FATAL' : 'ERROR', error));
    });
  }

  // 2) 처리되지 않은 Promise 거부 (dismissBrowser 같은 케이스가 여기 걸린다)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, error: any) => report(fmt('UNHANDLED PROMISE', error)),
      onHandled: () => {},
    });
  } catch { /* 폴리필 없으면 무시 */ }
}
install();

// ── 화면 ────────────────────────────────────────────────────────────────────
export function CrashGuard({ children }: { children: React.ReactNode }) {
  return <Boundary>{children}</Boundary>;
}

class Boundary extends React.Component<{ children: React.ReactNode }, { msg: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { msg: pending };
  }
  componentDidMount() {
    listener = (msg) => this.setState({ msg });
    if (pending) { this.setState({ msg: pending }); pending = null; }
  }
  componentWillUnmount() { listener = null; }
  static getDerivedStateFromError(error: any) {
    return { msg: fmt('RENDER', error) };
  }
  render() {
    if (this.state.msg) {
      return <CrashScreen msg={this.state.msg} onDismiss={() => this.setState({ msg: null })} />;
    }
    return <>{this.props.children}</>;
  }
}

function CrashScreen({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: 60, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.danger }}>문제가 발생했어요</Text>
      <Text style={{ marginTop: 6, fontSize: 11, color: colors.mute }}>
        아래 내용을 복사해 개발팀에 보내주세요. ({Platform.OS})
      </Text>
      <ScrollView
        style={{ marginTop: 14, flex: 1, backgroundColor: colors.bgSoft, borderRadius: 10, padding: 12 }}
      >
        <Text selectable style={{ fontSize: 10, color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
          {msg}
        </Text>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 16 }}>
        <Pressable
          onPress={() => { void copyText(msg); }}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>내용 복사</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.bgSoft, alignItems: 'center' }}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>계속하기</Text>
        </Pressable>
      </View>
    </View>
  );
}
