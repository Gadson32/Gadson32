// Retrieval-augmented answer generation: finds the most relevant chunks
// of *your own uploaded documents* via Postgres full-text search (no
// embeddings API, no web search — exactly the "don't search the web
// during live conversations" constraint this app was built around), then
// has Claude write a direct answer grounded strictly in those chunks.
//
// The system prompt explicitly forbids answering from general knowledge
// when the documents don't cover it — a live interview/customer call is
// exactly the wrong place for a confidently wrong guess, so "I don't
// have that in your documents" is treated as a correct answer, not a
// failure.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("ANSWER_MODEL") || "claude-haiku-4-5-20251001";
const TOP_K = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

interface RetrievedChunk {
  documentTitle: string;
  content: string;
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "to", "of", "in", "on",
  "at", "for", "and", "but", "tell", "me", "about", "you", "your", "i", "we", "they", "he",
  "she", "it", "this", "that", "do", "did", "does", "can", "could", "would", "will", "shall",
  "should", "my", "have", "has", "had", "what", "when", "where", "how", "why", "give", "an"
]);

// websearch_to_tsquery treats space-separated words as AND by default —
// far too strict for a behavioral question ("tell me about a time you
// handled conflict") against resume wording that's unlikely to share
// most of those words ("resolved a scheduling dispute with a vendor").
// Rewriting the query as an OR of the question's significant words (via
// websearch_to_tsquery's documented "or" keyword) trades precision for
// recall, which is the right direction here — missing a real match
// entirely is worse than the model having to sift a looser set of
// candidates. Pure string construction, no extra API call/cost.
function buildRecallQuery(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const uniqueWords = [...new Set(words)];
  return uniqueWords.length > 0 ? uniqueWords.join(" or ") : question;
}

async function retrieveChunks(supabase: ReturnType<typeof createClient>, question: string): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase
    .from("document_chunks")
    .select("content, documents(title)")
    .textSearch("content_tsv", buildRecallQuery(question), { type: "websearch", config: "english" })
    .limit(TOP_K);

  if (error) {
    console.error("retrieval error:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    documentTitle: row.documents?.title || "Untitled document",
    content: row.content
  }));
}

async function synthesizeAnswer(question: string, chunks: RetrievedChunk[]): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  if (chunks.length === 0) {
    return "I don't have anything in your uploaded documents that answers this.";
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] (from "${c.documentTitle}")\n${c.content}`)
    .join("\n\n");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system:
        "You are a real-time interview answer coach. The person is mid-interview and needs a precise, " +
        "ready-to-say answer immediately. Answer ONLY using the numbered document excerpts below (their own " +
        "resume/notes) — never invent details, never use outside knowledge, never guess.\n\n" +
        "If the question is behavioral (\"tell me about a time...\", \"describe a situation...\", \"give an " +
        "example of...\"), structure the answer using the STAR method, each part exactly one short sentence, " +
        "labeled on its own line:\nSituation: ...\nTask: ...\nAction: ...\nResult: ...\n\n" +
        "If the question is not behavioral (technical, factual, about the company, etc.), answer directly in " +
        "2-3 sentences — no STAR labels.\n\n" +
        "If the excerpts don't actually contain enough to answer, say so plainly instead of fabricating a STAR " +
        "story — a confidently made-up answer in a real interview is worse than admitting the documents don't " +
        "cover it.",
      messages: [
        {
          role: "user",
          content: `Document excerpts:\n\n${context}\n\nQuestion being asked right now: ${question}`
        }
      ]
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data.content?.[0]?.text?.trim();
  if (!answer) throw new Error("Empty answer response");
  return answer;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const appSecret = Deno.env.get("APP_SECRET");
  if (appSecret && req.headers.get("x-app-secret") !== appSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, 400);
  }

  const { question } = body;
  if (typeof question !== "string" || !question.trim() || question.length > 4000) {
    return jsonResponse({ error: "invalid question" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const chunks = await retrieveChunks(supabase, question.trim());
    const answer = await synthesizeAnswer(question.trim(), chunks);
    return jsonResponse({
      answer,
      sources: chunks.map((c) => c.documentTitle)
    });
  } catch (err) {
    console.error("ask error:", (err as Error).message);
    return jsonResponse({ error: "failed to generate answer" }, 502);
  }
});
