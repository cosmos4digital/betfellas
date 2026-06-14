import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeLeagueId, setActiveLeagueId] = useState(
    () => localStorage.getItem("kg_active_league") || null
  );
  const [slip, setSlip] = useState([]); // [{match:{id,team1,team2}, bet_type, odd}]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadUserData = useCallback(async () => {
    if (!session?.user) { setProfile(null); setMemberships([]); return; }
    const [{ data: prof }, { data: mems }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("league_members")
        .select("current_points, joined_at, leagues(*)")
        .eq("user_id", session.user.id)
        .order("joined_at", { ascending: true }),
    ]);
    setProfile(prof);
    setMemberships(mems ?? []);
  }, [session]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const league =
    memberships.find((m) => m.leagues.id === activeLeagueId)?.leagues ??
    memberships[0]?.leagues ?? null;
  const points =
    memberships.find((m) => m.leagues.id === league?.id)?.current_points ?? 0;

  const selectLeague = (id) => {
    setActiveLeagueId(id);
    localStorage.setItem("kg_active_league", id);
  };

  useEffect(() => {
    if (!league || !session?.user) return;
    const channel = supabase
      .channel(`balance:${league.id}:${session.user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "league_members", filter: `user_id=eq.${session.user.id}` },
        () => loadUserData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [league?.id, session, loadUserData]);

  // --- Kupon sepeti ---
  // Aynı maçtan ikinci kez seçilirse: aynı tahminse kaldır, farklıysa değiştir.
  const toggleSlip = (match, bet_type, odd) => {
    setSlip((old) => {
      const existing = old.find((s) => s.match.id === match.id);
      if (existing?.bet_type === bet_type)
        return old.filter((s) => s.match.id !== match.id);
      const rest = old.filter((s) => s.match.id !== match.id);
      if (rest.length >= 10) return old; // üst sınır
      return [...rest, { match: { id: match.id, team1: match.team1, team2: match.team2 }, bet_type, odd: Number(odd) }];
    });
  };
  const removeFromSlip = (matchId) => setSlip((old) => old.filter((s) => s.match.id !== matchId));
  const clearSlip = () => setSlip([]);
  const totalOdd = slip.reduce((acc, s) => acc * s.odd, 1);

  const signOut = async () => {
    localStorage.removeItem("kg_active_league");
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{
      session, profile, memberships, league, points, loading,
      slip, toggleSlip, removeFromSlip, clearSlip, totalOdd,
      selectLeague, refresh: loadUserData, signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
}
