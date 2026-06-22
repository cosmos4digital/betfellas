import { useState, useEffect } from "react";
import { LayoutGrid, Trophy, MessagesSquare, Store as StoreIcon, User, ChevronDown, Check, Plus, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppProvider, useApp } from "./context/AppContext";
import AgeGate from "./components/AgeGate";
import Auth from "./components/Auth";
import LeagueHub from "./components/LeagueHub";
import Matches from "./components/Matches";
import Leaderboard from "./components/Leaderboard";
import Feed from "./components/Feed";
import Store from "./components/Store";
import Profile from "./components/Profile";
import BetSlip from "./components/BetSlip";
import { initAds } from "./lib/ads";

const TABS = [
  { id: "matches", key: "nav.matches", icon: LayoutGrid },
  { id: "leaderboard", key: "nav.leaderboard", icon: Trophy },
  { id: "feed", key: "nav.feed", icon: MessagesSquare },
  { id: "store", key: "nav.store", icon: StoreIcon },
  { id: "profile", key: "nav.profile", icon: User },
];

function Shell() {
  const { t } = useTranslation();
  const { session, league, memberships, points, loading, selectLeague, slip, totalOdd } = useApp();
  const [tab, setTab] = useState("matches");
  const [inHub, setInHub] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [ageOk, setAgeOk] = useState(() => localStorage.getItem("bf_age_ok") === "1");

  // AdMob: SDK'yı başlat ve alt banner'ı göster (yalnızca native/iOS)
  useEffect(() => { initAds(); }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  if (!ageOk) return <AgeGate onConfirm={() => setAgeOk(true)} />;
  if (!session) return <Auth />;
  if (!league || inHub) return <LeagueHub onEnter={() => setInHub(false)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur border-b border-slate-800/80 pt-safe">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <img src="/logo-mark.png" alt="BetFellas" className="w-7 h-7 rounded-md" />
            <span className="text-[15px] font-bold tracking-tight text-slate-100">BetFellas</span>
          </div>

          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-1.5 min-w-0 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 transition"
          >
            <span className="truncate max-w-[120px] font-medium">{league.name}</span>
            <ChevronDown size={13} className="text-slate-500 shrink-0" />
          </button>

          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-400 tabular-nums leading-none">{points.toLocaleString("tr-TR")}</p>
            <p className="text-[10px] text-slate-500 leading-tight">GP</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 pb-[calc(7rem+var(--ad-banner-h,0px))]">
        {tab === "matches" && <Matches />}
        {tab === "leaderboard" && <Leaderboard />}
        {tab === "feed" && <Feed />}
        {tab === "store" && <Store />}
        {tab === "profile" && <Profile onGoHub={() => setInHub(true)} />}
      </main>

      {/* Kupon sepeti barı */}
      {slip.length > 0 && (
        <button
          onClick={() => setSlipOpen(true)}
          className="fixed bottom-safe inset-x-0 z-40"
        >
          <div className="max-w-lg mx-auto px-3 pb-1.5">
            <div className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 transition rounded-xl px-4 py-3 shadow-lg shadow-emerald-950/50">
              <Receipt size={18} className="text-emerald-200" />
              <span className="text-sm font-semibold text-white">{t("slip.coupon")} · {t("slip.matchCount", { count: slip.length })}</span>
              <span className="ml-auto text-sm font-bold text-white tabular-nums">{totalOdd.toFixed(2)}</span>
              <span className="text-[11px] text-emerald-200">{t("slip.odd")}</span>
            </div>
          </div>
        </button>
      )}
      {slipOpen && <BetSlip onClose={() => setSlipOpen(false)} />}

      <nav className="fixed bottom-[var(--ad-banner-h,0px)] inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800/80 pb-safe">
        <div className="max-w-lg mx-auto grid grid-cols-5 px-1 pt-1">
          {TABS.map(({ id, key, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0 h-0.5 w-8 rounded-full bg-emerald-400 transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                {t(key)}
              </button>
            );
          })}
        </div>
      </nav>

      {switcherOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSwitcherOpen(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 sheet-in">
            <h3 className="font-semibold text-slate-100 mb-3">{t("league.myLeagues")}</h3>
            <div className="space-y-2 mb-3">
              {memberships.map((m) => {
                const active = m.leagues.id === league.id;
                return (
                  <button
                    key={m.leagues.id}
                    onClick={() => { selectLeague(m.leagues.id); setSwitcherOpen(false); }}
                    className={`w-full flex items-center gap-3 rounded-xl p-3.5 border text-left transition ${
                      active ? "bg-emerald-500/10 border-emerald-500/40" : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{m.leagues.name}</p>
                      <p className="text-xs text-emerald-400 font-semibold tabular-nums">{m.current_points.toLocaleString("tr-TR")} GP</p>
                    </div>
                    {active && <Check size={16} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setSwitcherOpen(false); setInHub(true); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-950 border border-slate-800 hover:border-slate-700"
            >
              <Plus size={14} /> {t("league.createOrJoin")} · {memberships.length}/5
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
