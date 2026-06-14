import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const PICK = { home: "1", draw: "X", away: "2" };

export default function BetSlip({ onClose }) {
  const { t } = useTranslation();
  const { slip, removeFromSlip, clearSlip, totalOdd, points, league, refresh } = useApp();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stake = parseInt(amount, 10) || 0;
  const potential = Math.floor(stake * totalOdd);
  const valid = stake >= 10 && stake <= points && slip.length >= 1;

  const confirm = async () => {
    setError(""); setBusy(true);
    const { error } = await supabase.rpc("place_coupon", {
      _league_id: league.id,
      _amount: stake,
      _legs: slip.map((s) => ({ match_id: s.match.id, bet_type: s.bet_type })),
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    clearSlip();
    refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border-t border-x border-slate-800 rounded-t-2xl p-5 pb-7 sheet-in max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-100">{t("slip.coupon")}</h3>
          <div className="flex items-center gap-3">
            {slip.length > 1 && (
              <button onClick={clearSlip} className="text-xs text-slate-500 hover:text-rose-400">{t("slip.clear")}</button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={20} /></button>
          </div>
        </div>

        {/* Maçlar */}
        <div className="space-y-2 mb-4">
          {slip.map((s) => (
            <div key={s.match.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
                {PICK[s.bet_type]}
              </span>
              <p className="flex-1 text-sm text-slate-200 truncate">{s.match.team1} – {s.match.team2}</p>
              <span className="text-sm font-semibold text-slate-100 tabular-nums">{s.odd.toFixed(2)}</span>
              <button onClick={() => removeFromSlip(s.match.id)} className="text-slate-600 hover:text-rose-400 p-0.5">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {slip.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">{t("slip.empty")}</p>
          )}
        </div>

        {/* Toplam oran */}
        <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-3 mb-4">
          <span className="text-slate-400">{t("slip.totalOdd")}</span>
          <span className="font-bold text-slate-100 tabular-nums">{totalOdd.toFixed(2)}</span>
        </div>

        {/* Miktar */}
        <label className="text-xs text-slate-400 mb-1.5 block">
          {t("slip.stake")} <span className="text-slate-600">· {t("slip.balance", { points: points.toLocaleString() })}</span>
        </label>
        <input
          type="number" inputMode="numeric" min={10} max={points}
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-semibold text-slate-100 placeholder-slate-700 focus:outline-none focus:border-emerald-500 mb-2 tabular-nums"
        />
        <div className="flex gap-2 mb-4">
          {[50, 100, 250, 500].map((v) => (
            <button key={v} onClick={() => setAmount(String(Math.min(v, points)))}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-600">
              {v}
            </button>
          ))}
          <button onClick={() => setAmount(String(points))}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-600">
            {t("slip.max")}
          </button>
        </div>

        <div className="flex items-center justify-between bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
          <span className="text-xs text-emerald-300">{t("slip.potential")}</span>
          <span className="text-lg font-bold text-emerald-400 tabular-nums">{potential.toLocaleString("tr-TR")} GP</span>
        </div>

        {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

        <button
          onClick={confirm} disabled={!valid || busy}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition disabled:opacity-40"
        >
          {busy ? t("slip.sending") : t("slip.confirm")}
        </button>
        <p className="text-[11px] text-slate-600 text-center mt-2">
          {t("slip.rule")}
        </p>
      </div>
    </div>
  );
}
