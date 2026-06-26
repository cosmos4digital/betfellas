import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, User, Pencil, ArrowLeftRight, DoorOpen, LogOut, Info, Check, AlertTriangle, Trash2, Languages, FileText, Shield } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { FRAMES, frameRing } from "../lib/frames";
import { setLanguage } from "../locales/i18n";

export default function Settings({ onClose, onGoHub }) {
  const { t, i18n } = useTranslation();
  const changeLang = (lng) => setLanguage(lng);
  const { profile, league, memberships, refresh, signOut } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile?.username ?? "");
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(0); // 0: kapalı, 1: onay, 2: işlemde
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const saveName = async () => {
    setErr(""); setMsg("");
    const clean = name.trim();
    if (clean.length < 3 || clean.length > 20) { setErr(t("settings.nameRule")); return; }
    const { error } = await supabase.from("profiles").update({ username: clean }).eq("id", profile.id);
    if (error) { setErr(error.message.includes("duplicate") ? t("settings.nameTaken") : error.message); return; }
    setMsg(t("settings.nameUpdated"));
    setEditingName(false);
    refresh();
  };

  const clearFrame = async () => {
    await supabase.from("profiles").update({ frame: null }).eq("id", profile.id);
    setMsg(t("settings.saved"));
    refresh();
  };

  const deleteAccount = async () => {
    setDeleting(2); setErr("");
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) { setErr("Hesap silinemedi: " + error.message); setDeleting(0); return; }
    await signOut(); // oturumu kapat; auth kaydı zaten silindi
  };

  const leaveLeague = async () => {
    setErr("");
    const { error } = await supabase.rpc("leave_league", { _league_id: league.id });
    if (error) { setErr(error.message); return; }
    await refresh();
    onClose();
    onGoHub();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 sheet-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-slate-100">{t("settings.title")}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={20} /></button>
        </div>

        {msg && <p className="text-emerald-400 text-xs mb-3">{msg}</p>}
        {err && <p className="text-rose-400 text-xs mb-3">{err}</p>}

        {/* HESAP */}
        <SectionTitle>{t("settings.account")}</SectionTitle>
        <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 mb-5">
          <div className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white ${frameRing(profile?.frame)}`}>
              {profile?.username?.[0]?.toUpperCase()}
            </div>
            {editingName ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button onClick={saveName} className="text-emerald-400 px-2"><Check size={18} /></button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <p className="font-semibold text-slate-100 text-sm">{profile?.username}</p>
                  <p className="text-[11px] text-slate-500">{t("settings.usernameLabel")}</p>
                </div>
                <button onClick={() => { setEditingName(true); setName(profile?.username ?? ""); }} className="text-slate-400 hover:text-emerald-400 p-1">
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
          {profile?.frame && (
            <Row icon={User} label={t("settings.frameAttached", { name: FRAMES[profile.frame]?.name })} sub={t("settings.frameRemoveHint")}
                 action={<button onClick={clearFrame} className="text-xs text-slate-400 hover:text-rose-400">{t("settings.frameRemove")}</button>} />
          )}
        </div>

        {/* DİL */}
        <SectionTitle>{t("settings.language")}</SectionTitle>
        <div className="bg-slate-950 border border-slate-800 rounded-xl mb-5 p-3">
          <div className="flex items-center gap-2">
            <Languages size={18} className="text-slate-400 shrink-0" />
            <div className="flex gap-2 flex-1">
              {[["tr", t("settings.languageTr")], ["en", t("settings.languageEn")]].map(([code, label]) => (
                <button key={code} onClick={() => changeLang(code)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                    i18n.language?.startsWith(code)
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* LİG */}
        <SectionTitle>{t("settings.leagueSection")}</SectionTitle>
        <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 mb-5">
          <Row icon={ArrowLeftRight} label={t("settings.switchLeague")}
               sub={t("league.slots", { count: memberships.length })}
               action={<button onClick={() => { onClose(); onGoHub(); }} className="text-xs font-semibold text-emerald-400">{t("settings.leagueCenter")}</button>} />
          {!leaving ? (
            <Row icon={DoorOpen} label={t("settings.leaveLeague", { name: league?.name })}
                 sub={t("settings.leaveHint")}
                 action={<button onClick={() => setLeaving(true)} className="text-xs text-rose-400">{t("settings.leave")}</button>} />
          ) : (
            <div className="p-4 bg-rose-500/5">
              <p className="text-xs text-rose-300 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={13} /> {t("settings.leaveConfirm")}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setLeaving(false)} className="flex-1 py-2 rounded-lg text-xs text-slate-300 bg-slate-800 border border-slate-700">{t("league.cancel")}</button>
                <button onClick={leaveLeague} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-rose-600">{t("settings.leaveYes")}</button>
              </div>
            </div>
          )}
        </div>

        {/* UYGULAMA */}
        <SectionTitle>{t("settings.appSection")}</SectionTitle>
        <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 mb-5">
          <Row icon={Info} label="BetFellas" sub={t("settings.version")} />
          <Row icon={FileText} label={t("age.terms")}
               action={<a href="/terms.html" target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-400">›</a>} />
          <Row icon={Shield} label={t("age.privacy")}
               action={<a href="/gizlilik.html" target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-400">›</a>} />
          <Row icon={LogOut} label={t("settings.logout")} sub={profile?.username}
               action={<button onClick={signOut} className="text-xs font-semibold text-slate-300">{t("settings.logoutBtn")}</button>} />
        </div>

        {/* TEHLİKELİ BÖLGE */}
        <SectionTitle>{t("settings.dangerZone")}</SectionTitle>
        <div className="bg-slate-950 border border-rose-500/25 rounded-xl mb-5">
          {deleting === 0 ? (
            <Row icon={Trash2} label={t("settings.deleteAccount")}
                 sub={t("settings.deleteHint")}
                 action={<button onClick={() => setDeleting(1)} className="text-xs font-semibold text-rose-400">{t("settings.delete")}</button>} />
          ) : (
            <div className="p-4">
              <p className="text-xs text-rose-300 flex items-center gap-1.5 mb-3">
                <AlertTriangle size={13} /> {t("settings.deleteConfirm")}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleting(0)} disabled={deleting === 2}
                  className="flex-1 py-2 rounded-lg text-xs text-slate-300 bg-slate-900 border border-slate-800">{t("league.cancel")}</button>
                <button onClick={deleteAccount} disabled={deleting === 2}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50">
                  {deleting === 2 ? t("settings.deleting") : t("settings.deleteYes")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{children}</p>
);

function Row({ icon: Icon, label, sub, action }) {
  return (
    <div className="p-4 flex items-center gap-3">
      <Icon size={18} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-100">{label}</p>
        {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
