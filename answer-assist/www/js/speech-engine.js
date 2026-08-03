// Speech-to-text abstraction — native plugin on-device (the Web Speech
// API doesn't exist inside a Capacitor WebView), Web Speech API as a
// desktop-browser dev fallback only. Rolling/continuous, unlike a
// single-shot dictation call, since this needs to keep transcribing for
// the whole conversation.
window.SpeechEngine = (() => {
  let listening = false;
  let currentLang = "en-US";
  let onResultCb = null;
  let onErrorCb = null;
  let webRecognizer = null;
  let restartTimer = null;
  let webErrorStreak = 0;

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  }

  function nativePlugin() {
    return window.Capacitor.Plugins.SpeechRecognition;
  }

  async function start(lang, { onResult, onError } = {}) {
    currentLang = lang || currentLang;
    onResultCb = onResult || null;
    onErrorCb = onError || null;

    if (listening) await stop();

    if (isNative()) {
      await startNative();
    } else {
      startWebFallback();
    }
    listening = true;
  }

  async function startNative() {
    const plugin = nativePlugin();
    if (!plugin) {
      onErrorCb && onErrorCb(new Error("Native speech recognition plugin not available"));
      return;
    }

    plugin.addListener("partialResults", (data) => {
      const text = Array.isArray(data.matches) ? data.matches[0] : data.value?.[0];
      if (text) onResultCb && onResultCb({ text, isFinal: false });
    });

    plugin.addListener("listeningState", (data) => {
      if (data.status === "stopped" && listening) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          if (listening) startNative();
        }, 250);
      }
    });

    try {
      await plugin.start({
        language: currentLang,
        maxResults: 1,
        prompt: "",
        partialResults: true,
        popup: false
      });
    } catch (err) {
      onErrorCb && onErrorCb(err);
    }
  }

  function startWebFallback() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      onErrorCb && onErrorCb(new Error("Web Speech API unavailable in this browser"));
      return;
    }
    webErrorStreak = 0;
    webRecognizer = new Ctor();
    webRecognizer.lang = currentLang;
    webRecognizer.continuous = true;
    webRecognizer.interimResults = true;

    webRecognizer.onresult = (event) => {
      webErrorStreak = 0;
      const result = event.results[event.results.length - 1];
      onResultCb && onResultCb({ text: result[0].transcript, isFinal: result.isFinal });
    };
    webRecognizer.onerror = (event) => {
      webErrorStreak += 1;
      onErrorCb && onErrorCb(new Error(event.error));
    };
    webRecognizer.onend = () => {
      if (!listening) return;
      if (webErrorStreak >= 5) {
        listening = false;
        onErrorCb && onErrorCb(new Error("Speech recognition failed repeatedly; giving up"));
        return;
      }
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        if (listening) webRecognizer.start();
      }, webErrorStreak > 0 ? 500 : 0);
    };
    webRecognizer.start();
  }

  async function stop() {
    listening = false;
    clearTimeout(restartTimer);
    if (isNative()) {
      const plugin = nativePlugin();
      if (plugin) {
        try {
          await plugin.stop();
          plugin.removeAllListeners();
        } catch (_) {
          // already stopped
        }
      }
    } else if (webRecognizer) {
      webRecognizer.onend = null;
      webRecognizer.stop();
      webRecognizer = null;
    }
  }

  function isSupported() {
    if (isNative()) return !!nativePlugin();
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  return { start, stop, isSupported, get listening() { return listening; } };
})();
