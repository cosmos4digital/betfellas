-- ============================================================
-- KUPA GURU - Supabase Kurulum SQL'i
-- Dünya Kupası 2026 - Arkadaşlar Arası Sanal Tahmin Oyunu
-- Supabase SQL Editor'de tek seferde çalıştırın.
-- ============================================================

-- ---------- 1. TABLOLAR ----------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null check (char_length(username) between 3 and 20),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table public.leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 40),
  invite_code char(6) unique not null,
  creator_id  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.league_members (
  league_id      uuid not null references public.leagues(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  current_points integer not null default 1000 check (current_points >= 0),
  joined_at      timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  team1      text not null,
  team2      text not null,
  match_time timestamptz not null,
  odds_home  numeric(5,2) not null check (odds_home >= 1),
  odds_draw  numeric(5,2) not null check (odds_draw >= 1),
  odds_away  numeric(5,2) not null check (odds_away >= 1),
  status     text not null default 'upcoming' check (status in ('upcoming','live','finished')),
  result     text check (result in ('home','draw','away'))
);

create table public.bets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  match_id   uuid not null references public.matches(id) on delete cascade,
  bet_type   text not null check (bet_type in ('home','draw','away')),
  amount     integer not null check (amount > 0),
  odd        numeric(5,2) not null,
  status     text not null default 'pending' check (status in ('pending','won','lost')),
  created_at timestamptz not null default now(),
  unique (user_id, league_id, match_id) -- aynı maça aynı ligde tek kupon
);

create table public.feed_messages (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete set null,
  type           text not null check (type in ('text','bet_share','system_win')),
  content_json   jsonb not null default '{}'::jsonb,
  reactions_json jsonb not null default '{}'::jsonb, -- {"🔥": ["uuid1"], "🤡": [...], "💸": [...]}
  created_at     timestamptz not null default now()
);

create index idx_bets_user on public.bets(user_id, created_at desc);
create index idx_bets_match on public.bets(match_id) where status = 'pending';
create index idx_feed_league on public.feed_messages(league_id, created_at desc);
create index idx_matches_time on public.matches(match_time);

