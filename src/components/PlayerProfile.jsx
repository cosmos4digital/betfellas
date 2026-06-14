import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Crown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { frameRing } from "../lib/frames";
import CouponCard from "./CouponCard";

export default function PlayerProfile({ userId, onClose }) {
  const { t } = useTranslation();
  const { league } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: profile }, { data: member }, { data: coupons }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("league_members").select("current_points")
          .eq("league_id", league.id).eq("user_id", userId).single(),
        supabase.from("coupons")
          .select("*, coupon_legs(*, matches(team1, team2, score1, score2))")
          .eq("user_id", userId).eq("league_id", league.id)
          .order("created_at", { ascending: false }).limit(20),
      ]);
      setData({ profile, member, coupons: coupons ?? [] });
    })();
  }, [userId, league.id]);

  const won = data?.coupons.filter((c) => c.status === "won").length ?? 0;
  const lost = data?.coupons.filter((c) => c.status === "lost").length ?? 0;
  const pending = data?.coupons.filter((c) => c.status === "pending") ?? [];
  const past = data?.coupons.filter((c) => c.status !== "pending") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 sheet-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"><X size={20} /></button>

        {!data ? (
          <p className="text-slate-500 text-sm py-10 text-center">{t("matches.loading")}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-100 ${frameRing(data.profile?.frame)}`}>
                {data.profile?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-100 flex items-center gap-1.5">{data.profile?.username}{data.profile?.is_vip && <Crown size={13} className="text-amber-400" />}</p>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">
                  {data.member?.current_points?.toLocaleString("tr-TR")} GP
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <Stat label={t("coupon.won")} value={won} color="text-emerald-400" />
              <Stat label={t("coupon.lost")} value={lost} color="text-rose-400" />
              <Stat label={t("leaderboard.title")} value={won + lost > 0 ? `%${Math.round((won / (won + lost)) * 100)}` : "—"} color="text-slate-200" />
            </div>

            <Section title={t("profile.openCoupons")} coupons={pending} empty={t("profile.noOpen")} />
            <Section title={t("profile.history")} coupons={past} empty={t("profile.noHistory")} />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function Section({ title, coupons, empty }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h4>
      {coupons.length === 0 ? (
        <p className="text-sm text-slate-600">{empty}</p>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => <CouponCard key={c.id} coupon={c} />)}
        </div>
      )}
    </div>
  );
}
