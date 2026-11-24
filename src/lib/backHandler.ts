// 야화 — 뒤로가기 가로채기(안드로이드 하드웨어 뒤로 · 웹 브라우저 뒤로).
// app/index.tsx의 전역 뒤로가기가 오버레이를 닫기 전에 여기 등록된 함수를 먼저 부른다(나중에 등록한 것부터).
// 화면 안 단계 되돌리기·나가기 확인처럼 화면이 직접 처리했으면 true를 돌려준다.
import { useEffect, useRef } from 'react';

type Fn = () => boolean;
const stack: { run: Fn }[] = [];

export function runBackOverrides(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].run()) return true;
  return false;
}

export function useBackOverride(fn: Fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const entry = { run: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
}
