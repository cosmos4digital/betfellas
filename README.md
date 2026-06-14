# Kupa Guru 🏆 — DK2026 Sosyal Tahmin Oyunu

Arkadaşlar arası, tamamen eğlence amaçlı sanal puan (GP) tahmin uygulaması.
Gerçek para YOKTUR.

## Kurulum
1. Supabase'de yeni proje aç → SQL Editor → `supabase/setup.sql` dosyasını çalıştır.
2. `.env.example` → `.env` olarak kopyala, Supabase URL ve anon key'i gir.
3. `npm install && npm run dev`

## Maç sonuçlandırma (admin)
Service role key ile (sunucu tarafı / SQL Editor):
```sql
select settle_match('<match_id>', 'home'); -- 'home' | 'draw' | 'away'
```
Kazanan kuponlara floor(amount * odd) GP eklenir, feed'e otomatik kazanç kartı düşer.

## Güvenlik mimarisi
- Bakiye işlemleri client'tan asla yapılmaz; `place_bet`, `join_league`,
  `create_league`, `toggle_reaction`, `settle_match` SECURITY DEFINER RPC'leridir.
- RLS: herkes sadece üyesi olduğu ligin verisini görür.
- Maç başladıktan sonra `place_bet` veritabanı seviyesinde reddedilir.

---

## v2 — Gerçek Maçlar, Mağaza, Oyuncu Profilleri

### Kurulum sırası
1. SQL Editor'de `supabase/upgrade_v2.sql` çalıştır (mevcut veriyi bozmaz).
2. https://dashboard.api-football.com adresinden ücretsiz API key al (100 istek/gün).
3. Edge Function deploy:
   ```bash
   npx supabase login
   npx supabase link --project-ref PROJE_REF
   npx supabase secrets set APIFOOTBALL_KEY=senin_keyin
   npx supabase functions deploy sync-matches
   ```
4. Cron kur (önerilen): Dashboard > Integrations > Cron > Create job >
   "Edge Function" seç > sync-matches > her 2 dakikada bir (*/2 * * * *).
   Alternatif SQL yöntemi upgrade_v2.sql sonunda yorum olarak var.
5. İlk senkronu elle tetiklemek istersen:
   Dashboard > Edge Functions > sync-matches > "Test" (veya curl ile çağır).

### Ne yapar?
- Önümüzdeki 14 günün DK2026 fikstürünü ve gerçek 1X2 oranlarını çeker.
- Maç başlayınca status=live + canlı skor; bitince status=finished.
- Biten maçta settle_match otomatik çağrılır: kazananlara GP dağıtılır,
  feed'e kazanç kartı düşer. Kuponlar yapıldıkları andaki oranla kilitlidir.

### Mağaza
- Reklam ödülü: claim_ad_reward RPC, günde 5 hak, 50 GP — limit sunucuda.
  Gerçek ödüllü reklam SDK'sı eklenince onRewarded callback'inde aynı RPC çağrılır.
- Çerçeveler: buy_frame RPC, GP ile kozmetik (neon 1500 / gold 3000 / fire 5000).
- Gerçek parayla GP satışı BİLİNÇLİ olarak yok: gerçek para -> bahis puanı
  modeli, oyunu lisans gerektiren kumar kategorisine sokar. Gerçek para
  istersen sadece kozmetik satışı (Stripe) ekleyin.

---

## v3 — Çoklu Lig, Ayarlar, Bracket, Bug Fix

### SQL
SQL Editor'de YENİ SEKME açıp `supabase/upgrade_v3.sql` çalıştır (veri silmez).

### Frontend
```bash
npm install   # html2canvas eklendi (bracket PNG paylaşımı)
npm run dev
```

### Yenilikler
- Reklam ödülü çift yazma bug'ı düzeltildi (StrictMode updater problemi).
- Çoklu lig: giriş -> Lig Merkezi (liglerin + 5 slot) -> lig seç.
  Üst bardaki lig adına dokununca lig değiştirici açılır.
- Ayarlar (Profil > dişli): kullanıcı adı değiştirme, çerçeve çıkarma,
  Lig Merkezi'ne gitme, ligden ayrılma (onaylı), çıkış yap.
- Şampiyonluk Bracket'i (Maçlar sekmesinin üstünde): Son 32'den finale
  tıkla-seç; "Kaydet & Paylaş" tahmini PNG indirir.
  Gerçek Son 32 eşleşmeleri belli olunca bracket_ties tablosunu güncelle.

