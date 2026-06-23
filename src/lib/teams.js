// Takım adı yerelleştirme (ortak modül).
//
// Maçlar (matches tablosu) prod veritabanına İngilizce isimle girilmiş
// olabilir; bracket ise TR isimle kayıtlı. Bu yüzden gösterimde, kayıt
// hangi dilde olursa olsun aktif arayüz diline çeviren çift yönlü bir
// harita kullanıyoruz. Haritada olmayan isim olduğu gibi gösterilir
// (regresyon yok).

// TR -> EN
export const TEAM_EN = {
  "ABD": "USA", "Meksika": "Mexico", "Kanada": "Canada", "Arjantin": "Argentina",
  "Brezilya": "Brazil", "Fransa": "France", "İngiltere": "England", "İspanya": "Spain",
  "Portekiz": "Portugal", "Almanya": "Germany", "Hollanda": "Netherlands", "Belçika": "Belgium",
  "Hırvatistan": "Croatia", "İtalya": "Italy", "Fas": "Morocco", "Senegal": "Senegal",
  "Japonya": "Japan", "Güney Kore": "South Korea", "Avustralya": "Australia", "İran": "Iran",
  "Suudi Arabistan": "Saudi Arabia", "Katar": "Qatar", "Özbekistan": "Uzbekistan", "Ürdün": "Jordan",
  "Ekvador": "Ecuador", "Uruguay": "Uruguay", "Kolombiya": "Colombia", "Paraguay": "Paraguay",
  "Norveç": "Norway", "İskoçya": "Scotland", "Avusturya": "Austria", "İsviçre": "Switzerland",
  "Türkiye": "Türkiye", "Gana": "Ghana", "Fildişi Sahili": "Ivory Coast", "Tunus": "Tunisia",
  "Cezayir": "Algeria", "Mısır": "Egypt", "Güney Afrika": "South Africa", "Yeşil Burun": "Cabo Verde",
  "Yeni Zelanda": "New Zealand", "İsveç": "Sweden", "Irak": "Iraq", "Çekya": "Czechia",
  "Bosna Hersek": "Bosnia & Herzegovina", "Kongo DC": "DR Congo", "Haiti": "Haiti",
  "Curaçao": "Curaçao", "Panama": "Panama",
};

// EN -> TR (TEAM_EN'in tersi; elle yazıp typo riski almıyoruz)
export const TEAM_TR = Object.fromEntries(
  Object.entries(TEAM_EN).map(([tr, en]) => [en, tr])
);

const isEn = (lang) => !!lang?.startsWith("en");

// Kayıtlı isim TR de olabilir EN de — aktif dile çevir.
export function localizeTeam(name, lang) {
  if (!name) return name;
  if (isEn(lang)) return TEAM_EN[name] ?? name;   // TR kaydı -> EN
  return TEAM_TR[name] ?? name;                    // EN kaydı -> TR
}
