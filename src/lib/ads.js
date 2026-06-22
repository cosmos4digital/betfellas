import { Capacitor } from "@capacitor/core";

// AdMob reklam birimi kimlikleri
const BANNER_ID = "ca-app-pub-2475342860552947/7008950411";
const REWARDED_ID = "ca-app-pub-2475342860552947/8002467883";

let initialized = false;

const isNative = () => Capacitor.isNativePlatform();

/**
 * AdMob SDK'sını başlatır, ATT (izleme) iznini ister ve alt banner'ı gösterir.
 * Web'de hiçbir şey yapmaz (banner placeholder'lar web'de görünmeye devam eder).
 */
export async function initAds() {
  if (!isNative() || initialized) return;
  try {
    const { AdMob, BannerAdPluginEvents } = await import("@capacitor-community/admob");
    await AdMob.initialize();
    initialized = true;

    // Banner yüksekliği değişince CSS değişkenini güncelle ->
    // alt nav, kupon barı ve içerik banner kadar yukarı kayar.
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
      const h = info && info.height ? `${info.height}px` : "0px";
      document.documentElement.style.setProperty("--ad-banner-h", h);
    });

    // iOS izleme izni (NSUserTrackingUsageDescription gerektirir)
    try {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === "notDetermined") {
        await AdMob.requestTrackingAuthorization();
      }
    } catch {
      /* ATT desteklenmiyorsa yoksay */
    }

    await showBanner();
  } catch (e) {
    console.warn("AdMob init hatası:", e);
  }
}

export async function showBanner() {
  if (!isNative()) return;
  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import("@capacitor-community/admob");
    await AdMob.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
  } catch (e) {
    console.warn("Banner gösterilemedi:", e);
  }
}

/**
 * Ödüllü reklam gösterir. Kullanıcı ödülü hak ederse true döner.
 * Web'de (native değil) çağrılmaz; çağıran taraf web fallback'ini yönetir.
 */
export async function showRewarded() {
  if (!isNative()) return false;
  try {
    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_ID });

    let rewarded = false;
    const sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });

    const result = await AdMob.showRewardVideoAd();
    await sub.remove();

    return rewarded || !!(result && (result.amount || result.type));
  } catch (e) {
    console.warn("Ödüllü reklam hatası:", e);
    return false;
  }
}
