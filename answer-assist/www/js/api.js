// Thin client for the Supabase Edge Functions. Every call sends both the
// anon key (Supabase's own JWT gate) and the x-app-secret header (the
// extra gate specific to this app, since it holds private documents —
// see the Edge Function comments for why the anon key alone isn't
// enough here).
window.Api = (() => {
  async function call(functionName, { method = "POST", body, signal } = {}) {
    const headers = {
      Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
      apikey: window.APP_CONFIG.SUPABASE_ANON_KEY
    };
    if (window.APP_CONFIG.APP_SECRET) {
      headers["x-app-secret"] = window.APP_CONFIG.APP_SECRET;
    }
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/${functionName}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `${functionName} failed: ${res.status}`);
    }
    return data;
  }

  function ingestDocument(title, text) {
    return call("ingest-document", { body: { title, text } });
  }

  function listDocuments() {
    return call("list-documents", { method: "GET" });
  }

  function deleteDocument(documentId) {
    return call("delete-document", { body: { documentId } });
  }

  function ask(question) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), window.APP_CONFIG.ANSWER_TIMEOUT_MS);
    return call("ask", { body: { question }, signal: controller.signal }).finally(() => clearTimeout(timeout));
  }

  return { ingestDocument, listDocuments, deleteDocument, ask };
})();
