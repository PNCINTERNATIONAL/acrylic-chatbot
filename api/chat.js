import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * 기본 프롬프트 (공통 규칙)
 */
const BASE_PROMPT = `
너는 아트센이라는 온라인 쇼핑몰의 아크릴판 주문제작 견적 계산 챗봇이다.

- 목적: 아크릴판 주문 견적 안내
- 실제 주문은 아래 링크에서만 진행된다
https://smartstore.naver.com/artsen/products/6687679653

- 내부 판단, 계산 과정, 검증 설명은 절대 말하지 않는다
- 이미 확인된 정보는 다시 묻지 않는다
- 오직 누락된 정보만 질문한다
- 간결하고 상담원처럼 말한다
`;

/**
 * 주문 규칙 프롬프트
 */
const ORDER_RULES = `
[주문 정보]
- colorType (색상)
- thickness (두께, mm)
- width (가로, mm)
- length (세로, mm)
- quantity (수량)

[입력 해석]
- 5T → thickness = 5
- 230x180 → width=230, length=180
- 3개 → quantity=3
- 오타는 의미가 명확하면 추론 (투몀 → 투명)

[색상별 두께]
- 투명: 2 / 3 / 5 / 8 / 10T
- 불투명 블랙, 화이트: 2 / 3 / 5T
- 투명 블랙, 블루, 오렌지: 3 / 5T

[제한]
- 가로 또는 세로 1200mm 초과 시 주문 불가 (설명하지 말 것)
`;

/**
 * 상태 요약을 모델에게 알려주는 함수
 */
function buildStatusPrompt(state) {
  return `
현재까지 확인된 주문 정보:
- 색상: ${state.colorType ?? "미확인"}
- 두께: ${state.thickness ? state.thickness + "T" : "미확인"}
- 가로: ${state.width ?? "미확인"}
- 세로: ${state.length ?? "미확인"}
- 수량: ${state.quantity ?? "미확인"}

누락된 정보만 질문하라.
모든 정보가 확인되면 가격을 계산하라.
`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 가능합니다." });
  }

  try {
    const { messages, greeted, orderState } = req.body;

    if (!Array.isArray(messages) || !orderState) {
      return res.status(400).json({ error: "messages, orderState 필요" });
    }

    // 인사 프롬프트 (서버가 결정)
    const greetingPrompt = greeted
      ? "이미 인사는 완료되었다. 다시 인사하지 마라."
      : "첫 응답에서만 인사하라.";

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
${BASE_PROMPT}

${ORDER_RULES}

${greetingPrompt}

${buildStatusPrompt(orderState)}
`
        },
        ...messages
      ]
    });

    const reply =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    return res.json({ reply });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OpenAI 오류" });
  }
}
