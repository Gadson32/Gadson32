// Server-side translation. The API key lives only here, in the server
// process's environment — never shipped to the client, unlike the
// sandbox's `window.claude.complete`, which only worked because the key
// was already scoped into that specific preview environment.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.TRANSLATE_MODEL || "claude-haiku-4-5-20251001";

const languageNameByCode = {
  "en-US": "English", "en-GB": "English", "es-ES": "Spanish", "fr-FR": "French",
  "de-DE": "German", "it-IT": "Italian", "pt-BR": "Portuguese", "ja-JP": "Japanese",
  "ko-KR": "Korean", "zh-CN": "Mandarin Chinese", "hi-IN": "Hindi", "ar-SA": "Arabic"
};

function languageName(code) {
  return languageNameByCode[code] || code;
}

async function translate(text, sourceLang, targetLang) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }

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

module.exports = { translate };