-- ---------- 2. YENİ KULLANICI -> OTOMATİK PROFİL ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'guru_' || left(new.id::text, 6)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3. YARDIMCI: ÜYELİK KONTROLÜ (RLS recursion'ı önler) ----------

create or replace function public.is_league_member(_league_id uuid, _user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = _league_id and user_id = _user_id
  );
$$;

-- ---------- 4. RPC: LİG KUR (1000 GP ile başlar) ----------

create or replace function public.create_league(_name text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  _code char(6);
  _league public.leagues;
begin
  loop
    _code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from public.leagues where invite_code = _code);
  end loop;

  insert into public.leagues (name, invite_code, creator_id)
  values (_name, _code, auth.uid())
  returning * into _league;

  insert into public.league_members (league_id, user_id, current_points)
  values (_league.id, auth.uid(), 1000);

  return _league;
end; $$;

-- ---------- 5. RPC: DAVET KODUYLA LİGE KATIL ----------

create or replace function public.join_league(_invite_code text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  _league public.leagues;
begin
  select * into _league from public.leagues where invite_code = upper(_invite_code);
  if _league.id is null then
    raise exception 'Geçersiz davet kodu';
  end if;

  insert into public.league_members (league_id, user_id, current_points)
  values (_league.id, auth.uid(), 1000)
  on conflict do nothing;

  return _league;
end; $$;

-- ---------- 6. RPC: KUPON OYNA (atomik: bakiye düş + bet + feed kartı) ----------

create or replace function public.place_bet(
  _league_id uuid, _match_id uuid, _bet_type text, _amount integer
) returns public.bets language plpgsql security definer set search_path = public as $$
declare
  _match public.matches;
  _odd numeric(5,2);
  _bet public.bets;
  _username text;
begin
  if _amount < 10 then raise exception 'Minimum 10 GP yatırmalısın'; end if;

  select * into _match from public.matches where id = _match_id for update;
  if _match.id is null then raise exception 'Maç bulunamadı'; end if;
  if _match.status <> 'upcoming' or _match.match_time <= now() then
    raise exception 'Bu maça tahmin kapandı';
  end if;

  _odd := case _bet_type
            when 'home' then _match.odds_home
            when 'draw' then _match.odds_draw
            when 'away' then _match.odds_away
            else null end;
  if _odd is null then raise exception 'Geçersiz tahmin tipi'; end if;

  -- Bakiyeyi atomik düş (yetersizse 0 satır etkilenir)
  update public.league_members
     set current_points = current_points - _amount
   where league_id = _league_id and user_id = auth.uid()
     and current_points >= _amount;
  if not found then raise exception 'Yetersiz GP bakiyesi'; end if;

  insert into public.bets (user_id, league_id, match_id, bet_type, amount, odd)
  values (auth.uid(), _league_id, _match_id, _bet_type, _amount, _odd)
  returning * into _bet;

  select username into _username from public.profiles where id = auth.uid();

  -- Atışma Duvarı'na otomatik kart
  insert into public.feed_messages (league_id, user_id, type, content_json)
  values (_league_id, auth.uid(), 'bet_share', jsonb_build_object(
    'username', _username,
    'match', _match.team1 || ' - ' || _match.team2,
    'bet_type', _bet_type,
    'amount', _amount,
    'odd', _odd
  ));

  return _bet;
end; $$;

-- ---------- 7. RPC: EMOJİ REAKSİYON (toggle) ----------

create or replace function public.toggle_reaction(_message_id uuid, _emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _msg public.feed_messages;
  _users jsonb;
begin
  if _emoji not in ('🔥','🤡','💸') then raise exception 'Geçersiz emoji'; end if;

  select * into _msg from public.feed_messages where id = _message_id for update;
  if not public.is_league_member(_msg.league_id, auth.uid()) then
    raise exception 'Bu ligin üyesi değilsin';
  end if;

  _users := coalesce(_msg.reactions_json->_emoji, '[]'::jsonb);
  if _users ? auth.uid()::text then
    _users := (select coalesce(jsonb_agg(u), '[]'::jsonb)
               from jsonb_array_elements_text(_users) u where u <> auth.uid()::text);
  else
    _users := _users || to_jsonb(auth.uid()::text);
  end if;

  update public.feed_messages
     set reactions_json = jsonb_set(reactions_json, array[_emoji], _users)
   where id = _message_id;
end; $$;

-- ---------- 8. RPC: MAÇ SONUÇLANDIR (sadece admin / service_role) ----------
-- Tahmin tutarsa: floor(amount * odd) GP eklenir. Yatarsa: GP zaten düşülmüştü.

create or replace function public.settle_match(_match_id uuid, _result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _bet record;
  _payout integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Sadece yönetici sonuçlandırabilir';
  end if;
  if _result not in ('home','draw','away') then raise exception 'Geçersiz sonuç'; end if;

  update public.matches set status = 'finished', result = _result where id = _match_id;

  for _bet in
    select b.*, p.username, m.team1, m.team2
      from public.bets b
      join public.profiles p on p.id = b.user_id
      join public.matches m on m.id = b.match_id
     where b.match_id = _match_id and b.status = 'pending'
  loop
    if _bet.bet_type = _result then
      _payout := floor(_bet.amount * _bet.odd);
      update public.bets set status = 'won' where id = _bet.id;
      update public.league_members
         set current_points = current_points + _payout
       where league_id = _bet.league_id and user_id = _bet.user_id;

      insert into public.feed_messages (league_id, user_id, type, content_json)
      values (_bet.league_id, _bet.user_id, 'system_win', jsonb_build_object(
        'username', _bet.username,
        'match', _bet.team1 || ' - ' || _bet.team2,
        'payout', _payout
      ));
    else
      update public.bets set status = 'lost' where id = _bet.id;
    end if;
  end loop;
end; $$;

-- ---------- 9. ROW LEVEL SECURITY ----------

alter table public.profiles       enable row level security;
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.matches        enable row level security;
alter table public.bets           enable row level security;
alter table public.feed_messages  enable row level security;

-- profiles: herkes okur (sıralama/feed için), sadece sahibi günceller
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- leagues: sadece üyeler görür (katılım join_league RPC ile)
create policy "leagues_select_member" on public.leagues
  for select to authenticated using (public.is_league_member(id, auth.uid()));

-- league_members: aynı ligin üyeleri birbirini görür (leaderboard)
create policy "members_select_same_league" on public.league_members
  for select to authenticated using (public.is_league_member(league_id, auth.uid()));

-- matches: tüm giriş yapanlar okur; yazma sadece service_role (panel/cron)
create policy "matches_select_all" on public.matches
  for select to authenticated using (true);

-- bets: kendi kuponun + aynı ligdeki arkadaşlarının kuponları görünür
create policy "bets_select_league" on public.bets
  for select to authenticated
  using (user_id = auth.uid() or public.is_league_member(league_id, auth.uid()));

-- feed_messages: üyeler okur; üyeler sadece 'text' tipinde mesaj yazar
-- (bet_share ve system_win sadece RPC'ler üzerinden üretilir)
create policy "feed_select_member" on public.feed_messages
  for select to authenticated using (public.is_league_member(league_id, auth.uid()));
create policy "feed_insert_text_member" on public.feed_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and type = 'text'
    and public.is_league_member(league_id, auth.uid())
  );

-- ---------- 10. REALTIME ----------

alter publication supabase_realtime add table public.feed_messages;
alter publication supabase_realtime add table public.league_members;
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.matches;

-- ---------- 11. ÖRNEK DK2026 MAÇLARI (test için) ----------

insert into public.matches (team1, team2, match_time, odds_home, odds_draw, odds_away) values
  ('Türkiye', 'Brezilya',  now() + interval '6 hours',  4.50, 3.80, 1.70),
  ('Arjantin', 'Fransa',   now() + interval '1 day',    2.40, 3.20, 2.90),
  ('İngiltere', 'Almanya', now() + interval '2 days',   2.10, 3.40, 3.30),
  ('İspanya', 'Portekiz',  now() + interval '3 days',   2.30, 3.10, 3.10),
  ('Hollanda', 'Meksika',  now() + interval '4 days',   1.85, 3.50, 4.20);
