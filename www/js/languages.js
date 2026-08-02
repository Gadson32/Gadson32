// BCP-47 codes drive both the native/Web Speech recognizer locale and the
// translation prompt. Keep this list in sync with what the speech
// recognition plugin actually supports on-device if you add languages.
window.SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ar-SA", label: "Arabic" }
];

function populateLanguageSelect(selectEl, defaultCode) {
  selectEl.innerHTML = "";
  for (const lang of window.SUPPORTED_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.label;
    if (lang.code === defaultCode) opt.selected = true;
    selectEl.appendChild(opt);
  }
}
