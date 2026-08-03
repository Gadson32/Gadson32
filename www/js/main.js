(() => {
  const el = (id) => document.getElementById(id);

  const setupScreen = el("setup-screen");
  const callScreen = el("call-screen");
  const displayNameInput = el("display-name");
  const roomCodeInput = el("room-code");
  const generateRoomBtn = el("generate-room-btn");
  const myLanguageSelect = el("my-language");
  const targetLanguageSelect = el("target-language");
  const joinBtn = el("join-btn");
  const setupError = el("setup-error");
  const permissionStatus = el("permission-status");

  const localVideo = el("local-video");
  const remoteVideo = el("remote-video");
  const connectionBanner = el("connection-banner");
  const captionList = el("caption-list");
  const offlineBanner = el("offline-banner");
  const queueCountEl = el("queue-count");

  const toggleMicBtn = el("toggle-mic-btn");
  const toggleCamBtn = el("toggle-cam-btn");
  const toggleCaptionsBtn = el("toggle-captions-btn");
  const leaveBtn = el("leave-btn");

  let state = {
    micOn: true,
    camOn: true,
    captionsOn: true,
    myLang: "en-US",
    targetLang: "es-ES",
    displayName: ""
  };

  populateLanguageSelect(myLanguageSelect, "en-US");
  populateLanguageSelect(targetLanguageSelect, "es-ES");

  generateRoomBtn.addEventListener("click", () => {
    roomCodeInput.value = Math.random().toString(36).slice(2, 8).toUpperCase();
  });

  function showSetupError(message) {
    setupError.textContent = message;
    setupError.hidden = false;
  }

  joinBtn.addEventListener("click", async () => {
    setupError.hidden = true;
    const name = displayNameInput.value.trim();
    const room = roomCodeInput.value.trim().toUpperCase();
    if (!name || !room) {
      showSetupError("Enter your name and a room code.");
      return;
    }

    joinBtn.disabled = true;
    permissionStatus.hidden = true;

    const permissionResult = await window.PermissionsManager.ensureAll();
    if (!permissionResult.granted) {
      permissionStatus.hidden = false;
      permissionStatus.innerHTML = `Microphone${permissionResult.reason === "speech" ? "/speech" : ""} access is required. `;
      const settingsLink = document.createElement("button");
      settingsLink.textContent = "Open Settings";
      settingsLink.className = "btn-secondary";
      settingsLink.style.marginTop = "6px";
      settingsLink.onclick = () => window.PermissionsManager.openAppSettings();
      permissionStatus.appendChild(settingsLink);
      joinBtn.disabled = false;
      return;
    }

    state.displayName = name;
    state.myLang = myLanguageSelect.value;
    state.targetLang = targetLanguageSelect.value;

    try {
      await joinCall(room);
      setupScreen.hidden = true;
      callScreen.hidden = false;
    } catch (err) {
      showSetupError(err.message || "Could not start the call.");
      joinBtn.disabled = false;
    }
  });

  async function joinCall(room) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideo.srcObject = stream;

    await window.WebRTCCall.init(stream, {
      onRemoteStream: (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
      },
      onConnectionState: (connState) => {
        if (connState === "connected") {
          connectionBanner.hidden = true;
        } else {
          connectionBanner.hidden = false;
          connectionBanner.textContent =
            connState === "connecting" ? "Connecting…" : connState === "disconnected" ? "Reconnecting…" : connState;
        }
      }
    });

    window.SignalingClient.on("message", (msg) => {
      if (msg.type === "caption") renderRemoteCaption(msg.caption);
    });
    window.SignalingClient.connect();
    window.SignalingClient.join(room, state.displayName);

    window.AppLifecycle.startCallService();
    startCaptions();
    watchNetwork();
  }

  function startCaptions() {
    if (!window.SpeechEngine.isSupported()) {
      renderSystemNote("Speech recognition isn't available on this device/browser.");
      return;
    }
    window.SpeechEngine.start(state.myLang, {
      onResult: handleTranscript,
      onError: (err) => console.warn("Speech engine error", err)
    });
  }

  let pendingLine = null;

  async function handleTranscript({ text, isFinal }) {
    if (!state.captionsOn || !text) return;

    if (!pendingLine) {
      pendingLine = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    }

    renderLocalCaption(pendingLine.id, text, isFinal);

    if (isFinal) {
      const line = pendingLine;
      pendingLine = null;

      window.SignalingClient.sendCaption({ id: line.id, speaker: state.displayName, text, final: true });

      const queued = await window.TranslateQueue.enqueue({
        id: line.id,
        text,
        sourceLang: state.myLang,
        targetLang: state.targetLang
      });
    }
  }

  window.TranslateQueue.onUpdate((items) => {
    const pending = items.filter((i) => i.status !== "done").length;
    queueCountEl.textContent = String(pending);
    offlineBanner.hidden = pending === 0 || navigator.onLine;

    for (const item of items) {
      if (item.status === "done") {
        setLocalTranslation(item.id, item.translation);
      }
    }
  });

  function renderLocalCaption(id, text, isFinal) {
    let entry = document.getElementById(`caption-${id}`);
    if (!entry) {
      entry = document.createElement("div");
      entry.id = `caption-${id}`;
      entry.className = "caption-entry pending";
      entry.innerHTML = `<span class="speaker"></span><span class="text"></span><span class="translated"></span>`;
      entry.querySelector(".speaker").textContent = `${state.displayName}:`;
      captionList.appendChild(entry);
      captionList.scrollTop = captionList.scrollHeight;
    }
    entry.querySelector(".text").textContent = text;
    if (isFinal) entry.querySelector(".translated").textContent = "translating…";
  }

  function setLocalTranslation(id, translation) {
    const entry = document.getElementById(`caption-${id}`);
    if (!entry) return;
    entry.classList.remove("pending");
    entry.querySelector(".translated").textContent = translation;
  }

  function renderRemoteCaption(caption) {
    const id = `remote-${caption.id}`;
    let entry = document.getElementById(id);
    if (!entry) {
      entry = document.createElement("div");
      entry.id = id;
      entry.className = "caption-entry";
      entry.innerHTML = `<span class="speaker"></span><span class="text"></span><span class="translated"></span>`;
      entry.querySelector(".speaker").textContent = `${caption.speaker}:`;
      captionList.appendChild(entry);
      captionList.scrollTop = captionList.scrollHeight;
    }
    entry.querySelector(".text").textContent = caption.text;
  }

  function renderSystemNote(text) {
    const entry = document.createElement("div");
    entry.className = "caption-entry";
    entry.innerHTML = `<span class="translated"></span>`;
    entry.querySelector(".translated").textContent = text;
    captionList.appendChild(entry);
  }

  function watchNetwork() {
    const applyStatus = (connected) => {
      window.TranslateQueue.setOnline(connected);
      if (!connected) offlineBanner.hidden = false;
    };

    if (window.Capacitor && window.Capacitor.Plugins.Network) {
      window.Capacitor.Plugins.Network.addListener("networkStatusChange", (status) => {
        applyStatus(status.connected);
      });
      window.Capacitor.Plugins.Network.getStatus().then((s) => applyStatus(s.connected));
    } else {
      window.addEventListener("online", () => applyStatus(true));
      window.addEventListener("offline", () => applyStatus(false));
      applyStatus(navigator.onLine);
    }
  }

  toggleMicBtn.addEventListener("click", () => {
    state.micOn = !state.micOn;
    window.WebRTCCall.setMicEnabled(state.micOn);
    toggleMicBtn.classList.toggle("muted", !state.micOn);
  });

  toggleCamBtn.addEventListener("click", () => {
    state.camOn = !state.camOn;
    window.WebRTCCall.setCameraEnabled(state.camOn);
    toggleCamBtn.classList.toggle("muted", !state.camOn);
  });

  toggleCaptionsBtn.addEventListener("click", () => {
    state.captionsOn = !state.captionsOn;
    toggleCaptionsBtn.classList.toggle("active", state.captionsOn);
    if (state.captionsOn) startCaptions();
    else window.SpeechEngine.stop();
  });

  leaveBtn.addEventListener("click", () => {
    window.SpeechEngine.stop();
    window.WebRTCCall.teardown();
    window.SignalingClient.close();
    window.AppLifecycle.stopCallService();
    callScreen.hidden = true;
    setupScreen.hidden = false;
    joinBtn.disabled = false;
    captionList.innerHTML = "";
  });

  window.AppLifecycle.init({
    onBackground: () => {
      if (state.captionsOn) window.SpeechEngine.stop();
    },
    onForeground: () => {
      if (state.captionsOn && !callScreen.hidden) startCaptions();
    }
  });
})();
