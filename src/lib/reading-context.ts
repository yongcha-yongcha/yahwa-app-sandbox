/**
 * 사용자 질문과 스프레드 위치를 카드 본문 해석에 연결하는 문단 생성.
 * (LLM 없이 템플릿으로 ‘대화형 답변’에 가깝게 만듦)
 */

export type ReadingInterpretBubble = {
  key: string;
  content: string;
};

/** 구분선 없이 말풍선 단위로 나눌 세그먼트 (intro → 핵심 해석). 마무리 안내는 `readingClosingAdvice`로 한 번만. */
export function contextualCardBubbles(
  question: string,
  positionLabel: string,
  cardDisplayName: string,
  upright: boolean,
  coreMeaning: string,
): ReadingInterpretBubble[] {
  const q = question.trim() || "당신이 적어 주신 질문";
  const dir = upright ? "정방향" : "역방향";
  const body = coreMeaning.trim();

  const intro =
    `${q}, __BOLD_START__${positionLabel}__BOLD_END__에서 본 당신의 질문\n\n` +
    `「${positionLabel}」 자리는 이 스프레드 안에서 그 질문의 한 층면을 담당합니다. ` +
    `그 초점에 맞춰 보면, ${cardDisplayName} (${dir})이(가) 건네는 말은 아래와 같이 읽힐 수 있어요.`;

  return [
    { key: "intro", content: intro },
    { key: "core", content: body },
  ];
}

/** 세 장 풀이를 모두 읽은 뒤, 마지막에 한 번만 붙이는 안내 문단. */
export function readingClosingAdvice(
  question: string,
  positionLabels: readonly string[],
): string {
  const q = question.trim() || "당신이 적어 주신 질문";
  const slots = positionLabels.join(", ");
  return (
    `위 내용을 읽으며 다시 한번 「${q}」를 떠올려 보세요. ` +
    `특히 각 자리(${slots})에 해당하는 삶의 영역(시간, 관계, 선택, 감정 등)에서 무엇이 가장 와닿는지 짚어 보는 것이 좋아요. ` +
    `거기서 ‘오늘 하루’ 혹은 ‘이번 주’에 시험해 볼 행동·말하기·멈춤 중 하나만 골라도, 카드가 준 대답은 충분히 질문과 맞닿게 됩니다.`
  );
}

/** 스프레드 안내를 문단 단위 말풍선으로 분리. */
export function spreadPreambleBubbles(
  question: string,
  positionLabels: readonly string[],
): ReadingInterpretBubble[] {
  const full = readingSpreadPreamble(question, positionLabels);
  return full
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((content, i) => ({ key: `preamble-${i}`, content }));
}

export function readingSpreadPreamble(
  question: string,
  positionLabels: readonly string[],
): string {
  const q = question.trim();
  if (!q) {
    return `아래는 각 자리(${positionLabels.join(" → ")})에서 카드가 건네는 메시지입니다. 질문을 다시 적어 두면 다음 리딩부터 더 잘 맞물립니다.`;
  }
  const flow = positionLabels.join(" → ");
  return `당신이 남긴 질문은 이렇게 기억하고 있어요.\n「${q}」\n\n지금 스프레드는 ${flow} 순서로, 그 질문의 서로 다른 층을 비춥니다. 각 카드 설명은 일반 풀이가 아니라, 방금 그 질문 줄기에 맞춰 읽을 수 있도록 짚어 두었어요.`;
}

/** 한 줄 텍스트(복사·접근성 등)용. 구분선 없이 문단만 이어 붙임. */
export function formatContextualCardBody(
  question: string,
  positionLabel: string,
  cardDisplayName: string,
  upright: boolean,
  coreMeaning: string,
): string {
  return contextualCardBubbles(
    question,
    positionLabel,
    cardDisplayName,
    upright,
    coreMeaning,
  )
    .map((b) =>
      typeof b.content === "string"
        ? b.content.replace(/__BOLD_START__(.+?)__BOLD_END__/g, "$1")
        : "",
    )
    .join("\n\n");
}
