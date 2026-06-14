import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const { t } = useTranslation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { username: form.username.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <img src="/logo-mark.png" alt="BetFellas" className="w-10 h-10 rounded-xl" />
            <span className="text-2xl font-bold tracking-tight text-slate-100">BetFellas</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t("auth.tagline")}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input required minLength={3} maxLength={20} placeholder={t("auth.username")}
              value={form.username} onChange={set("username")} className={inputCls} />
          )}
          <input required type="email" placeholder={t("auth.email")}
            value={form.email} onChange={set("email")} className={inputCls} />
          <input required type="password" minLength={6} placeholder={t("auth.password")}
            value={form.password} onChange={set("password")} className={inputCls} />
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <button disabled={busy}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition disabled:opacity-50">
            {busy ? t("auth.processing") : mode === "signup" ? t("auth.signup") : t("auth.login")}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 mt-5"
        >
          {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}
        </button>
      </div>
    </div>
  );
}
