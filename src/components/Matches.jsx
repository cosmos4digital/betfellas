import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Radio, GitBranch, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { localizeTeam } from "../lib/teams";
import Bracket from "./Bracket";
import AdSlot from "./AdSlot";

const PICK_LABEL = { home: "1", draw: "X", away: "2" };

export default function Matches() {
  const { t, i18n } = useTranslation();
  const { slip, toggleSlip } = useApp();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bracketOpen, setBracketOpen] = useState(false);

  const loadMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .in("status", ["upcoming", "live"])
      .order("match_time", { ascending: true });
    setMatches(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
    const channel = supabase
      .channel("matches-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadMatches)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  if (loading)
    return <p className="text-slate-500 text-sm text-center py-12">{t("matches.loading")}</p>;

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "upcoming" && new Date(m.match_time) > new Date());

  // Tarihe göre grupla
  const byDay = upcoming.reduce((acc, m) => {
    const key = new Date(m.match_time).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
    (acc[key] = acc[key] ?? []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Bracket girişi */}
      <button
        onClick={() => setBracketOpen(true)}
        className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 text-left hover:border-slate-700 transition"
      >
        <GitBranch size={18} className="text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">{t("matches.championPrediction")}</p>
          <p className="text-xs text-slate-500">{t("matches.bracketHint")}</p>
        </div>
        <ChevronRight size={16} className="text-slate-600" />
      </button>
      {bracketOpen && <Bracket onClose={() => setBracketOpen(false)} />}

      {/* Bracket altı / maçların üstü reklam alanı */}
      <AdSlot variant="inline" />

      {/* Canlı */}
      {live.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            {t("matches.live")}
          </h2>
          <div className="space-y-2">
            {live.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <Radio size={14} className="text-red-500 shrink-0" />
                <span className="flex-1 text-sm text-slate-200 text-right truncate">{localizeTeam(m.team1, i18n.language)}</span>
                <span className="text-base font-bold text-slate-100 tabular-nums bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-0.5">
                  {m.score1 ?? 0}–{m.score2 ?? 0}
                </span>
                <span className="flex-1 text-sm text-slate-200 truncate">{localizeTeam(m.team2, i18n.language)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Yaklaşan */}
      {upcoming.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">{t("matches.noMatches")}</p>
          <p className="text-xs text-slate-600 mt-1">{t("matches.noMatchesHint")}</p>
        </div>
      )}

      {Object.entries(byDay).map(([day, dayMatches], i) => (
        <div key={day} className="space-y-5">
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{day}</h2>
            <div className="space-y-2">
              {dayMatches.map((m) => (
                <MatchRow key={m.id} match={m} slip={slip} onPick={toggleSlip} lang={i18n.language} />
              ))}
            </div>
          </section>
          {/* Her ikinci gün grubundan sonra araya reklam sıkıştır */}
          {i % 2 === 1 && i < Object.keys(byDay).length - 1 && <AdSlot variant="inline" />}
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match, slip, onPick, lang }) {
  const time = new Date(match.match_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const selected = slip.find((s) => s.match.id === match.id)?.bet_type;
  const odds = [
    { type: "home", odd: match.odds_home },
    { type: "draw", odd: match.odds_draw },
    { type: "away", odd: match.odds_away },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-slate-500 tabular-nums w-11 shrink-0">{time}</span>
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-medium text-slate-100 truncate">{localizeTeam(match.team1, lang)}</p>
          <p className="font-medium text-slate-100 truncate">{localizeTeam(match.team2, lang)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {odds.map(({ type, odd }) => {
          const isSel = selected === type;
          return (
            <button
              key={type}
              onClick={() => onPick(match, type, odd)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition active:scale-[0.98] ${
                isSel
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600"
              }`}
            >
              <span className={`text-xs font-medium ${isSel ? "text-emerald-200" : "text-slate-500"}`}>
                {PICK_LABEL[type]}
              </span>
              <span className="font-semibold tabular-nums">{Number(odd).toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
