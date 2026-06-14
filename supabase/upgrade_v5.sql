-- ============================================================
-- KUPA GURU v5 — VIP / Reklamsız üyelik
-- VIP, oyun avantajı VERMEZ: yalnızca reklamları kaldırır ve
-- profilde "VIP" rozeti gösterir. Bu sayede store politikalarına uygundur.
-- Gerçek satın alma, store içi ürün (IAP) doğrulamasıyla yapılır; burada
-- yalnızca VIP durumunu tutuyoruz.
-- ============================================================

alter table public.profiles add column if not exists is_vip boolean not null default false;
alter table public.profiles add column if not exists vip_since timestamptz;

-- VIP'i etkinleştiren RPC.
-- ÖNEMLİ: Bu fonksiyon gerçek ödemeyi DOĞRULAMAZ. Üretimde mutlaka
-- store IAP makbuzunu (App Store / Google Play) bir Edge Function'da
-- doğrulayıp oradan service_role ile is_vip=true yazılmalıdır.
-- Geliştirme/test için buradan açılabilir.
create or replace function public.set_vip(_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set is_vip = _on,
         vip_since = case when _on and vip_since is null then now()
                          when not _on then null else vip_since end
   where id = auth.uid();
end; $$;
