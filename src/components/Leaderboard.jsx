import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Copy, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { frameRing } from "../lib/frames";
import PlayerProfile from "./PlayerProfile";

export default function Leaderboard() {
  const { t } = useTranslation();
  const { league, session } = useApp();
  const [rows, setRows] = useState([]);
  const [openUser, setOpenUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("league_members")
      .select("user_id, current_points, profiles(username, frame, is_vip)")
      .eq("league_id", league.id)
      .order("current_points", { ascending: false });
    setRows(data ?? []);
  }, [league.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`leaderboard:${league.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "league_members", filter: `league_id=eq.${league.id}` },
        load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [league.id, load]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(league.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("leaderboard.title")}</h2>
        <button onClick={copyCode} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <span className="font-mono tracking-wider text-slate-300">{league.invite_code}</span>
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/70 overflow-hidden">
        {rows.map((row, i) => {
          const isMe = row.user_id === session.user.id;
          const isFirst = i === 0;
          return (
            <button
              key={row.user_id}
              onClick={() => setOpenUser(row.user_id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40 ${isMe ? "bg-emerald-500/5" : ""}`}
            >
              <span className={`w-6 text-center text-sm font-bold tabular-nums shrink-0 ${
                isFirst ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-slate-600"
              }`}>
                {i + 1}
              </span>
              <div className={`w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-200 shrink-0 ${frameRing(row.profiles?.frame)}`}>
                {row.profiles?.username?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate flex items-center gap-1.5">
                  {row.profiles?.username}
                  {row.profiles?.is_vip && <Crown size={11} className="text-amber-400" />}
                  {isFirst && <Crown size={13} className="text-amber-400 fill-amber-400" />}
                  {isMe && <span className="text-[10px] text-emerald-400 font-normal">{t("leaderboard.you")}</span>}
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">
                {row.current_points.toLocaleString("tr-TR")}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-600 text-center">{t("leaderboard.tapHint")}</p>

      {openUser && <PlayerProfile userId={openUser} onClose={() => setOpenUser(null)} />}
    </div>
  );
}
