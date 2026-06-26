import { useTranslation } from "react-i18next";
import { setLanguage } from "../locales/i18n";

// Açılış ekranlarında (yaş kapısı / giriş) sağ üstte küçük TR/EN seçici.
export default function LangToggle({ className = "" }) {
  const { i18n } = useTranslation();
  const cur = i18n.language?.startsWith("tr") ? "tr" : "en";
  return (
    <div className={`inline-flex items-center rounded-lg bg-slate-900/80 border border-slate-800 p-0.5 ${className}`}>
      {["tr", "en"].map((code) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          aria-label={code === "tr" ? "Türkçe" : "English"}
          className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
            cur === code ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
