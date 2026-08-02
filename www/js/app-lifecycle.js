// Policy: captions/speech-recognition pause when the app is backgrounded
// and resume on foreground — SFSpeechRecognizer/SpeechRecognizer are not
// guaranteed to keep running once the app is suspended, so this avoids
// silently dropping partial results instead of pretending it still works.
//
// Call audio itself is handled separately per platform:
// - iOS: Info.plist declares UIBackgroundModes=audio, so WebRTC audio
//   keeps flowing while backgrounded (video won't render off-screen,
//   which matches normal iOS camera-in-background restrictions).
// - Android: no foreground service is implemented yet, so the OS may
//   suspend the WebView (and the call with it) shortly after
//   backgrounding. Add a foreground service with a persistent
//   notification before shipping if background calls matter on Android.
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

  return { init };
})();
