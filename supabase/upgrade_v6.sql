-- ============================================================
-- KUPA GURU v6 — Sonuçlanmış maçların kuponlarını toparla
-- "Maç bitti, skor geldi ama kupon hâlâ açık" durumunu düzeltir.
-- ============================================================

-- 1) Sonucu belli ama (geç kalmış) settle edilmemiş kuponları işleyen
--    güvenli fonksiyon. settle_match'in aksine TÜM bekleyen bacakları,
--    ait olduğu maç 'finished' ve sonucu belliyse, sonuca göre kapatır.
create or replace function public.settle_pending()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _c record;
  _payout integer;
  _won int := 0; _lost int := 0;
begin
  -- service_role veya giriş yapmış kullanıcı tetikleyebilir (idempotent).
  -- a) Biten maçların bekleyen bacaklarını sonuca göre işaretle
  update public.coupon_legs l
     set status = case when l.bet_type = m.result then 'won' else 'lost' end
    from public.matches m
   where l.match_id = m.id
     and m.status = 'finished' and m.result is not null
     and l.status = 'pending';

  -- b) En az bir bacağı yatan kuponlar kaybetti
  update public.coupons c
     set status = 'lost'
   where c.status = 'pending'
     and exists (select 1 from public.coupon_legs l
                  where l.coupon_id = c.id and l.status = 'lost');

  -- c) Tüm bacakları tutmuş (ve hiç pending bacağı kalmamış) kuponlar kazandı
  for _c in
    select c.*, p.username
      from public.coupons c
      join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and not exists (select 1 from public.coupon_legs l
                        where l.coupon_id = c.id and l.status <> 'won')
       and exists (select 1 from public.coupon_legs l where l.coupon_id = c.id)
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
    _won := _won + 1;
  end loop;

  select count(*) into _lost from public.coupons where status = 'lost';
  return jsonb_build_object('settled_won', _won);
end; $$;

-- 2) Şimdi bir kez çalıştır: bekleyen ama aslında sonuçlanmış kuponları kapat
select public.settle_pending();
