import { Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Reklam alanı (placeholder).
 *
 * Şu an görsel bir yer tutucu olarak çalışır; gerçek reklamlar için
 * AdMob (Capacitor @capacitor-community/admob) entegrasyonu yapıldığında
 * bu bileşenin içi banner ad unit ile değiştirilebilir.
 *
 * variant:
 *   "banner" -> üstte geniş şerit
 *   "inline" -> maç listeleri arasına sıkışan ince şerit
 */
export default function AdSlot({ variant = "inline" }) {
  const { t } = useTranslation();
  const isBanner = variant === "banner";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-900 to-slate-900/60 ${
        isBanner ? "px-4 py-5" : "px-4 py-3"
      }`}
    >
      <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-950/70 border border-slate-800 rounded px-1.5 py-0.5">
        {t("ad.label")}
      </span>
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-800/70 flex items-center justify-center">
          <Megaphone size={16} className="text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-slate-300 truncate ${isBanner ? "text-sm" : "text-xs"}`}>
            {t("ad.sponsored")}
          </p>
          <p className="text-[11px] text-slate-600 truncate">
            {t("ad.space")}
          </p>
        </div>
      </div>
    </div>
  );
}
