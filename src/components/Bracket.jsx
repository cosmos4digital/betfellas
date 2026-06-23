import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Download, RotateCcw, Search } from "lucide-react";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { TEAM_EN, localizeTeam as teamName } from "../lib/teams";

// Slot ipucu: "A 2.si" / "A/B/C 3.sü" -> EN: "A 2nd" / "A/B/C 3rd"
const hintLabel = (label, lang) => {
  if (!lang?.startsWith("en")) return label;
  return label
    .replace(/ 1\.si$/, " 1st").replace(/ 2\.si$/, " 2nd")
    .replace(/ 3\.sü$/, " 3rd");
};

// DK2026 grupları (ekteki standings'e göre). Düzenlenebilir.
const GROUPS = {
  A: ["Meksika", "Güney Kore", "Çekya", "Güney Afrika"],
  B: ["Kanada", "Bosna Hersek", "İsviçre", "Katar"],
  C: ["Brezilya", "Fas", "Haiti", "İskoçya"],
  D: ["ABD", "Türkiye", "Avustralya", "Paraguay"],
  E: ["Almanya", "Curaçao", "Fildişi Sahili", "Ekvador"],
  F: ["Hollanda", "Japonya", "İsveç", "Tunus"],
  G: ["Belçika", "Mısır", "İran", "Yeni Zelanda"],
  H: ["İspanya", "Yeşil Burun", "Suudi Arabistan", "Uruguay"],
  I: ["Fransa", "Senegal", "Irak", "Norveç"],
  J: ["Arjantin", "Cezayir", "Avusturya", "Ürdün"],
  K: ["Portekiz", "Kongo DC", "Özbekistan", "Kolombiya"],
  L: ["İngiltere", "Hırvatistan", "Gana", "Panama"],
};

// Her Son 32 slotu için: hangi gruplardan takım gelebilir + etiket.
// "1"=birinci, "2"=ikinci, "3"=en iyi üçüncü (birden çok grup mümkün).
// slot 1..16 sol, 17..32 sağ kanat. Ekteki fikstür sırası.
const SLOTS = [
  { label: "A 2.si", groups: ["A"], rank: "2" }, { label: "B 2.si", groups: ["B"], rank: "2" },
  { label: "E 1.si", groups: ["E"], rank: "1" }, { label: "A/B/C/D/F 3.sü", groups: ["A","B","C","D","F"], rank: "3" },
  { label: "F 1.si", groups: ["F"], rank: "1" }, { label: "C 2.si", groups: ["C"], rank: "2" },
  { label: "C 1.si", groups: ["C"], rank: "1" }, { label: "F 2.si", groups: ["F"], rank: "2" },
  { label: "I 1.si", groups: ["I"], rank: "1" }, { label: "C/D/F/G/H 3.sü", groups: ["C","D","F","G","H"], rank: "3" },
  { label: "E 2.si", groups: ["E"], rank: "2" }, { label: "I 2.si", groups: ["I"], rank: "2" },
  { label: "A 1.si", groups: ["A"], rank: "1" }, { label: "C/E/F/H/I 3.sü", groups: ["C","E","F","H","I"], rank: "3" },
  { label: "L 1.si", groups: ["L"], rank: "1" }, { label: "E/H/I/J/K 3.sü", groups: ["E","H","I","J","K"], rank: "3" },
  { label: "D 1.si", groups: ["D"], rank: "1" }, { label: "B/E/F/I/J 3.sü", groups: ["B","E","F","I","J"], rank: "3" },
  { label: "G 1.si", groups: ["G"], rank: "1" }, { label: "A/E/H/I/J 3.sü", groups: ["A","E","H","I","J"], rank: "3" },
  { label: "K 2.si", groups: ["K"], rank: "2" }, { label: "L 2.si", groups: ["L"], rank: "2" },
  { label: "H 1.si", groups: ["H"], rank: "1" }, { label: "J 2.si", groups: ["J"], rank: "2" },
  { label: "B 1.si", groups: ["B"], rank: "1" }, { label: "E/F/G/I/J 3.sü", groups: ["E","F","G","I","J"], rank: "3" },
  { label: "J 1.si", groups: ["J"], rank: "1" }, { label: "H 2.si", groups: ["H"], rank: "2" },
  { label: "K 1.si", groups: ["K"], rank: "1" }, { label: "D/E/I/J/L 3.sü", groups: ["D","E","I","J","L"], rank: "3" },
  { label: "D 2.si", groups: ["D"], rank: "2" }, { label: "G 2.si", groups: ["G"], rank: "2" },
];

