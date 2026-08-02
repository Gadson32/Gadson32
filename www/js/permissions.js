// Native permission handling. On a wrapped WebView there is no browser
// permission bar to fall back on — a denial has to be resolved by sending
// the user to the OS Settings app, so every check here also exposes a
// "openAppSettings" escape hatch.
window.PermissionsManager = (() => {
  const isNative = () => window.Capacitor && window.Capacitor.isNativePlatform();

  async function ensureMicAndCamera() {
    // getUserMedia triggers the OS-level permission prompt inside the
    // WebView on both Android and iOS — Capacitor doesn't need a
    // separate plugin for this one, unlike speech recognition below.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err) {
      return { granted: false, error: err.name || "PermissionDenied" };
    }
  }

  async function ensureSpeechRecognition() {
    if (!isNative()) {
      // Web Speech API on desktop/dev browsers handles its own prompt.
      return { granted: true };
    }
    const { SpeechRecognition } = window.Capacitor.Plugins;
    if (!SpeechRecognition) {
      return { granted: false, error: "PluginUnavailable" };
    }
    const current = await SpeechRecognition.checkPermissions();
    if (current.speechRecognition === "granted") {
      return { granted: true };
    }
    const requested = await SpeechRecognition.requestPermissions();
    return { granted: requested.speechRecognition === "granted" };
  }

  async function openAppSettings() {
    if (!isNative() || !window.Capacitor.Plugins.NativeSettings) {
      window.alert("Please enable microphone/speech permissions in your device Settings.");
      return;
    }
    const { NativeSettings, AndroidSettings, IOSSettings } = window.Capacitor.Plugins;
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App
    });
  }

  async function ensureAll() {
    const media = await ensureMicAndCamera();
    if (!media.granted) {
      return { granted: false, reason: "mic-camera", error: media.error };
    }
    const speech = await ensureSpeechRecognition();
    if (!speech.granted) {
      return { granted: false, reason: "speech", error: speech.error };
    }
    return { granted: true };
  }

  return { ensureAll, ensureMicAndCamera, ensureSpeechRecognition, openAppSettings };
})();
