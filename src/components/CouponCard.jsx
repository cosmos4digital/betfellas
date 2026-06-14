import { useTranslation } from "react-i18next";
import { Hourglass, CheckCircle2, XCircle } from "lucide-react";

const PICK = { home: "1", draw: "X", away: "2" };
const STATUS = {
  pending: { icon: Hourglass, color: "text-amber-400", key: "coupon.open" },
  won: { icon: CheckCircle2, color: "text-emerald-400", key: "coupon.won" },
  lost: { icon: XCircle, color: "text-rose-400", key: "coupon.lost" },
};

export default function CouponCard({ coupon }) {
  const { t } = useTranslation();
  const s = STATUS[coupon.status];
  const Icon = s.icon;
  const payout = Math.floor(coupon.amount * coupon.total_odd);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/70">
        <Icon size={14} className={s.color} />
        <span className={`text-xs font-semibold ${s.color}`}>{t(s.key)}</span>
        <span className="text-xs text-slate-600">· {t("coupon.matches", { count: coupon.coupon_legs.length })}</span>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {coupon.amount.toLocaleString("tr-TR")} GP @ {Number(coupon.total_odd).toFixed(2)}
        </span>
      </div>
      <div className="px-4 py-2.5 space-y-1.5">
        {coupon.coupon_legs.map((leg) => {
          const m = leg.matches;
          const score = m?.score1 != null ? ` · ${m.score1}–${m.score2}` : "";
          return (
            <div key={leg.id} className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold border ${
                leg.status === "won" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" :
                leg.status === "lost" ? "bg-rose-500/15 border-rose-500/40 text-rose-300" :
                "bg-slate-950 border-slate-700 text-slate-300"
              }`}>
                {PICK[leg.bet_type]}
              </span>
              <span className="text-slate-300 truncate">{m?.team1} – {m?.team2}{score}</span>
              <span className="ml-auto text-slate-500 tabular-nums">{Number(leg.odd).toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <div className={`px-4 py-2 text-xs font-semibold tabular-nums border-t border-slate-800/70 ${
        coupon.status === "won" ? "text-emerald-400" : coupon.status === "lost" ? "text-rose-400/70" : "text-slate-400"
      }`}>
        {coupon.status === "won" ? `+${payout.toLocaleString("tr-TR")} GP` :
         coupon.status === "lost" ? `-${coupon.amount.toLocaleString("tr-TR")} GP` :
         t("coupon.possibleWin", { amount: payout.toLocaleString() })}
      </div>
    </div>
  );
}
