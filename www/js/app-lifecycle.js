// Policy: captions/speech-recognition pause when the app is backgrounded
// and resume on foreground — SFSpeechRecognizer/SpeechRecognizer are not
// guaranteed to keep running once the app is suspended, so this avoids
// silently dropping partial results instead of pretending it still works.
//
// Call audio itself is handled separately per platform, both started
// around join/leave rather than tied to background/foreground directly:
// - iOS: Info.plist declares UIBackgroundModes=audio, so WebRTC audio
//   keeps flowing while backgrounded (video won't render off-screen,
//   which matches normal iOS camera-in-background restrictions).
// - Android: startCallService()/stopCallService() below start a native
//   foreground service (CallForegroundPlugin/CallForegroundService,
//   camera+microphone types) for the duration of the call, so the OS
//   doesn't suspend the app a few seconds after backgrounding.
window.AppLifecycle = (() => {
  let onBackgroundCb = null;
  let onForegroundCb = null;

  function init({ onBackground, onForeground } = {}) {
    onBackgroundCb = onBackground || null;
    onForegroundCb = onForeground || null;

    if (window.Capacitor && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onForegroundCb && onForegroundCb();
        else onBackgroundCb && onBackgroundCb();
      });
    } else {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) onBackgroundCb && onBackgroundCb();
        else onForegroundCb && onForegroundCb();
      });
    }
  }

  function isAndroidNative() {
    return !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "android");
  }

  async function startCallService() {
    if (!isAndroidNative()) return;
    const plugin = window.Capacitor.Plugins.CallForegroundService;
    if (!plugin) return;
    try {
      await plugin.start();
    } catch (err) {
      console.warn("Failed to start call foreground service", err);
    }
  }

  async function stopCallService() {
    if (!isAndroidNative()) return;
    const plugin = window.Capacitor.Plugins.CallForegroundService;
    if (!plugin) return;
    try {
      await plugin.stop();
    } catch (err) {
      console.warn("Failed to stop call foreground service", err);
    }
  }

  return { init, startCallService, stopCallService };
})();
