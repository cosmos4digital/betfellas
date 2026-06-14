// supabase/functions/sync-matches/index.ts  (v2 - ücretsiz API ikilisi)
// Fikstür / canlı skor / sonuç : football-data.org  (ücretsiz, DK dahil)
// Gerçek 1X2 oranları          : the-odds-api.com   (ücretsiz 500 kredi/ay)
//
// Gerekli secret'lar (Dashboard > Edge Functions > Secrets):
//   FOOTBALLDATA_KEY -> https://www.football-data.org/client/register
//   ODDSAPI_KEY      -> https://the-odds-api.com
//
// Oran kotasını korumak için oranlar her çağrıda DEĞİL, 3 saatte bir çekilir
// (ya da URL'e ?odds=1 ekleyerek elle tetiklenir).

import { createClient } from "npm:@supabase/supabase-js@2";

const FD_KEY = Deno.env.get("FOOTBALLDATA_KEY")!;
const ODDS_KEY = Deno.env.get("ODDSAPI_KEY")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ODDS_SPORT = "soccer_fifa_world_cup"; // The Odds API sport key

// ---- takım adı eşleme (iki API farklı isim kullanabiliyor) ----
const ALIASES: Record<string, string> = {
  "korea republic": "south korea",
  "ir iran": "iran",
  "usa": "united states",
  "côte d'ivoire": "ivory coast",
  "curaçao": "curacao",
  "türkiye": "turkey",
  "czechia": "czech republic",
};
const norm = (s: string) => {
  let n = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return ALIASES[n] ?? n;
};

type Odds = { home: number; draw: number; away: number };

async function fetchOddsMap(): Promise<Map<string, Odds>> {
  const map = new Map<string, Odds>();
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/${ODDS_SPORT}/odds?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`,
  );
  if (!res.ok) { console.error("OddsAPI:", res.status, await res.text()); return map; }
  const events = await res.json();
  for (const ev of events) {
    const book = ev.bookmakers?.[0];
    const market = book?.markets?.find((m: any) => m.key === "h2h");
    if (!market) continue;
    const get = (name: string) =>
      market.outcomes.find((o: any) => norm(o.name) === norm(name))?.price;
    const home = get(ev.home_team);
    const away = get(ev.away_team);
    const draw = market.outcomes.find((o: any) => o.name === "Draw")?.price;
    if (home && draw && away) {
      // anahtar: "ev|deplasman" (normalize)
      map.set(`${norm(ev.home_team)}|${norm(ev.away_team)}`, { home, draw, away });
    }
  }
  return map;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const now = new Date();
  // Oranları 3 saatte bir (cron */5'te saat başına denk gelen turda) veya ?odds=1 ile çek
  const wantOdds = url.searchParams.get("odds") === "1" ||
    (now.getUTCHours() % 3 === 0 && now.getUTCMinutes() < 5);

  // ---- 1) DK fikstürü: dün -> +14 gün ----
  const day = 86_400_000;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fdRes = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${fmt(new Date(Date.now() - day))}&dateTo=${fmt(new Date(Date.now() + 14 * day))}`,
    { headers: { "X-Auth-Token": FD_KEY } },
  );
  if (!fdRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: `football-data ${fdRes.status}: ${await fdRes.text()}` }), { status: 500 });
  }
  const { matches = [] } = await fdRes.json();

  const oddsMap = wantOdds ? await fetchOddsMap() : new Map<string, Odds>();

  let created = 0, updated = 0, settled = 0, oddsApplied = 0;

  for (const m of matches) {
    const status =
      ["FINISHED", "AWARDED"].includes(m.status) ? "finished" :
      ["IN_PLAY", "PAUSED"].includes(m.status) ? "live" : "upcoming";

    const team1 = m.homeTeam?.name ?? m.homeTeam?.shortName ?? "TBD";
    const team2 = m.awayTeam?.name ?? m.awayTeam?.shortName ?? "TBD";

    const row: Record<string, unknown> = {
      external_id: String(m.id),
      team1, team2,
      match_time: m.utcDate,
      status,
      score1: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      score2: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
    };

    const odds = oddsMap.get(`${norm(team1)}|${norm(team2)}`);

    const { data: existing } = await supabase
      .from("matches")
      .select("id, status, odds_home, odds_draw, odds_away")
      .eq("external_id", row.external_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from("matches").insert({
        ...row,
        odds_home: odds?.home ?? 2.0,
        odds_draw: odds?.draw ?? 3.2,
        odds_away: odds?.away ?? 3.5,
      });
      created++;
      if (odds) oddsApplied++;
    } else {
      // Henüz başlamamış maçların oranları taze tutulur; kuponlar zaten
      // yapıldıkları andaki oranla kilitli (bets.odd).
      if (odds && status === "upcoming") {
        Object.assign(row, { odds_home: odds.home, odds_draw: odds.draw, odds_away: odds.away });
        oddsApplied++;
      }
      await supabase.from("matches").update(row).eq("id", existing.id);
      updated++;

      if (status === "finished" && existing.status !== "finished") {
        const w = m.score?.winner; // HOME_TEAM | AWAY_TEAM | DRAW
        const result = w === "HOME_TEAM" ? "home" : w === "AWAY_TEAM" ? "away" : "draw";
        const { error } = await supabase.rpc("settle_match", {
          _match_id: existing.id, _result: result,
        });
        if (!error) settled++;
        else console.error("settle hatası:", error.message);
      }
    }
  }

  // Geç kalmış / kaçmış kuponları her turda toparla (idempotent güvenlik ağı)
  await supabase.rpc("settle_pending");

  return new Response(
    JSON.stringify({ ok: true, fixtures: matches.length, created, updated, settled, oddsApplied, oddsFetched: wantOdds }),
    { headers: { "content-type": "application/json" } },
  );
});
