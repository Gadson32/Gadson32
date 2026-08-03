// Native permission handling — mic + speech recognition only (no
// camera, this app doesn't do video). Same rationale as the video-call
// app: a wrapped WebView has no browser permission bar to fall back on,
// so a denial needs an explicit path to OS Settings.
window.PermissionsManager = (() => {
  const isNative = () => window.Capacitor && window.Capacitor.isNativePlatform();

  async function ensureMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err) {
      return { granted: false, error: err.name || "PermissionDenied" };
    }
  }

  async function ensureSpeechRecognition() {
    if (!isNative()) return { granted: true };
    const { SpeechRecognition } = window.Capacitor.Plugins;
    if (!SpeechRecognition) return { granted: false, error: "PluginUnavailable" };
    const current = await SpeechRecognition.checkPermissions();
    if (current.speechRecognition === "granted") return { granted: true };
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
    const mic = await ensureMic();
    if (!mic.granted) return { granted: false, reason: "mic", error: mic.error };
    const speech = await ensureSpeechRecognition();
    if (!speech.granted) return { granted: false, reason: "speech", error: speech.error };
    return { granted: true };
  }

  return { ensureAll, openAppSettings };
})();
