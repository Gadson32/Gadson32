// Server-side translation, running as a Supabase Edge Function instead of
// a self-hosted Node process. The Anthropic key lives only in this
// function's environment (set via `supabase secrets set`), never shipped
// to the client — this is what replaces the sandbox-only
// `window.claude.complete`.
//
// Auth: deployed with verify_jwt=true, so callers must send the
// project's anon/publishable key (or a user JWT) as
// `Authorization: Bearer <key>` — the standard way public Supabase
// functions are called from a client. The anon key is meant to be
// embedded in the app; it is not a secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("TRANSLATE_MODEL") || "claude-haiku-4-5-20251001";

const languageNameByCode: Record<string, string> = {
  "en-US": "English", "en-GB": "English", "es-ES": "Spanish", "fr-FR": "French",
  "de-DE": "German", "it-IT": "Italian", "pt-BR": "Portuguese", "ja-JP": "Japanese",
  "ko-KR": "Korean", "zh-CN": "Mandarin Chinese", "hi-IN": "Hindi", "ar-SA": "Arabic"
};

function languageName(code: string): string {
  return languageNameByCode[code] || code;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

async function translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  if (sourceLang === targetLang) return text;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      system:
        "You translate live spoken captions for a video call. Reply with ONLY the translation, " +
        "no notes, no quotes, no original text repeated.",
      messages: [
        {
          role: "user",
          content: `Translate this ${languageName(sourceLang)} caption to ${languageName(targetLang)}:\n\n${text}`
        }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const translation = data.content?.[0]?.text?.trim();
  if (!translation) throw new Error("Empty translation response");
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
