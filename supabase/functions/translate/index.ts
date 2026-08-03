// Server-side translation, running as a Supabase Edge Function instead of
// a self-hosted Node process. Uses MyMemory (https://mymemory.translated.net)
// — a free translation API that needs no API key and no billing, unlike
// the Anthropic API this originally called. This is what replaces the
// sandbox-only `window.claude.complete`.
//
// MyMemory's anonymous free tier is limited to ~5,000 words/day per
// client IP; setting MYMEMORY_EMAIL (a Supabase secret, optional) raises
// that to ~50,000 words/day per MyMemory's docs, still free, no signup
// beyond having an email address they can rate-limit by.
//
// Auth: deployed with verify_jwt=true, so callers must send the
// project's anon/publishable key (or a user JWT) as
// `Authorization: Bearer <key>` — the standard way public Supabase
// functions are called from a client. The anon key is meant to be
// embedded in the app; it is not a secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MYMEMORY_API_URL = "https://api.mymemory.translated.net/get";

// MyMemory expects ISO 639-1 pairs (occasionally with a region, e.g.
// pt-BR for Brazilian vs. European Portuguese) — not the full BCP-47
// codes the app's language picker uses everywhere else.
const myMemoryLangByCode: Record<string, string> = {
  "en-US": "en", "en-GB": "en", "es-ES": "es", "fr-FR": "fr",
  "de-DE": "de", "it-IT": "it", "pt-BR": "pt-BR", "ja-JP": "ja",
  "ko-KR": "ko", "zh-CN": "zh-CN", "hi-IN": "hi", "ar-SA": "ar"
};

function myMemoryLang(code: string): string {
  return myMemoryLangByCode[code] || code.split("-")[0];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

async function translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (sourceLang === targetLang) return text;

  const langpair = `${myMemoryLang(sourceLang)}|${myMemoryLang(targetLang)}`;
  const params = new URLSearchParams({ q: text, langpair });
  const email = Deno.env.get("MYMEMORY_EMAIL");
  if (email) params.set("de", email);

  const res = await fetch(`${MYMEMORY_API_URL}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MyMemory API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const translation = data?.responseData?.translatedText?.trim();
  if (!translation) throw new Error("Empty translation response");
  // MyMemory returns HTTP 200 even when the daily quota is exhausted,
  // signaling it only through this string inside an otherwise normal
  // response body — a plain res.ok check would miss it.
  if (translation.includes("MYMEMORY WARNING")) {
    throw new Error(`MyMemory quota warning: ${translation.slice(0, 200)}`);
  }
  return translation;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let body: { text?: unknown; sourceLang?: unknown; targetLang?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { text, sourceLang, targetLang } = body;
  if (typeof text !== "string" || !text.trim() || text.length > 2000) {
    return new Response(JSON.stringify({ error: "invalid text" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (typeof sourceLang !== "string" || typeof targetLang !== "string") {
    return new Response(JSON.stringify({ error: "invalid language codes" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const translation = await translate(text.trim(), sourceLang, targetLang);
    return new Response(JSON.stringify({ translation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("translate error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "translation failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
