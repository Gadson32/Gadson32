// Client-side text extraction so the Edge Function only ever handles
// plain text, not file parsing. Supports .txt/.md directly and PDFs via
// a locally-vendored pdf.js (no CDN dependency — same reasoning as
// vendoring supabase-js in the other app: this needs to work offline
// and not depend on a third-party host being reachable).
window.Documents = (() => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.js";
  }

  async function extractText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return extractPdfText(file);
    if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
    throw new Error("Unsupported file type — upload a .pdf, .txt, or .md file");
  }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF support failed to load");
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str).join(" "));
    }
    return pageTexts.join("\n\n");
  }

  async function upload(file) {
    const text = await extractText(file);
    if (!text.trim()) throw new Error("No text could be extracted from this file");
    const title = file.name.replace(/\.[^.]+$/, "");
    return window.Api.ingestDocument(title, text);
  }

  async function list() {
    const { documents } = await window.Api.listDocuments();
    return documents;
  }

  function remove(documentId) {
    return window.Api.deleteDocument(documentId);
  }

  return { upload, list, remove };
})();
