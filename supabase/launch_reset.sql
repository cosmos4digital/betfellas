-- =====================================================
-- LANSMAN SIFIRLAMASI
-- Test döneminin izlerini siler, yapıyı korur.
-- Çalıştırmadan önce emin ol: GERİ DÖNÜŞÜ YOK.
-- =====================================================

-- Tüm kuponlar, duvar mesajları, reklam kayıtları, bracket tahminleri
delete from public.coupon_legs;
delete from public.coupons;
delete from public.feed_messages;
delete from public.ad_views;
delete from public.bracket_picks;

-- Herkesin puanını 1000'e çek
update public.league_members set current_points = 1000;

-- (İSTEĞE BAĞLI) Test liglerini de sil — herkes sıfırdan kurar:
-- delete from public.league_members;
-- delete from public.leagues;

-- (İSTEĞE BAĞLI) Test kullanıcılarını silmek istersen:
-- Authentication > Users ekranından elle sil (profiles cascade ile silinir).
