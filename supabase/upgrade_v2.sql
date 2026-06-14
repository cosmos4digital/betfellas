-- ============================================================
-- KUPA GURU v2 YÜKSELTMESİ
-- Gerçek maç senkronu + Mağaza (reklam ödülü & kozmetik çerçeveler)
-- Mevcut kurulumun ÜZERİNE çalıştırılır, veri silmez.
-- ============================================================

-- ---------- 1. MAÇ TABLOSUNA GERÇEK VERİ ALANLARI ----------

alter table public.matches add column if not exists external_id text unique; -- API-Football fixture id
alter table public.matches add column if not exists score1 integer;          -- canlı/biten skor
alter table public.matches add column if not exists score2 integer;

-- ---------- 2. KOZMETİK ÇERÇEVE ----------

alter table public.profiles add column if not exists frame text
  check (frame in ('neon','gold','fire'));

-- ---------- 3. REKLAM İZLEME KAYITLARI ----------

create table if not exists public.ad_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_ad_views_daily on public.ad_views(user_id, league_id, created_at);

alter table public.ad_views enable row level security;
drop policy if exists "ad_views_select_own" on public.ad_views;
create policy "ad_views_select_own" on public.ad_views
  for select to authenticated using (user_id = auth.uid());
-- insert sadece RPC üzerinden (security definer), client doğrudan yazamaz

-- ---------- 4. RPC: REKLAM ÖDÜLÜ AL (günde 5 hak, 50 GP) ----------

create or replace function public.claim_ad_reward(_league_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _reward constant integer := 50;
  _daily_limit constant integer := 5;
  _today integer;
begin
  if not public.is_league_member(_league_id, auth.uid()) then
    raise exception 'Bu ligin üyesi değilsin';
  end if;

  select count(*) into _today
    from public.ad_views
   where user_id = auth.uid() and league_id = _league_id
     and created_at >= date_trunc('day', now());

  if _today >= _daily_limit then
    raise exception 'Bugünlük reklam hakkın doldu, yarın yine gel';
  end if;

  insert into public.ad_views (user_id, league_id) values (auth.uid(), _league_id);

  update public.league_members
     set current_points = current_points + _reward
   where league_id = _league_id and user_id = auth.uid();

  return _reward;
end; $$;

-- ---------- 5. RPC: ÇERÇEVE SATIN AL (GP ile, kozmetik) ----------

create or replace function public.buy_frame(_league_id uuid, _frame text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _price integer;
begin
  _price := case _frame
              when 'neon' then 1500
              when 'gold' then 3000
              when 'fire' then 5000
              else null end;
  if _price is null then raise exception 'Böyle bir çerçeve yok'; end if;

  update public.league_members
     set current_points = current_points - _price
   where league_id = _league_id and user_id = auth.uid()
     and current_points >= _price;
  if not found then raise exception 'GP yetmiyor, biraz daha kupon tutturman lazım'; end if;

  update public.profiles set frame = _frame where id = auth.uid();
end; $$;

-- ---------- 6. CRON (SEÇENEK B - SQL ile) ----------
-- Önerilen yol Dashboard'dur (aşağıda anlatıldı). SQL ile kurmak istersen:
-- Önce Dashboard > Database > Extensions'tan pg_cron ve pg_net'i aç, sonra:
--
-- select cron.schedule(
--   'sync-matches',
--   '*/2 * * * *',  -- 2 dakikada bir
--   $cron$
--   select net.http_post(
--     url := 'https://PROJE_REF.supabase.co/functions/v1/sync-matches',
--     headers := jsonb_build_object('Authorization', 'Bearer SERVICE_ROLE_KEY')
--   );
--   $cron$
-- );
