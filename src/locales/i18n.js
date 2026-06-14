import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import tr from "./tr.json";
import en from "./en.json";

i18n
  .use(LanguageDetector)        // telefon/tarayıcı dilini otomatik algılar
  .use(initReactI18next)
  .init({
    resources: { tr: { translation: tr }, en: { translation: en } },
    fallbackLng: "en",          // tr/en dışındaki diller -> İngilizce
    supportedLngs: ["tr", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "kg_lang",
      caches: ["localStorage"],
    },
  });

// <html lang> özniteliğini aktif dile bağla — CSS uppercase'in doğru
// (Latin) döküm kurallarını kullanması için kritik (Türkçe İ sorununu önler).
const applyHtmlLang = (lng) => {
  document.documentElement.setAttribute("lang", (lng || "en").split("-")[0]);
};
applyHtmlLang(i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export default i18n;