// Bir slota aday takımlar: ilgili grupların tüm takımları (kullanıcı grup
// içinden 1./2./3.'yü kendi seçer). Çok daha kısa, kurala uygun liste.
const candidatesFor = (slotIdx) => {
  const slot = SLOTS[slotIdx];
  const set = new Set();
  slot.groups.forEach((g) => GROUPS[g]?.forEach((t) => set.add(t)));
  return [...set];
};

const SIDES = {
  L: { off: 0,  rounds: [{ k: "32", n: 8 }, { k: "16", n: 4 }, { k: "qf", n: 2 }, { k: "sf", n: 1 }] },
  R: { off: 16, rounds: [{ k: "32", n: 8 }, { k: "16", n: 4 }, { k: "qf", n: 2 }, { k: "sf", n: 1 }] },
};

export default function Bracket({ onClose }) {
  const { t, i18n } = useTranslation();
  const { session, profile } = useApp();
  const [picks, setPicks] = useState({ slots: {} });
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const shotRef = useRef(null);

  useEffect(() => {
    supabase.from("bracket_picks").select("picks").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => { if (data?.picks?.slots) setPicks(data.picks); });
  }, [session.user.id]);

  const usedTeams = new Set(Object.values(picks.slots ?? {}));

  const pair = (side, ri, pos) => {
    if (ri === 0) {
      const off = SIDES[side].off;
      return [picks.slots?.[off + pos * 2 - 1] ?? null, picks.slots?.[off + pos * 2] ?? null];
    }
    const prevKey = side + SIDES[side].rounds[ri - 1].k;
    return [picks[prevKey]?.[pos * 2 - 1] ?? null, picks[prevKey]?.[pos * 2] ?? null];
  };

  const setSlot = (slotNo, team) => {
    setPicks((old) => {
      const next = structuredClone(old);
      next.slots = { ...(next.slots ?? {}) };
      const prevTeam = next.slots[slotNo];
      for (const [k, v] of Object.entries(next.slots)) if (v === team) delete next.slots[k];
      next.slots[slotNo] = team;
      if (prevTeam && prevTeam !== team) purgeTeam(next, prevTeam);
      return next;
    });
    setPicker(null);
  };

  const pickWinner = (side, ri, pos, team) => {
    if (!team) return;
    const key = side + SIDES[side].rounds[ri].k;
    setPicks((old) => {
      const next = structuredClone(old);
      const prev = next[key]?.[pos];
      next[key] = { ...(next[key] ?? {}), [pos]: team };
      if (prev && prev !== team) purgeWinner(next, side, ri, pos, prev);
      return next;
    });
  };

  const purgeWinner = (next, side, ri, pos, team) => {
    const rounds = SIDES[side].rounds;
    let p = pos;
    for (let r = ri + 1; r < rounds.length; r++) {
      p = Math.ceil(p / 2);
      const k = side + rounds[r].k;
      if (next[k]?.[p] === team) delete next[k][p];
    }
    if (next.F?.[1] === team) delete next.F[1];
  };

  const purgeTeam = (next, team) => {
    for (const side of ["L", "R"])
      for (const r of SIDES[side].rounds) {
        const k = side + r.k;
        if (!next[k]) continue;
        for (const [pos, v] of Object.entries(next[k])) if (v === team) delete next[k][pos];
      }
    if (next.F?.[1] === team) delete next.F[1];
  };

  const finalists = [picks.Lsf?.[1] ?? null, picks.Rsf?.[1] ?? null];
  const champion = picks.F?.[1] ?? null;
  const filled = Object.keys(picks.slots ?? {}).length;

  const save = async () => {
    setSaving(true);
    await supabase.from("bracket_picks").upsert({ user_id: session.user.id, picks, updated_at: new Date().toISOString() });
    setSaving(false);
  };

  const share = async () => {
    await save();
    const canvas = await html2canvas(shotRef.current, { backgroundColor: "#020617", scale: 2 });
    const link = document.createElement("a");
    link.download = `betfellas-${profile?.username}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const labels = { "32": t("bracket.r32"), "16": t("bracket.r16"), qf: t("bracket.qf"), sf: t("bracket.sf") };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto">
      <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 pt-safe">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-100 truncate">{t("bracket.title")}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPicks({ slots: {} })} className="text-slate-500 hover:text-slate-300 p-1.5"><RotateCcw size={16} /></button>
            <button onClick={share} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg transition"><Download size={14} /> {t("bracket.pngDownload")}</button>
            <button onClick={async () => { await save(); onClose(); }} className="text-slate-400 hover:text-slate-200 p-1.5"><X size={20} /></button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 px-4 pt-3">{t("bracket.hint")} ({filled}/32)</p>

      <div className="overflow-x-auto">
        <div ref={shotRef} className="p-4 min-w-[1120px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-100">BetFellas · 2026</span>
            <span className="text-xs text-slate-500">@{profile?.username}</span>
          </div>
          <div className="flex gap-2 items-stretch">
            <Side side="L" picks={picks} pair={pair} onOpenPicker={setPicker} onWin={pickWinner} labels={labels} t={t} lang={i18n.language} />
            <div className="w-44 flex flex-col justify-center shrink-0 px-1">
              <p className="text-[10px] font-semibold text-amber-400/90 tracking-wider text-center mb-2">{t("bracket.final").toLocaleUpperCase("en-US")}</p>
              <Tie a={finalists[0]} b={finalists[1]} selected={champion} accent lang={i18n.language}
                onPick={(team) => setPicks((old) => ({ ...structuredClone(old), F: { 1: team } }))} t={t} />
              <div className={`mt-3 rounded-xl border p-3 text-center ${champion ? "border-amber-400/50 bg-amber-400/10" : "border-slate-800 bg-slate-900"}`}>
                <p className="text-[9px] text-slate-500 tracking-widest mb-0.5">{t("bracket.champion").toLocaleUpperCase("en-US")}</p>
                <p className={`text-base font-bold ${champion ? "text-amber-300" : "text-slate-700"}`}>{champion ? teamName(champion, i18n.language) : "—"}</p>
              </div>
            </div>
            <Side side="R" picks={picks} pair={pair} onOpenPicker={setPicker} onWin={pickWinner} labels={labels} t={t} lang={i18n.language} mirror />
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition disabled:opacity-50">
          {saving ? t("bracket.saving") : t("bracket.save")}
        </button>
      </div>

      {picker != null && (
        <TeamPicker teams={candidatesFor(picker - 1)} used={usedTeams} current={picks.slots?.[picker]}
          hint={hintLabel(SLOTS[picker - 1].label, i18n.language)} onSelect={(tm) => setSlot(picker, tm)} onClose={() => setPicker(null)} t={t} lang={i18n.language} />
      )}
    </div>
  );
}

function Side({ side, picks, pair, onOpenPicker, onWin, labels, t, lang, mirror }) {
  const rounds = SIDES[side].rounds;
  const cols = rounds.map((round, ri) => (
    <div key={round.k} className="w-44 flex flex-col shrink-0">
      <p className="text-[10px] font-semibold text-slate-500 tracking-wider text-center mb-2">{labels[round.k].toLocaleUpperCase("en-US")}</p>
      <div className="flex-1 flex flex-col justify-around gap-1.5">
        {Array.from({ length: round.n }, (_, i) => i + 1).map((pos) => {
          const [a, b] = pair(side, ri, pos);
          const selKey = side + round.k;
          const off = SIDES[side].off;
          const slotA = off + pos * 2 - 1, slotB = off + pos * 2;
          return (
            <Tie key={pos} a={a} b={b} selected={picks[selKey]?.[pos]} t={t} lang={lang}
              onPick={(team) => onWin(side, ri, pos, team)} editable={ri === 0}
              hintA={ri === 0 ? hintLabel(SLOTS[slotA - 1].label, lang) : null} hintB={ri === 0 ? hintLabel(SLOTS[slotB - 1].label, lang) : null}
              onPickSlotA={ri === 0 ? () => onOpenPicker(slotA) : undefined}
              onPickSlotB={ri === 0 ? () => onOpenPicker(slotB) : undefined} />
          );
        })}
      </div>
    </div>
  ));
  return <div className="flex gap-2">{mirror ? cols.reverse() : cols}</div>;
}

function Tie({ a, b, selected, onPick, editable, accent, hintA, hintB, onPickSlotA, onPickSlotB, t, lang }) {
  const Row = ({ team, idx, hint, onPickSlot }) => {
    const isSel = selected === team && !!team;
    const winnerCls = accent ? "bg-amber-400/15 text-amber-300 font-semibold" : "bg-emerald-500/15 text-emerald-300 font-semibold";
    if (editable && !team) {
      return (
        <button onClick={onPickSlot} className={`w-full px-2.5 py-1.5 text-left ${idx === 0 ? "border-b border-slate-800" : ""}`}>
          <span className="text-[11px] text-emerald-400 font-medium">{t("bracket.selectTeam")}</span>
          {hint && <span className="block text-[9px] text-slate-600 leading-tight">{hint}</span>}
        </button>
      );
    }
    return (
      <div className={`flex items-stretch ${idx === 0 ? "border-b border-slate-800" : ""}`}>
        <button disabled={!team} onClick={() => team && onPick(team)}
          className={`flex-1 px-2.5 py-1.5 text-left text-[11px] truncate transition ${!team ? "text-slate-700" : isSel ? winnerCls : "text-slate-300 hover:bg-slate-800/60"}`}>
          {team ? teamName(team, lang) : "—"}
        </button>
        {editable && team && (<button onClick={onPickSlot} className="px-2 text-slate-600 hover:text-emerald-400 text-xs">✎</button>)}
      </div>
    );
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <Row team={a} idx={0} hint={hintA} onPickSlot={onPickSlotA} />
      <Row team={b} idx={1} hint={hintB} onPickSlot={onPickSlotB} />
    </div>
  );
}

function TeamPicker({ teams, used, current, hint, onSelect, onClose, t, lang }) {
  const [q, setQ] = useState("");
  const list = teams.filter((tm) => (tm + " " + (TEAM_EN[tm] ?? "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sheet-in max-h-[72vh] flex flex-col">
        <p className="text-xs text-slate-400 mb-2">{t("bracket.slotTeam")} <b className="text-emerald-300">{hint}</b></p>
        {teams.length > 6 && (
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 mb-3">
            <Search size={15} className="text-slate-500" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bracket.searchTeam")}
              className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {list.map((tm) => {
            const taken = used.has(tm) && tm !== current;
            return (
              <button key={tm} disabled={taken} onClick={() => onSelect(tm)}
                className={`px-3 py-2.5 rounded-lg text-sm text-left border transition ${
                  tm === current ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : taken ? "bg-slate-950 border-slate-900 text-slate-700"
                  : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600"}`}>
                {teamName(tm, lang)}{taken && <span className="text-[9px] text-slate-600 block">{t("bracket.placed")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