## GERÇEK MAÇLARI BAĞLAMA (ücretsiz ikili API)
NOT: API-Football'un ücretsiz planı 2026 sezonunu KAPSAMIYOR (eski sezonlarla
sınırlı). Bu yüzden ücretsiz iki kaynağa geçildi:
- football-data.org -> fikstür + canlı skor + sonuç (DK dahil, ücretsiz)
- the-odds-api.com  -> gerçek 1X2 oranları (ücretsiz 500 kredi/ay)

1) İki ücretsiz key al:
   - https://www.football-data.org/client/register (mail ile token gelir)
   - https://the-odds-api.com (Get API Key)

2) Terminalde (proje klasöründe):
   npx supabase secrets set FOOTBALLDATA_KEY=token_buraya
   npx supabase secrets set ODDSAPI_KEY=key_buraya
   npx supabase functions deploy sync-matches --no-verify-jwt

3) İlk senkron + oranlar (tarayıcıdan):
   https://PROJE_REF.supabase.co/functions/v1/sync-matches?odds=1
   Cevap: {"ok":true,"fixtures":N,"created":...,"oddsApplied":...}

4) Cron: Dashboard > Integrations > Cron > sync-matches > */5 * * * *
   (Oranlar kota dostu olarak 3 saatte bir yenilenir; skor/durum her 5 dk.)

5) Test maçlarını sil (SQL Editor):
   delete from public.matches where external_id is null;

---

## v4 — Kombine Kupon, Profesyonel Arayüz, Yeni Bracket, Emoji Fix

### SQL
SQL Editor'de YENİ SEKMEDE `supabase/upgrade_v4.sql` çalıştır.
- coupons + coupon_legs tabloları, place_coupon RPC
- settle_match artık kupon bacaklarını işler (bir bacak yatarsa kupon yatar,
  hepsi tutarsa floor(miktar x toplam_oran) ödenir)
- Eski tekli bahisler otomatik olarak 1 maçlık kuponlara taşınır
- Reaksiyon emojileri: 🔥 🤡 💸 😂 ⚽

### Yenilikler
- Kombine kupon: oranlara dokunarak sepete ekle (1-10 maç), alttaki bar ->
  kupon ekranı -> miktar -> onay. Toplam oran çarpılarak hesaplanır.
- Arayüz: Inter font, tek vurgu rengi (indigo), gradyansız sade kartlar,
  sportsbook tarzı oran kutuları, tarihe göre gruplanmış fikstür.
- Bracket: takımları Son 32 slotlarına KENDİN yerleştirirsin (48 takımlık
  havuz, aranabilir seçici); çift kanatlı ağaç (sol 16 - sağ 16) ortada final;
  PNG indir-paylaş. Takım havuzu Bracket.jsx başındaki TEAMS dizisinde.
- Duvar: emoji bug'ı düzeltildi (await edilmeyen supabase çağrısı hiç
  gönderilmiyordu) + anlık optimistic güncelleme + 5 emoji.

---

## v5 — STORE ÇIKIŞI (App Store / Google Play)

### Önce bunlar (tek seferlik)
1. delete-account fonksiyonunu deploy et (store zorunluluğu — hesap silme):
   npx supabase functions deploy delete-account
   (JWT doğrulaması AÇIK kalsın, --no-verify-jwt KULLANMA)
2. public/gizlilik.html içindeki DESTEK_MAILINI_YAZ kısmına mailini yaz.
   Web deploy'unda https://SITEN/gizlilik.html adresi store formlarında
   "Privacy Policy URL" olarak kullanılacak.

### ANDROID (Google Play) — Windows'ta yapılabilir
Gereksinimler: Android Studio (ücretsiz), Google Play Console hesabı (25$ tek seferlik)

1. npm install
2. npm run mobile:init            # android/ klasörünü oluşturur
3. npm run mobile:android         # build + Android Studio'da açar
4. Android Studio: Build > Generate Signed Bundle > AAB
   (ilk seferde keystore oluştur — DOSYAYI VE ŞİFRESİNİ KAYBETME,
    kaybedersen uygulamayı bir daha güncelleyemezsin)
