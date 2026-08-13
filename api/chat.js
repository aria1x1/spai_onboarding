// Vercel Serverless Function (Node.js runtime, CommonJS, zero npm dependencies
// per CLAUDE.md). Verifies the caller's Supabase session, answers a FinTech
// term question via Claude, and archives the Q&A to `chat_logs`. Only
// authenticated users may call this — there is no anonymous chat.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "missing required environment variables" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }

  const user = await verifySupabaseUser(accessToken);
  if (!user) {
    res.status(401).json({ error: "invalid or expired session" });
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

  let answer;
  try {
    answer = await askClaude(question.trim());
  } catch (err) {
    console.error("[chat] Claude call failed:", err);
    res.status(502).json({ error: "failed to get an answer from the model" });
    return;
  }

  try {
    await saveChatLog(user.id, question.trim(), answer);
  } catch (err) {
    // Archiving is secondary to answering — log and still return the answer.
    console.error("[chat] failed to save chat_logs entry:", err);
  }

  res.status(200).json({ answer });
};

async function verifySupabaseUser(accessToken) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!resp.ok) return null;
  const user = await resp.json();
  return user && user.id ? user : null;
}

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

async function saveChatLog(userId, question, answer) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/chat_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([{ user_id: userId, question, answer }]),
  });
  if (!resp.ok) throw new Error(`supabase insert chat_logs -> ${resp.status}: ${await resp.text()}`);
}
