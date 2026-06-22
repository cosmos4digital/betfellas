import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Sparkles, Check, Crown, ShieldCheck } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { FRAMES, frameRing } from "../lib/frames";
import { showRewarded } from "../lib/ads";

const DAILY_AD_LIMIT = 5;
const AD_REWARD = 50;

export default function Store() {
  const { t } = useTranslation();
  const { league, session, profile, points, refresh } = useApp();
  const isVip = profile?.is_vip;
  const [adsToday, setAdsToday] = useState(0);
  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [toast, setToast] = useState("");

  const loadAds = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("ad_views")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("league_id", league.id)
      .gte("created_at", start.toISOString());
    setAdsToday(count ?? 0);
  };

  useEffect(() => { loadAds(); }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // --- Reklam izleme akışı ---
  // Şimdilik 5 sn'lik simülasyon. Gerçek ödüllü reklam (AdSense H5 / AdMob)
  // entegre edilince SDK'nın "onRewarded" callback'inde claim çağrılır.
  // NOT: claim, state updater İÇİNDE çağrılmaz — React StrictMode updater'ları
  // iki kez çalıştırdığı için ödül çift yazılıyordu. claimedRef bunu kilitler.
  const claimedRef = useRef(false);

  const watchAd = async () => {
    if (adsToday >= DAILY_AD_LIMIT || watching) return;

    // Native (iOS): gerçek AdMob ödüllü reklamı
    if (Capacitor.isNativePlatform()) {
      setWatching(true);
      const ok = await showRewarded();
      setWatching(false);
      if (ok) claim();
      else flash("Reklam yüklenemedi, tekrar dene");
      return;
    }

    // Web: 5 sn'lik simülasyon fallback
    claimedRef.current = false;
    setWatching(true);
    setCountdown(5);
  };

  useEffect(() => {
    if (!watching) return;
    if (countdown <= 0) {
      if (!claimedRef.current) {
        claimedRef.current = true;
        claim();
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [watching, countdown]);

  const claim = async () => {
    const { data, error } = await supabase.rpc("claim_ad_reward", { _league_id: league.id });
    setWatching(false);
    if (error) { flash(error.message); return; }
    flash(`+${data} GP eklendi`);
    loadAds();
    refresh();
  };

  const toggleVip = async () => {
    const { error } = await supabase.rpc("set_vip", { _on: !isVip });
    if (error) { flash(error.message); return; }
    flash(isVip ? "VIP kapatıldı" : "VIP etkinleştirildi");
    refresh();
  };

  const buyFrame = async (key) => {
    const { error } = await supabase.rpc("buy_frame", { _league_id: league.id, _frame: key });
    if (error) { flash(error.message); return; }
    flash(`${FRAMES[key].name} takıldı`);
    refresh();
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Günlük ödül */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t("store.dailyReward")}</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Clapperboard size={20} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-100 text-sm">{t("store.watchAd", { reward: AD_REWARD })}</p>
              <p className="text-[11px] text-slate-500">
                {t("store.adQuota", { limit: DAILY_AD_LIMIT, today: adsToday })}
              </p>
            </div>
          </div>

          {/* Hak göstergesi */}
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: DAILY_AD_LIMIT }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < adsToday ? "bg-emerald-500" : "bg-slate-700"}`} />
            ))}
          </div>

          <button
            onClick={watchAd}
            disabled={isVip || adsToday >= DAILY_AD_LIMIT || watching}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition disabled:opacity-40"
          >
            {isVip ? t("store.vipNoAd") :
             watching ? `${t("store.adPlaying")} ${countdown}` :
             adsToday >= DAILY_AD_LIMIT ? t("store.adDone") :
             t("store.watchBtn")}
          </button>
        </div>
      </div>

      {/* Çerçeveler */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t("store.frames")}</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          {t("store.framesDesc")}
        </p>
        <div className="space-y-3">
          {Object.entries(FRAMES).map(([key, f]) => {
            const owned = profile?.frame === key;
            const affordable = points >= f.price;
            return (
              <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-white ${frameRing(key)}`}>
                  {profile?.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                    {f.name} {owned && <Check size={14} className="text-emerald-400" />}
                  </p>
                  <p className="text-[11px] text-slate-500">{f.desc}</p>
                </div>
                <button
                  onClick={() => buyFrame(key)}
                  disabled={owned || !affordable}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                    owned
                      ? "bg-slate-900 text-emerald-400 border border-emerald-500/30"
                      : affordable
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-slate-900 text-slate-600 border border-slate-700"
                  }`}
                >
                  {owned ? t("store.owned") : (
                    <span className="flex items-center gap-1"><Sparkles size={12} /> {f.price.toLocaleString("tr-TR")} GP</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-600 text-center pb-2">
        Kupa Guru tamamen eğlence amaçlıdır. GP gerçek para değildir, satın alınamaz ve paraya çevrilemez.
      </p>
    </div>
  );
}
