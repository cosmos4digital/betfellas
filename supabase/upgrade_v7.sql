-- ============================================================
-- BetFellas v7 — Kaybeden kupon da duvara düşsün
-- settle_match ve settle_pending: kupon 'lost' olunca system_loss kartı
-- ============================================================

-- feed_messages.type check'ine 'system_loss' ekle
alter table public.feed_messages drop constraint if exists feed_messages_type_check;
alter table public.feed_messages add constraint feed_messages_type_check
  check (type in ('text','bet_share','system_win','system_loss'));

-- settle_pending: kazanan + KAYBEDEN kupona feed kartı
create or replace function public.settle_pending()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _c record;
  _payout integer;
  _won int := 0; _lost int := 0;
begin
  -- a) biten maçların bekleyen bacaklarını işaretle
  update public.coupon_legs l
     set status = case when l.bet_type = m.result then 'won' else 'lost' end
    from public.matches m
   where l.match_id = m.id and m.status = 'finished' and m.result is not null
     and l.status = 'pending';

  -- b) bacağı yatan kuponlar kaybetti -> feed kartı (yeni kaybedenler)
  for _c in
    select c.*, p.username
      from public.coupons c
      join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and exists (select 1 from public.coupon_legs l where l.coupon_id = c.id and l.status = 'lost')
  loop
    update public.coupons set status = 'lost' where id = _c.id;
    insert into public.feed_messages (league_id, user_id, type, content_json)
    values (_c.league_id, _c.user_id, 'system_loss', jsonb_build_object(
      'username', _c.username,
      'amount', _c.amount,
      'leg_count', (select count(*) from public.coupon_legs where coupon_id = _c.id),
      'total_odd', _c.total_odd
    ));
    _lost := _lost + 1;
  end loop;

  -- c) tüm bacakları tutan kuponlar kazandı -> ödeme + feed kartı
  for _c in
    select c.*, p.username
      from public.coupons c
      join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and not exists (select 1 from public.coupon_legs l where l.coupon_id = c.id and l.status <> 'won')
       and exists (select 1 from public.coupon_legs l where l.coupon_id = c.id)
  loop
    _payout := floor(_c.amount * _c.total_odd);
    update public.coupons set status = 'won' where id = _c.id;
    update public.league_members set current_points = current_points + _payout
     where league_id = _c.league_id and user_id = _c.user_id;
    insert into public.feed_messages (league_id, user_id, type, content_json)
    values (_c.league_id, _c.user_id, 'system_win', jsonb_build_object(
      'username', _c.username, 'payout', _payout,
      'leg_count', (select count(*) from public.coupon_legs where coupon_id = _c.id),
      'total_odd', _c.total_odd
    ));
    _won := _won + 1;
  end loop;

  return jsonb_build_object('won', _won, 'lost', _lost);
end; $$;

-- settle_match da aynı kayıp kartını eklesin (cron canlı sonuçlandırmada)
create or replace function public.settle_match(_match_id uuid, _result text)
returns void language plpgsql security definer set search_path = public as $$
declare _c record; _payout integer;
begin
  if auth.role() <> 'service_role' then raise exception 'yetki yok'; end if;
  if _result not in ('home','draw','away') then raise exception 'geçersiz sonuç'; end if;

  update public.matches set status = 'finished', result = _result where id = _match_id;

  update public.coupon_legs set status = case when bet_type = _result then 'won' else 'lost' end
   where match_id = _match_id and status = 'pending';

  -- kaybedenler
  for _c in
    select c.*, p.username from public.coupons c join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and exists (select 1 from public.coupon_legs l where l.coupon_id = c.id and l.status = 'lost')
  loop
    update public.coupons set status = 'lost' where id = _c.id;
    insert into public.feed_messages (league_id, user_id, type, content_json)
    values (_c.league_id, _c.user_id, 'system_loss', jsonb_build_object(
      'username', _c.username, 'amount', _c.amount,
      'leg_count', (select count(*) from public.coupon_legs where coupon_id = _c.id),
      'total_odd', _c.total_odd));
  end loop;

  -- kazananlar
  for _c in
    select c.*, p.username from public.coupons c join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and not exists (select 1 from public.coupon_legs l where l.coupon_id = c.id and l.status <> 'won')
  loop
    _payout := floor(_c.amount * _c.total_odd);
    update public.coupons set status = 'won' where id = _c.id;
    update public.league_members set current_points = current_points + _payout
     where league_id = _c.league_id and user_id = _c.user_id;
    insert into public.feed_messages (league_id, user_id, type, content_json)
    values (_c.league_id, _c.user_id, 'system_win', jsonb_build_object(
      'username', _c.username, 'payout', _payout,
      'leg_count', (select count(*) from public.coupon_legs where coupon_id = _c.id),
      'total_odd', _c.total_odd));
  end loop;
end; $$;