5. play.google.com/console > Uygulama oluştur > AAB'yi yükle
6. İçerik derecelendirme anketi: "Simulated gambling" = EVET -> 18+
7. Data safety formu: e-posta + kullanıcı adı topluyoruz, hesap silme var
8. Yeni bireysel hesaplar: 14 gün boyunca 12 testçiyle kapalı test zorunlu,
   sonra üretime başvurabilirsin (arkadaş ligin tam bu işe yarar)

### iOS (App Store) — Mac gerektirir
Gereksinimler: Mac + Xcode, Apple Developer (99$/yıl)
1. npx cap add ios && npm run mobile:ios
2. Xcode: Signing & Capabilities > Team seç > Archive > App Store Connect
3. Yaş derecelendirme: Simulated Gambling = 17+
4. App Privacy: e-posta + kullanıcı adı, "linked to user"
Mac yoksa: Codemagic gibi bulut build servisleri Capacitor iOS build alabilir.

### İçerik politikası özeti (ÖNEMLİ)
- Uygulama "simüle kumar" kategorisindedir: gerçek para YOK, GP satın
  alınamaz/paraya çevrilemez — bu sayede store'larda yayınlanabilir durumda.
- ASLA gerçek parayla GP satışı ekleme; eklediğin an her iki store'da da
  kumar lisansı kategorisine düşer ve uygulama kaldırılır.
- Derecelendirme anketlerinde simulated gambling sorusuna dürüst cevap ver.

---

## v5 — Bracket düzeltme + VIP üyelik

### SQL
SQL Editor'de YENİ SEKMEDE `supabase/upgrade_v5.sql` çalıştır
(profiles tablosuna is_vip / vip_since + set_vip RPC).

### Bracket
- Takım seçme bug'ı düzeltildi (boş slot artık tıklanabilir buton).
- Her Son 32 slotunda resmi eşleşme ipucu var (örn. "A 2.si", "E 1.si",
  "A/B/C/D/F 3.sü") — ekteki FIFA fikstürüne göre. Takım havuzunu ve
  ipuçlarını Bracket.jsx başındaki TEAMS / SLOT_HINTS dizilerinden düzenle.

### VIP üyelik (mağaza)
- Reklamsız deneyim + VIP rozeti. OYUN AVANTAJI YOK (adil rekabet).
- Şu an set_vip RPC ile açılır (test). ÜRETİMDE: store içi ürün (IAP)
  satın alınınca, makbuzu bir Edge Function'da App Store / Google Play
  API'siyle doğrula, sonra service_role ile is_vip=true yaz. Asla
  client'tan doğrulamasız VIP verme.

### NEDEN GP PAKETİ SATMIYORUZ (önemli)
Gerçek parayla oyun içi para (GP) satışı, GP gerçek oranlı tahminlere
yatırıldığı için uygulamayı App Store Guideline 5.3 ve Google Real-Money
Gambling kapsamına sokar — "kazanca çevrilemiyor" olması bunu değiştirmez,
çünkü mesele paranın ÇIKIŞI değil GİRİŞİdir. Bu, store reddinin ve
TR'de 7258 sayılı kanun riskinin en yaygın sebebidir. Gelir için güvenli
yollar: VIP (reklamsız), kozmetik satışı, ödüllü reklam (AdMob). Bunlar
uygulamayı "simüle" kategorisinde tutar.

---

## v6 — Kupon sonuçlandırma fix + Dil desteği + Gruplu bracket

### SQL (önce çalıştır)
SQL Editor'de YENİ SEKMEDE `supabase/upgrade_v6.sql`:
- settle_pending() fonksiyonu: bitmiş ama açık kalmış kuponları kapatır/öder
- dosya sonunda bir kez çalıştırılır -> mevcut takılı kuponların düzelir
- sync-matches her turda settle_pending çağırır (güvenlik ağı)

Edge Function'ı yeniden deploy et:
  npx supabase functions deploy sync-matches --no-verify-jwt

