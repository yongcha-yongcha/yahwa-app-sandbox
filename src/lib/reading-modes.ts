/** 오늘 리딩 모드 — 항상 카드 3장 */

export const THREE_CARD_COUNT = 3;

export const READING_MODES = [
  {
    id: "daily",
    label: "오늘의 운세",
    description: "하루 전반, 주의할 점, 오늘의 조언을 세 장으로 봅니다.",
    positions: ["오늘의 전반", "조심할 일", "행운과 조언"] as const,
  },
  {
    id: "love",
    label: "오늘의 연애운",
    description: "마음의 온도, 관계의 기운, 오늘의 한 걸음을 세 장으로 봅니다.",
    positions: ["지금의 마음", "관계의 기운", "다가가는 법"] as const,
  },
] as const;

export type ReadingMode = (typeof READING_MODES)[number];
