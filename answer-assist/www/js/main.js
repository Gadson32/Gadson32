(() => {
  const el = (id) => document.getElementById(id);

  const tabDocumentsBtn = el("tab-documents-btn");
  const tabLiveBtn = el("tab-live-btn");
  const documentsScreen = el("documents-screen");
  const liveScreen = el("live-screen");

  const fileInput = el("file-input");
  const uploadBtn = el("upload-btn");
  const uploadStatus = el("upload-status");
  const documentList = el("document-list");

  const listenBtn = el("listen-btn");
  const listeningIndicator = el("listening-indicator");
  const transcriptPanel = el("transcript-panel");
  const askBtn = el("ask-btn");
  const answerCard = el("answer-card");
  const answerText = el("answer-text");
  const answerSources = el("answer-sources");
  const permissionStatus = el("permission-status");

  let rollingTranscript = "";
  let listening = false;

  // --- Tabs ---
  function showTab(tab) {
    const isDocs = tab === "documents";
    documentsScreen.hidden = !isDocs;
    liveScreen.hidden = isDocs;
    tabDocumentsBtn.classList.toggle("active", isDocs);
    tabLiveBtn.classList.toggle("active", !isDocs);
    if (isDocs) refreshDocumentList();
  }
  tabDocumentsBtn.addEventListener("click", () => showTab("documents"));
  tabLiveBtn.addEventListener("click", () => showTab("live"));

  // --- Documents ---
  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;

    uploadStatus.hidden = false;
    uploadStatus.textContent = `Processing "${file.name}"…`;
    uploadBtn.disabled = true;

    try {
      const result = await window.Documents.upload(file);
      uploadStatus.textContent = `Added "${file.name}" (${result.chunkCount} chunks indexed).`;
      await refreshDocumentList();
    } catch (err) {
      uploadStatus.textContent = `Failed: ${err.message}`;
    } finally {
      uploadBtn.disabled = false;
    }
  });

  async function refreshDocumentList() {
    documentList.innerHTML = "<p class=\"status-text\">Loading…</p>";
    try {
      const docs = await window.Documents.list();
      documentList.innerHTML = "";
      if (docs.length === 0) {
        documentList.innerHTML = "<p class=\"status-text\">No documents uploaded yet.</p>";
        return;
      }
      for (const doc of docs) {
        const row = document.createElement("div");
        row.className = "document-row";
        row.innerHTML = `
          <div>
            <div class="doc-title"></div>
            <div class="doc-meta"></div>
          </div>
          <button class="delete-btn" type="button">Delete</button>
        `;
        row.querySelector(".doc-title").textContent = doc.title;
        row.querySelector(".doc-meta").textContent = `${doc.chunkCount} chunks`;
        row.querySelector(".delete-btn").addEventListener("click", async () => {
          row.querySelector(".delete-btn").disabled = true;
          try {
            await window.Documents.remove(doc.id);
            await refreshDocumentList();
          } catch (err) {
            window.alert(`Failed to delete: ${err.message}`);
            row.querySelector(".delete-btn").disabled = false;
          }
        });
        documentList.appendChild(row);
      }
    } catch (err) {
      documentList.innerHTML = `<p class="status-text">Failed to load documents: ${err.message}</p>`;
    }
  }

  // --- Live listening ---
  listenBtn.addEventListener("click", async () => {
    if (listening) {
      window.SpeechEngine.stop();
      listening = false;
      listenBtn.textContent = "Start listening";
      listeningIndicator.hidden = true;
      return;
    }

    permissionStatus.hidden = true;
    const permissionResult = await window.PermissionsManager.ensureAll();
    if (!permissionResult.granted) {
      permissionStatus.hidden = false;
      permissionStatus.textContent = `Microphone${permissionResult.reason === "speech" ? "/speech" : ""} access is required.`;
      return;
    }

    if (!window.SpeechEngine.isSupported()) {
      permissionStatus.hidden = false;
      permissionStatus.textContent = "Speech recognition isn't available on this device/browser.";
      return;
    }

    rollingTranscript = "";
    transcriptPanel.innerHTML = "";
    askBtn.disabled = false;

    window.SpeechEngine.start("en-US", {
      onResult: handleTranscript,
      onError: (err) => console.warn("Speech engine error", err)
    });
    listening = true;
    listenBtn.textContent = "Stop listening";
    listeningIndicator.hidden = false;
  });

  let pendingLineEl = null;

  function handleTranscript({ text, isFinal }) {
    if (!text) return;
    if (!pendingLineEl) {
      pendingLineEl = document.createElement("p");
      transcriptPanel.appendChild(pendingLineEl);
    }
    pendingLineEl.textContent = text;
    transcriptPanel.scrollTop = transcriptPanel.scrollHeight;

    if (isFinal) {
      rollingTranscript += (rollingTranscript ? " " : "") + text;
      pendingLineEl = null;
    }
  }

  askBtn.addEventListener("click", async () => {
    const question = rollingTranscript.trim();
    if (!question) {
      window.alert("Nothing's been transcribed yet — say something first.");
      return;
    }

    askBtn.disabled = true;
    askBtn.textContent = "Thinking…";
    answerCard.hidden = true;

    try {
      const { answer, sources } = await window.Api.ask(question);
      answerText.textContent = answer;
      answerSources.textContent = sources.length ? `Sources: ${sources.join(", ")}` : "";
      answerCard.hidden = false;
      // Reset the rolling transcript after each answer so the next tap
      // covers only what's been said since — otherwise every answer
      // would keep re-including the whole conversation so far.
      rollingTranscript = "";
    } catch (err) {
      window.alert(`Failed to get an answer: ${err.message}`);
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = "Get answer";
    }
  });

  refreshDocumentList();
})();
