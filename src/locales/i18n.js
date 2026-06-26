import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import tr from "./tr.json";
import en from "./en.json";

// Kullanıcının AÇIK dil seçimi yalnızca bu anahtarda tutulur. Otomatik
// (telefon diline göre) algılama buraya YAZILMAZ — böylece kullanıcı elle
// seçene kadar her açılışta telefon ayarı baz alınır.
const STORE_KEY = "bf_lang";

// Başlangıç dili: 1) kullanıcının önceki açık seçimi  2) telefon/tarayıcı dili
// 3) İngilizce. Eski "kg_lang" cache'i bilerek yok sayılır (yanlış takılmayı önler).
function initialLang() {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved === "tr" || saved === "en") return saved;
  const dev = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return dev.startsWith("tr") ? "tr" : "en";
}

i18n
  .use(initReactI18next)
  .init({
    resources: { tr: { translation: tr }, en: { translation: en } },
    lng: initialLang(),
    fallbackLng: "en",          // tr/en dışındaki diller -> İngilizce
    supportedLngs: ["tr", "en"],
    interpolation: { escapeValue: false },
  });

// Kullanıcı elle dil seçtiğinde çağrılır: seçimi kalıcı kaydeder + uygular.
export function setLanguage(lng) {
  const base = (lng || "en").split("-")[0] === "tr" ? "tr" : "en";
  localStorage.setItem(STORE_KEY, base);
  i18n.changeLanguage(base);
}

// <html lang> özniteliğini aktif dile bağla — CSS uppercase'in doğru
// (Latin) döküm kurallarını kullanması için kritik (Türkçe İ sorununu önler).
const applyHtmlLang = (lng) => {
  document.documentElement.setAttribute("lang", (lng || "en").split("-")[0]);
};
applyHtmlLang(i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export default i18n;
