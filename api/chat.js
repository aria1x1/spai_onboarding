// Vercel Serverless Function (Node.js runtime, CommonJS, zero npm dependencies
// per CLAUDE.md). Answers a FinTech term question via Claude. No login, no
// archive — the API key must stay server-side, which is the only reason this
// function exists instead of calling Claude straight from app.js.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const MAX_QUESTION_LENGTH = 500;

const FINTECH_SYSTEM_PROMPT = `당신은 핀테크(FinTech) 분야에 특화된 AI 어시스턴트입니다.
- 사용자가 핀테크 관련 용어나 개념(결제, 오픈뱅킹, 마이데이터, 임베디드 금융, 스테이블코인, BNPL 등)을 질문하면 한국어로 정확하고 간결하게(3~6줄) 설명하세요.
- 확실하지 않은 사실이나 최신 규제 세부사항은 추측해서 답하지 말고, 정확히 알 수 없다고 답하세요.
- 핀테크와 무관한 질문에는 답변할 수 없다고 안내하고, 억지로 관련짓지 마세요.
- 투자 조언이나 특정 금융상품 추천은 하지 마세요.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "missing required environment variables" });
    return;
  }

  const question = (req.body && req.body.question) || "";
  if (typeof question !== "string" || !question.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    res.status(400).json({ error: `question must be under ${MAX_QUESTION_LENGTH} characters` });
    return;
  }

  try {
    const answer = await askClaude(question.trim());
    res.status(200).json({ answer });
  } catch (err) {
    console.error("[chat] Claude call failed:", err);
    res.status(502).json({ error: "failed to get an answer from the model" });
  }
};

async function askClaude(question) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: FINTECH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Claude API ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  const text = data.content && data.content[0] && data.content[0].text;
  if (!text) throw new Error("empty response from Claude API");
  return text.trim();
}
