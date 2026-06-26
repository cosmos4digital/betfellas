import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Receipt, BadgeCheck, HeartCrack, Flag } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import PlayerProfile from "./PlayerProfile";

const EMOJIS = ["🔥", "🤡", "💸", "😂", "⚽"];
const PICK = { home: "1", draw: "X", away: "2" };

export default function Feed() {
  const { t } = useTranslation();
  const { league, session } = useApp();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [openUser, setOpenUser] = useState(null);
  const [blocked, setBlocked] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const bottomRef = useRef(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("feed_messages")
      .select("*, profiles(username)")
      .eq("league_id", league.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data ?? []);
  }, [league.id]);

  // Engellediğim kullanıcılar — sunucu RLS'i zaten gizliyor ama
  // gerçek-zamanlı mesajlar yeniden yüklenene kadar istemcide de eleriz.
  const loadBlocks = useCallback(async () => {
    const { data } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", session.user.id);
    setBlocked(new Set((data ?? []).map((b) => b.blocked_id)));
  }, [session.user.id]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`feed:${league.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "feed_messages", filter: `league_id=eq.${league.id}` },
        load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [league.id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    await supabase.from("feed_messages").insert({
      league_id: league.id,
      user_id: session.user.id,
      type: "text",
      content_json: { text: content },
    });
  };

  // ÖNEMLİ: supabase sorguları "tembel"dir — await edilmeyen rpc() hiç
  // gönderilmez. Eski koddaki emoji bug'ının sebebi buydu.
  // Optimistic update: tepki anında görünür, sunucu onayı arkadan gelir.
  const react = async (messageId, emoji) => {
    const me = session.user.id;
    setMessages((old) => old.map((m) => {
      if (m.id !== messageId) return m;
      const r = structuredClone(m.reactions_json ?? {});
      const users = r[emoji] ?? [];
      r[emoji] = users.includes(me) ? users.filter((u) => u !== me) : [...users, me];
      return { ...m, reactions_json: r };
    }));
    const { error } = await supabase.rpc("toggle_reaction", { _message_id: messageId, _emoji: emoji });
    if (error) load(); // sunucu reddederse gerçek duruma dön
  };

  // Uygunsuz içeriği bildir (App Store Guideline 1.2)
  const report = async (messageId) => {
    if (!window.confirm(t("feed.reportConfirm"))) return;
    const { error } = await supabase.rpc("report_message", { _message_id: messageId });
    flash(error ? t("feed.reportError") : t("feed.reported"));
  };

  // PlayerProfile'dan biri engellenince: anında listeden düş + duvarı yenile
  const onBlocked = async (userId) => {
    setBlocked((s) => new Set(s).add(userId));
    setOpenUser(null);
    flash(t("profile.blocked"));
    load();
  };

  // Engel kalkınca: kullanıcının mesajları tekrar görünsün + duvarı yenile
  const onUnblocked = async (userId) => {
    setBlocked((s) => { const n = new Set(s); n.delete(userId); return n; });
    flash(t("profile.unblocked"));
    load();
  };

  const visible = messages.filter((m) => !m.user_id || !blocked.has(m.user_id));

  return (
    <div className="flex flex-col h-[calc(100vh-9.5rem)]">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {visible.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">{t("feed.empty")}</p>
            <p className="text-xs text-slate-600 mt-1">{t("feed.emptyHint")}</p>
          </div>
        )}
        {visible.map((m) => (
          <FeedCard key={m.id} msg={m} myId={session.user.id} onReact={react} onReport={report} onOpenUser={setOpenUser} t={t} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("feed.placeholder")}
          maxLength={280}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          disabled={!text.trim()}
          className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition"
        >
          <Send size={17} />
        </button>
      </form>

      {openUser && <PlayerProfile userId={openUser} onClose={() => setOpenUser(null)} onBlocked={onBlocked} onUnblocked={onUnblocked} />}
    </div>
  );
}

function FeedCard({ msg, myId, onReact, onReport, onOpenUser, t }) {
  const c = msg.content_json ?? {};
  const username = msg.profiles?.username ?? c.username ?? "Bilinmeyen";
  const time = new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  // Sadece başkasının yazdığı kullanıcı içeriği bildirilebilir (sistem kartları değil)
  const reportable = msg.user_id && msg.user_id !== myId && (msg.type === "text" || msg.type === "bet_share");

  const UserBtn = ({ children, className = "" }) =>
    msg.user_id ? (
      <button onClick={() => onOpenUser(msg.user_id)} className={`hover:underline ${className}`}>{children}</button>
    ) : <span className={className}>{children}</span>;

  return (
    <div className={`relative rounded-xl px-4 py-3 border ${
      msg.type === "bet_share" ? "bg-slate-900 border-emerald-500/25"
      : msg.type === "system_win" ? "bg-emerald-500/8 border-emerald-500/25"
      : msg.type === "system_loss" ? "bg-rose-500/5 border-rose-500/20"
      : "bg-slate-900 border-slate-800"
    }`}>
      {reportable && (
        <button
          onClick={() => onReport(msg.id)}
          title={t("feed.report")}
          aria-label={t("feed.report")}
          className="absolute top-2 right-2 text-slate-600 hover:text-rose-400 p-1 transition"
        >
          <Flag size={13} />
        </button>
      )}
      {msg.type === "text" && (
        <>
          <div className="flex items-baseline gap-2">
            <UserBtn className="text-sm font-semibold text-emerald-300">{username}</UserBtn>
            <span className="text-[10px] text-slate-600 tabular-nums">{time}</span>
          </div>
          <p className="text-sm text-slate-200 mt-0.5 break-words leading-relaxed">{c.text}</p>
        </>
      )}

      {msg.type === "bet_share" && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Receipt size={14} className="text-emerald-400 shrink-0" />
            <p className="text-sm text-slate-200">
              <UserBtn className="font-semibold text-emerald-300">{c.username}</UserBtn>
              {" "}{t("feed.madeCoupon")} —{" "}
              <span className="font-semibold text-slate-100 tabular-nums">{Number(c.amount).toLocaleString("tr-TR")} GP</span>
              <span className="text-slate-500"> @ </span>
              <span className="font-semibold text-slate-100 tabular-nums">{Number(c.total_odd ?? c.odd).toFixed(2)}</span>
            </p>
          </div>
          {/* yeni format: legs dizisi | eski format: tek maç */}
          <div className="space-y-1 pl-6">
            {(c.legs ?? [{ match: c.match, pick: c.bet_type, odd: c.odd }]).map((leg, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-4 h-4 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-300">
                  {PICK[leg.pick] ?? "?"}
                </span>
                <span className="truncate">{leg.match}</span>
                <span className="ml-auto tabular-nums text-slate-500">{Number(leg.odd).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg.type === "system_win" && (
        <div className="flex items-start gap-2">
          <BadgeCheck size={15} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-200">
            <UserBtn className="font-semibold text-emerald-300">{c.username}</UserBtn>
            {" "}{c.leg_count ? t("feed.wonCoupon", { count: c.leg_count }) : t("feed.wonSingle")}
            {" "}— <span className="font-bold text-emerald-400 tabular-nums">+{Number(c.payout).toLocaleString()} GP</span>
          </p>
        </div>
      )}

      {msg.type === "system_loss" && (
        <div className="flex items-start gap-2">
          <HeartCrack size={15} className="text-rose-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300">
            <UserBtn className="font-semibold text-slate-300">{c.username}</UserBtn>
            {" "}{t("feed.lostCoupon", { count: c.leg_count })}
            {" "}— <span className="font-semibold text-rose-400/80 tabular-nums">-{Number(c.amount).toLocaleString()} GP</span>
          </p>
        </div>
      )}

      {/* Reaksiyonlar */}
      <div className="flex gap-1.5 mt-2.5 flex-wrap">
        {EMOJIS.map((emoji) => {
          const users = msg.reactions_json?.[emoji] ?? [];
          const reacted = users.includes(myId);
          if (users.length === 0 && !reacted) {
            // boş olanlar: küçük, soluk; hover'da belirgin
            return (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="px-1.5 py-0.5 rounded-md text-sm opacity-30 hover:opacity-100 hover:bg-slate-800 transition active:scale-125"
              >
                {emoji}
              </button>
            );
          }
          return (
            <button
              key={emoji}
              onClick={() => onReact(msg.id, emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-sm border transition active:scale-110 ${
                reacted
                  ? "bg-emerald-500/15 border-emerald-500/40"
                  : "bg-slate-950 border-slate-800 hover:border-slate-600"
              }`}
            >
              <span>{emoji}</span>
              <span className="text-xs text-slate-400 font-medium tabular-nums">{users.length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
