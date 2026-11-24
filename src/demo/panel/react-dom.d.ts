// react-dom 타입 패키지 없이 시연도구 패널을 그리기 위한 선언
declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: any): void; unmount(): void };
}
