// 야화 시연판 — 시연도구의 '상황 만들기' 버튼 규격.
// run()이 목업 DB를 바꾸고, 결과 문장을 돌려준다(시연도구에 그대로 보임). go가 있으면 그 화면으로 이동 버튼이 붙는다.
import type { DemoNavTarget } from './bridge';

export type Scenario = {
  id: string;
  group: string;          // 묶음 제목(예: '편지')
  label: string;          // 버튼 글자
  hint?: string;          // 버튼 아래 작은 설명
  run: () => string | Promise<string>;
  go?: DemoNavTarget;     // 실행 뒤 이동할 화면
};
