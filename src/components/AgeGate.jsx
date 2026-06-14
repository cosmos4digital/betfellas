import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { ShieldAlert } from "lucide-react";

// 18+ yaş kapısı — App Store / Google Play simüle bahis gereksinimi.
// Onay cihazda saklanır (localStorage), bir daha sorulmaz.
export default function AgeGate({ onConfirm }) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);

  const confirm = () => {
    localStorage.setItem("bf_age_ok", "1");
    onConfirm();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <img src="/logo-mark.png" alt="BetFellas" className="w-16 h-16 rounded-2xl mx-auto mb-5" />

        {denied ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <ShieldAlert size={32} className="text-rose-400 mx-auto mb-3" />
            <p className="text-slate-300 text-sm">{t("age.denied")}</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-100 mb-2">{t("age.title")}</h1>
            <p className="text-sm text-slate-400 mb-3">{t("age.body")}</p>
            <p className="text-xs text-slate-500 mb-6">{t("age.noMoney")}</p>

            <div className="space-y-2">
              <button
                onClick={confirm}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition"
              >
                {t("age.confirm")}
              </button>
              <button
                onClick={() => setDenied(true)}
                className="w-full py-3 rounded-xl font-medium text-sm text-slate-400 bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
              >
                {t("age.deny")}
              </button>
            </div>

            <p className="text-[11px] text-slate-600 mt-5 leading-relaxed">
              <Trans
                i18nKey="age.agree"
                t={t}
                components={{
                  terms: <a href="/terms.html" target="_blank" rel="noreferrer" className="text-emerald-400 underline" />,
                  privacy: <a href="/gizlilik.html" target="_blank" rel="noreferrer" className="text-emerald-400 underline" />,
                }}
              />
            </p>
          </>
        )}
      </div>
    </div>
  );
}
