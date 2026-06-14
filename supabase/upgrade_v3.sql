-- ============================================================
-- KUPA GURU v3 YÜKSELTMESİ
-- Çoklu lig (max 5 slot) + Lig'den ayrılma + Şampiyonluk Bracket'i
-- Mevcut kurulumun ÜZERİNE çalıştırılır, veri silmez.
-- ============================================================

-- ---------- 1. LİG SLOT LİMİTİ (max 5) ----------
-- create_league ve join_league'i slot kontrolüyle yeniden tanımlıyoruz.

create or replace function public.create_league(_name text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  _code char(6);
  _league public.leagues;
begin
  if (select count(*) from public.league_members where user_id = auth.uid()) >= 5 then
    raise exception 'Lig slotların doldu (5/5). Yeni lig için birinden ayrılman lazım.';
  end if;

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

create or replace function public.join_league(_invite_code text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  _league public.leagues;
  _already boolean;
begin
  select * into _league from public.leagues where invite_code = upper(_invite_code);
  if _league.id is null then
    raise exception 'Geçersiz davet kodu';
  end if;

  _already := exists (select 1 from public.league_members
                       where league_id = _league.id and user_id = auth.uid());
  if _already then return _league; end if;

  if (select count(*) from public.league_members where user_id = auth.uid()) >= 5 then
    raise exception 'Lig slotların doldu (5/5). Yeni lig için birinden ayrılman lazım.';
  end if;

  insert into public.league_members (league_id, user_id, current_points)
  values (_league.id, auth.uid(), 1000);

  return _league;
end; $$;

-- ---------- 2. RPC: LİGDEN AYRIL ----------
-- Puanlar ve o ligdeki bekleyen kuponlar silinir (geri dönüşü yok).

create or replace function public.leave_league(_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_member(_league_id, auth.uid()) then
    raise exception 'Zaten bu ligin üyesi değilsin';
  end if;

  delete from public.bets
   where league_id = _league_id and user_id = auth.uid() and status = 'pending';

  delete from public.league_members
   where league_id = _league_id and user_id = auth.uid();
end; $$;

-- ---------- 3. ŞAMPİYONLUK BRACKET'İ ----------
-- bracket_ties: Son 32 turunun 16 eşleşmesi (pos 1..16).
-- Gerçek eşleşmeler belli olunca admin bu tabloyu günceller;
-- takımlar değişirse kullanıcı tahminleri UI'da otomatik geçersiz sayılır.

create table if not exists public.bracket_ties (
  pos   smallint primary key check (pos between 1 and 16),
  team1 text not null,
  team2 text not null
);

alter table public.bracket_ties enable row level security;
drop policy if exists "bracket_ties_select" on public.bracket_ties;
create policy "bracket_ties_select" on public.bracket_ties
  for select to authenticated using (true);
-- yazma sadece service_role / SQL Editor

-- bracket_picks: kullanıcının tur tur tahminleri (tek JSON)
create table if not exists public.bracket_picks (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  picks      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bracket_picks enable row level security;
drop policy if exists "bracket_picks_select" on public.bracket_picks;
create policy "bracket_picks_select" on public.bracket_picks
  for select to authenticated using (true); -- arkadaşlar birbirinin bracket'ini görebilsin
drop policy if exists "bracket_picks_upsert_own" on public.bracket_picks;
create policy "bracket_picks_upsert_own" on public.bracket_picks
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "bracket_picks_update_own" on public.bracket_picks;
create policy "bracket_picks_update_own" on public.bracket_picks
  for update to authenticated using (user_id = auth.uid());

-- ---------- 4. ÖRNEK SON 32 EŞLEŞMELERİ ----------
-- Grup aşaması bitince GERÇEK eşleşmelerle değiştirin:
--   update bracket_ties set team1='X', team2='Y' where pos=1; ...
insert into public.bracket_ties (pos, team1, team2) values
  (1,'Meksika','Yeni Zelanda'),(2,'İtalya','Fas'),
  (3,'Brezilya','Norveç'),(4,'İspanya','Mısır'),
  (5,'ABD','Galler'),(6,'Hollanda','Japonya'),
  (7,'Almanya','Avustralya'),(8,'Arjantin','Gana'),
  (9,'Kanada','İskoçya'),(10,'Portekiz','Güney Kore'),
  (11,'İngiltere','Senegal'),(12,'Belçika','Ekvador'),
  (13,'Fransa','Cezayir'),(14,'Kolombiya','İsviçre'),
  (15,'Uruguay','Türkiye'),(16,'Hırvatistan','Katar')
on conflict (pos) do nothing;
