// Splits an uploaded document's already-extracted text into chunks and
// stores them for full-text search. Text extraction (PDF/plain text)
// happens client-side (see www/js/documents.js) — this function only
// ever sees plain text, keeping it simple and avoiding a PDF-parsing
// dependency here.
//
// Auth: gated by a shared secret (APP_SECRET, set via `supabase secrets
// set`) checked against the `x-app-secret` header, not just the public
// anon key — these documents can be private (SOPs, company docs), so
// relying on the anon key alone (extractable from the shipped app)
// isn't enough. This is a personal-use app, not multi-tenant; real
// per-user isolation would need actual accounts (Supabase Auth), which
// would be overkill here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const MAX_TEXT_LENGTH = 2_000_000; // ~2MB of text per document

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

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const appSecret = Deno.env.get("APP_SECRET");
  if (appSecret && req.headers.get("x-app-secret") !== appSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: { title?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, 400);
  }

  const { title, text } = body;
  if (typeof title !== "string" || !title.trim() || title.length > 300) {
    return jsonResponse({ error: "invalid title" }, 400);
  }
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: "invalid text" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({ title: title.trim() })
    .select("id")
    .single();

  if (docError || !doc) {
    console.error("insert document error:", docError?.message);
    return jsonResponse({ error: "failed to save document" }, 502);
  }

  const chunks = chunkText(text.trim());
  const rows = chunks.map((content, chunk_index) => ({
    document_id: doc.id,
    chunk_index,
    content
  }));

  const { error: chunkError } = await supabase.from("document_chunks").insert(rows);
  if (chunkError) {
    console.error("insert chunks error:", chunkError.message);
    // Best-effort cleanup so a failed ingest doesn't leave an empty document behind.
    await supabase.from("documents").delete().eq("id", doc.id);
    return jsonResponse({ error: "failed to save document chunks" }, 502);
  }

  return jsonResponse({ documentId: doc.id, chunkCount: chunks.length });
});
