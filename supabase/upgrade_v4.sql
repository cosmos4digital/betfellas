-- ============================================================
-- KUPA GURU v4 YÜKSELTMESİ
-- Kombine kupon sistemi (çoklu maç) + reaksiyon emoji genişletme
-- Mevcut kurulumun ÜZERİNE çalıştırılır. Eski tekli bahisler
-- otomatik olarak 1 maçlık kuponlara taşınır.
-- ============================================================

-- ---------- 1. KUPON TABLOLARI ----------

create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  amount     integer not null check (amount > 0),
  total_odd  numeric(10,2) not null check (total_odd >= 1),
  status     text not null default 'pending' check (status in ('pending','won','lost')),
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_legs (
  id        uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  match_id  uuid not null references public.matches(id) on delete cascade,
  bet_type  text not null check (bet_type in ('home','draw','away')),
  odd       numeric(5,2) not null,
  status    text not null default 'pending' check (status in ('pending','won','lost')),
  unique (coupon_id, match_id)
);

create index if not exists idx_coupons_user on public.coupons(user_id, league_id, created_at desc);
create index if not exists idx_legs_match on public.coupon_legs(match_id) where status = 'pending';
create index if not exists idx_legs_coupon on public.coupon_legs(coupon_id);

-- ---------- 2. RLS ----------

alter table public.coupons enable row level security;
alter table public.coupon_legs enable row level security;

drop policy if exists "coupons_select_league" on public.coupons;
create policy "coupons_select_league" on public.coupons
  for select to authenticated
  using (user_id = auth.uid() or public.is_league_member(league_id, auth.uid()));

drop policy if exists "legs_select_via_coupon" on public.coupon_legs;
create policy "legs_select_via_coupon" on public.coupon_legs
  for select to authenticated
  using (exists (
    select 1 from public.coupons c
    where c.id = coupon_id
      and (c.user_id = auth.uid() or public.is_league_member(c.league_id, auth.uid()))
  ));
-- yazma sadece place_coupon RPC üzerinden

-- ---------- 3. RPC: KUPON OYNA (1-10 maç, atomik) ----------

create or replace function public.place_coupon(
  _league_id uuid, _amount integer, _legs jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  _n int;
  _leg jsonb;
  _match public.matches;
  _odd numeric(5,2);
  _total numeric := 1;
  _cid uuid;
  _username text;
  _legs_out jsonb := '[]'::jsonb;
begin
  if _amount < 10 then raise exception 'En az 10 GP yatırılabilir'; end if;

  _n := coalesce(jsonb_array_length(_legs), 0);
  if _n < 1 or _n > 10 then raise exception 'Kupon 1 ile 10 maç arasında olmalı'; end if;
  if (select count(distinct l->>'match_id') from jsonb_array_elements(_legs) l) <> _n then
    raise exception 'Aynı maç kuponda yalnızca bir kez yer alabilir';
  end if;

  -- bakiyeyi atomik düş
  update public.league_members
     set current_points = current_points - _amount
   where league_id = _league_id and user_id = auth.uid()
     and current_points >= _amount;
  if not found then raise exception 'Bakiye yetersiz'; end if;

  insert into public.coupons (user_id, league_id, amount, total_odd)
  values (auth.uid(), _league_id, _amount, 1)
  returning id into _cid;

  for _leg in select * from jsonb_array_elements(_legs) loop
    select * into _match from public.matches
     where id = (_leg->>'match_id')::uuid for update;

    if _match.id is null then raise exception 'Maç bulunamadı'; end if;
    if _match.status <> 'upcoming' or _match.match_time <= now() then
      raise exception '"%" maçına tahmin kapandı', _match.team1 || ' - ' || _match.team2;
    end if;

    _odd := case _leg->>'bet_type'
              when 'home' then _match.odds_home
              when 'draw' then _match.odds_draw
              when 'away' then _match.odds_away end;
    if _odd is null then raise exception 'Geçersiz tahmin tipi'; end if;

    _total := _total * _odd;
    insert into public.coupon_legs (coupon_id, match_id, bet_type, odd)
    values (_cid, _match.id, _leg->>'bet_type', _odd);

    _legs_out := _legs_out || jsonb_build_object(
      'match', _match.team1 || ' - ' || _match.team2,
      'pick', _leg->>'bet_type',
      'odd', _odd
    );
  end loop;

  _total := round(_total, 2);
  update public.coupons set total_odd = _total where id = _cid;

  select username into _username from public.profiles where id = auth.uid();
  insert into public.feed_messages (league_id, user_id, type, content_json)
  values (_league_id, auth.uid(), 'bet_share', jsonb_build_object(
    'username', _username,
    'amount', _amount,
    'total_odd', _total,
    'legs', _legs_out
  ));

  return _cid;
end; $$;

-- ---------- 4. settle_match v4: kupon bacaklarını işler ----------

create or replace function public.settle_match(_match_id uuid, _result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _c record;
  _payout integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Sadece yönetici sonuçlandırabilir';
  end if;
  if _result not in ('home','draw','away') then raise exception 'Geçersiz sonuç'; end if;

  update public.matches set status = 'finished', result = _result where id = _match_id;

  -- 1) Bu maçın bekleyen bacaklarını işaretle
  update public.coupon_legs
     set status = case when bet_type = _result then 'won' else 'lost' end
   where match_id = _match_id and status = 'pending';

  -- 2) Bacağı yatan kuponlar kaybetti
  update public.coupons c
     set status = 'lost'
   where c.status = 'pending'
     and exists (select 1 from public.coupon_legs l
                  where l.coupon_id = c.id and l.status = 'lost');

  -- 3) Tüm bacakları tutan kuponlar kazandı: ödeme + duvar kartı
  for _c in
    select c.*, p.username
      from public.coupons c
      join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and not exists (select 1 from public.coupon_legs l
                        where l.coupon_id = c.id and l.status <> 'won')
  loop
    _payout := floor(_c.amount * _c.total_odd);
    update public.coupons set status = 'won' where id = _c.id;
    update public.league_members
       set current_points = current_points + _payout
     where league_id = _c.league_id and user_id = _c.user_id;

    insert into public.feed_messages (league_id, user_id, type, content_json)
    values (_c.league_id, _c.user_id, 'system_win', jsonb_build_object(
      'username', _c.username,
      'payout', _payout,
      'leg_count', (select count(*) from public.coupon_legs where coupon_id = _c.id),
      'total_odd', _c.total_odd
    ));
  end loop;
end; $$;

-- ---------- 5. ESKİ TEKLİ BAHİSLERİ KUPONLARA TAŞI (tek seferlik) ----------

do $$
declare b record; cid uuid;
begin
  if (select count(*) from public.coupons) = 0 then
    for b in select * from public.bets loop
      insert into public.coupons (user_id, league_id, amount, total_odd, status, created_at)
      values (b.user_id, b.league_id, b.amount, b.odd, b.status, b.created_at)
      returning id into cid;
      insert into public.coupon_legs (coupon_id, match_id, bet_type, odd, status)
      values (cid, b.match_id, b.bet_type, b.odd, b.status);
    end loop;
    delete from public.bets;
  end if;
end $$;

-- ---------- 6. REAKSİYON EMOJİLERİ GENİŞLETİLDİ ----------

create or replace function public.toggle_reaction(_message_id uuid, _emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _msg public.feed_messages;
  _users jsonb;
begin
  if _emoji not in ('🔥','🤡','💸','😂','⚽') then raise exception 'Geçersiz emoji'; end if;

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

-- ---------- 7. REALTIME ----------

alter publication supabase_realtime add table public.coupons;
