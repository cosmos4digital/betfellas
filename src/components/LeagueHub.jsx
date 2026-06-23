import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Plus, KeyRound, ChevronRight, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

const MAX_SLOTS = 5;

export default function LeagueHub({ onEnter }) {
  const { t } = useTranslation();
  const { profile, memberships, refresh, selectLeague, signOut } = useApp();
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const slotsFull = memberships.length >= MAX_SLOTS;

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      const { data, error } =
        mode === "create"
          ? await supabase.rpc("create_league", { _name: value.trim() })
          : await supabase.rpc("join_league", { _invite_code: value.trim() });
      if (error) throw error;
      await refresh();
      setMode(null); setValue("");
      if (data?.id) { selectLeague(data.id); onEnter?.(); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enter = (id) => { selectLeague(id); onEnter?.(); };
  const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500";

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="max-w-sm mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{t("league.title")}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{profile?.username} · {memberships.length}/{MAX_SLOTS} slot</p>
          </div>
          <button onClick={signOut} title="Çıkış yap" className="text-slate-600 hover:text-slate-300 p-1">
            <LogOut size={18} />
          </button>
        </div>

        {memberships.length > 0 ? (
          <div className="space-y-2">
            {memberships.map((m) => (
              <button
                key={m.leagues.id}
                onClick={() => enter(m.leagues.id)}
                className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 text-left transition"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{m.leagues.name}</p>
                  <p className="text-xs text-emerald-400 font-semibold tabular-nums">{m.current_points.toLocaleString("tr-TR")} GP</p>
                </div>
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-300">{t("league.noLeagues")}</p>
            <p className="text-xs text-slate-500 mt-1">{t("league.noLeaguesHint")}</p>
          </div>
        )}

        {!mode ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { if (!slotsFull) { setMode("create"); setValue(""); setError(""); } }}
              disabled={slotsFull}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              <Plus size={16} /> {t("league.create")}
            </button>
            <button
              onClick={() => { if (!slotsFull) { setMode("join"); setValue(""); setError(""); } }}
              disabled={slotsFull}
              className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl py-3 text-sm font-semibold text-slate-200 transition disabled:opacity-40"
            >
              <KeyRound size={15} /> {t("league.join")}
            </button>
            {slotsFull && (
              <p className="col-span-2 text-xs text-amber-400/90 text-center">
                {t("league.slotsFull")}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">
              {mode === "create" ? t("league.leagueName") : t("league.inviteCode")}
            </p>
            <input
              autoFocus
              maxLength={mode === "join" ? 6 : 40}
              placeholder={mode === "create" ? t("league.leagueName") : t("league.inviteCode")}
              value={value}
              onChange={(e) => setValue(mode === "join" ? e.target.value.toUpperCase() : e.target.value)}
              className={`${inputCls} ${mode === "join" ? "text-center tracking-[0.4em] font-mono text-lg" : "text-sm"}`}
            />
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode(null)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 bg-slate-950 border border-slate-800">
                {t("league.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={busy || value.trim().length < 3}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
              >
                {busy ? "…" : mode === "create" ? t("league.createEnter") : t("league.joinBtn")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