### Dil desteği (TR / EN)
- i18next + tarayıcı/telefon dili otomatik algılama; tr/en dışı -> EN
- Ayarlar > Dil bölümünden elle değiştirilebilir (localStorage'da saklanır)
- Çeviriler: src/locales/tr.json ve en.json. Yeni metin eklerken iki dosyaya da ekle.
- NOT: Tüm bileşenler kademeli çevriliyor; eksik kalan birkaç string
  şimdilik TR görünebilir, anahtarları locales'e ekleyip t() ile bağlanır.

### Bracket — gruplu seçim
- Takım seçici artık TÜM 48 takımı değil, o slotun ilgili gruplarını gösterir
  (örn. "A 2.si" -> sadece A grubu takımları; "C/D/F/G/H 3.sü" -> o 5 grup).
- Gruplar Bracket.jsx içindeki GROUPS, slot kuralları SLOTS dizisinde.
  Grup aşaması bitince takımları gerçek sonuçlara göre güncelle.

### App Store / Play öncesi EKSİK GİDERİLENLER ve KALAN İŞLER
Eklendi: PWA manifest+ikon, hesap silme, gizlilik politikası, dil desteği.
Store öncesi ÖNERİLEN ek işler (henüz yapılmadı, istenirse eklenir):
  1. Kullanım Şartları (Terms) sayfası — gizlilik gibi public/terms.html
  2. Yaş kapısı / 18+ onayı (simüle bahis teması için ilk açılışta)
  3. Hata izleme (Sentry) ve temel analytics (gizlilik metnine eklenmeli)
  4. Çevrimdışı/yükleniyor durumları ve hata ekranları (boş ağ vb.)
  5. Push bildirim (maç başlıyor / kuponun sonuçlandı) — Capacitor + FCM
  6. Store görselleri: ekran görüntüleri, feature graphic, uygulama açıklaması
  7. Gerçek IAP entegrasyonu (VIP için makbuz doğrulama Edge Function)

---

## v7 — BetFellas rebrand + yeşil tema + kayıp kupon bildirimi

### Marka
- İsim: Kupa Guru -> BetFellas (app, manifest, capacitor appId=com.betfellas.app)
- Logo: public/logo-source.png; ikonlar (icon-192/512, apple-touch, logo-mark)
  bu logodan üretildi. Header ve giriş ekranı gerçek logoyu kullanıyor.
- Renk paleti indigo -> emerald/yeşil (logo uyumu).

### SQL
SQL Editor'de YENİ SEKMEDE `supabase/upgrade_v7.sql`:
- feed type'a 'system_loss' eklenir
- settle_match + settle_pending artık KAYBEDEN kupon için de duvara kart düşürür
Sonra: npx supabase functions deploy sync-matches --no-verify-jwt (değişmedi ama
settle fonksiyonları güncellendiği için DB tarafı yeterli).

### Dil
Tüm ekranlar TR/EN çevrildi (Auth, Matches, Feed, Store, Profile, Leaderboard,
LeagueHub, Settings, Bracket, CouponCard, BetSlip, PlayerProfile).

---

## v7.1 — Bracket dil + yeni logo
- Bracket başlığındaki marka "BetFellas · 2026" oldu.
- Takım isimleri dile göre gösterilir: TR "Güney Kore" / EN "South Korea" gibi.
  Kayıt hep TR isimle yapılır (mevcut kayıtlar bozulmaz), gösterim çevrilir.
  Yeni takım eklersen Bracket.jsx içindeki TEAM_EN sözlüğüne EN karşılığını ekle.
- Slot ipuçları dile göre: "A 2.si" / EN "A 2nd".
- Logo güncellendi; tüm ikonlar yeni logodan yeniden üretildi.

---

## v8 — 18+ yaş kapısı + Kullanım Şartları (store hazırlık)
- AgeGate: ilk açılışta 18+ onayı (cihazda saklanır, bir daha sorulmaz).
  Reddedilirse erişim engellenir. Şartlar + Gizlilik bağlantıları burada.
- public/terms.html (Kullanım Şartları) + mevcut public/gizlilik.html.
  İKİSİNDEKİ DESTEK_MAILINI_YAZ kısmını kendi mailinle değiştir.
- Settings > Uygulama bölümünde de Şartlar ve Gizlilik bağlantıları var.
- Büyük/küçük "i" düzeltmesi: <html lang> artık i18n diline bağlı; FINAL/CHAMPION
  gibi sabit İngilizce etiketler toLocaleUpperCase("en-US") ile basılıyor.

Store başvurusunda Privacy Policy URL: https://SITEN/gizlilik.html
Terms of Use URL: https://SITEN/terms.html

### KALAN: Push bildirim (ayrı kurulum)
Maç başlıyor / kupon sonuçlandı bildirimleri — Capacitor + Firebase (FCM).
Firebase projesi açıp google-services.json / APNs anahtarı gerektirir.
İstenildiğinde adım adım eklenir.
