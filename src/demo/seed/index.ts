// 야화 시연판 — 처음 상태(시드). 영역별 파일이 표(table)마다 행을 내놓고 여기서 합친다.
// 시드를 고치면 시연도구의 '처음 상태로'를 눌러야 브라우저에 반영된다.
import type { Row } from '../db';
import { seed as users } from './users';
import { seed as letters } from './letters';
import { seed as community } from './community';
import { seed as my } from './my';

export function buildSeed(): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const part of [users(), letters(), community(), my()]) {
    for (const [t, rows] of Object.entries(part)) (out[t] ??= []).push(...rows);
  }
  return out;
}
