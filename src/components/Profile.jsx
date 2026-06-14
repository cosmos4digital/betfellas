import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Crown } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { frameRing } from "../lib/frames";
import Settings from "./Settings";
import CouponCard from "./CouponCard";

export default function Profile({ onGoHub }) {
  const { t } = useTranslation();
  const { session, profile, league, points } = useApp();
  const [coupons, setCoupons] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("coupons")
      .select("*, coupon_legs(*, matches(team1, team2, score1, score2))")
      .eq("user_id", session.user.id)
      .eq("league_id", league.id)
      .order("created_at", { ascending: false });
    setCoupons(data ?? []);
  }, [session.user.id, league.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`my-coupons:${session.user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "coupons", filter: `user_id=eq.${session.user.id}` },
        load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, session.user.id]);

  const pending = coupons.filter((c) => c.status === "pending");
  const past = coupons.filter((c) => c.status !== "pending");
  const won = past.filter((c) => c.status === "won").length;

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-100 ${frameRing(profile?.frame)}`}>
          {profile?.username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate flex items-center gap-1.5">{profile?.username}{profile?.is_vip && <Crown size={13} className="text-amber-400" />}</p>
          <p className="text-xs text-slate-500">
            {past.length > 0 ? t("profile.wonOf", { won, total: past.length }) : t("profile.noResultYet")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-emerald-400 tabular-nums leading-none">{points.toLocaleString("tr-TR")}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">GP</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="self-start -mt-1 -mr-1 p-1.5 text-slate-500 hover:text-slate-200 transition"
          title="Ayarlar"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onGoHub={onGoHub} />}

      <Section title={t("profile.openCoupons")} coupons={pending} empty={t("profile.noOpen")} />
      <Section title={t("profile.history")} coupons={past} empty={t("profile.noHistory")} />
    </div>
  );
}

function Section({ title, coupons, empty }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h3>
      {coupons.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">{empty}</p>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => <CouponCard key={c.id} coupon={c} />)}
        </div>
      )}
    </section>
  );
}
