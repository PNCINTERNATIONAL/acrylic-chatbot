import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
너는 아트센 스마트스토어의 아크릴판 주문 견적 안내 챗봇이다.

가장 중요한 규칙:
- 이미 인사는 완료된 상태다. 절대로 "안녕하세요. 아트센..." 같은 인사 문장을 다시 말하지 마라.
- 오직 누락된 정보만 질문하라.
- 내부 판단/검증/계산 과정을 설명하지 마라.
- 가격 안내 후에는 반드시 주문 링크를 안내하라.

필요 정보(모두 모일 때만 계산):
- colorType(색상), thickness(mm), width(mm), length(mm), quantity(개)

색상 예시:
투명 / 불투명 블랙 / 불투명 화이트 / 투명 블랙 / 투명 블루 / 투명 오렌지

색상별 두께:
- 투명: 2/3/5/8/10T
- 불투명 블랙, 불투명 화이트: 2/3/5T
- 투명 블랙, 투명 블루, 투명 오렌지: 3/5T

제한:
- 가로 또는 세로 1200mm 초과면 주문 불가(간단히만 안내)

주문 링크:
https://smartstore.naver.com/artsen/products/6687679653
`;

function statusBlock(orderState) {
  const s = orderState || {};
  return `
현재까지 확인된 정보:
- 색상: ${s.colorType ?? "미확인"}
- 두께: ${s.thickness ?? "미확인"}
- 가로: ${s.width ?? "미확인"}
- 세로: ${s.length ?? "미확인"}
- 수량: ${s.quantity ?? "미확인"}

누락된 것만 1~2개 항목으로 짧게 질문하라.
`;
}

// 보험: 모델이 규칙을 어기고 인사를 하면 잘라내기
function stripGreeting(text) {
  if (!text) return text;
  const patterns = [
    /^안녕하세요\.\s*아트센\s*입니다\.\s*아크릴판\s*주문을\s*도와드리겠습니다\.\s*/,
    /^안녕하세요\.\s*아트센\s*입니다\.\s*/,
    /^안녕하세요\.\s*/
  ];
  let out = text.trim();
  for (const p of patterns) out = out.replace(p, "");
  return out.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 가능합니다." });
  }

  try {
    const { messages, orderState } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages 배열이 필요합니다." });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT + "\n" + statusBlock(orderState) },
        ...messages
      ]
    });

    let reply =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    reply = stripGreeting(reply);

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return res.status(500).json({ error: "OpenAI 응답 오류" });
  }
}
