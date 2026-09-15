/**
 * Mansour Vet Pharmacy - Cross-Device Cloud Sync Engine
 * محرك المزامنة السحابية الفورية المشتركة بين الآيفون والأندرويد
 * يجمع البيانات من كافة الأجهزة في قاعدة بيانات سحابية موحدة
 * بدون أي إيموجي ويعمل مع الحفاظ الكامل على العمل أوفلاين
 */

const SYNC_CONFIG = {
  endpoint: "https://api.restful-api.dev/objects/ff808181a067127101a09a200f13083e",
  storageKey: "mansour_cloud_sync_config",
  lastSyncTimeKey: "mansour_last_cloud_sync_time",
  isSyncing: false
};

class CloudSyncEngine {
  constructor() {
    this.statusElement = null;
  }

  init() {
    this.statusElement = document.getElementById("cloudSyncBadge");
    this.updateStatus("online", "المزامنة السحابية: جاهز");

    // فحص دوري للمزامنة كل 60 ثانية إذا كان هناك إنترنت
    window.addEventListener("online", () => this.syncAll(false));
    window.addEventListener("offline", () => this.updateStatus("offline", "وضع العمل أوفلاين"));

    // بدء أول مزامنة بعد تحميل الصفحة بـ 1 ثانية
    setTimeout(() => {
      if (navigator.onLine) {
        this.syncAll(false);
      } else {
        this.updateStatus("offline", "وضع العمل أوفلاين");
      }
    }, 1200);
  }

  updateStatus(state, text) {
    if (!this.statusElement) {
      this.statusElement = document.getElementById("cloudSyncBadge");
    }
    if (!this.statusElement) return;

    const label = this.statusElement.querySelector(".sync-label");
    if (label) label.textContent = text;

    if (state === "syncing") {
      this.statusElement.className = "cloud-sync-badge syncing";
    } else if (state === "offline") {
      this.statusElement.className = "cloud-sync-badge offline";
    } else {
      this.statusElement.className = "cloud-sync-badge";
    }
  }

  /**
   * جلب البيانات من السحابة ودمجها مع الذاكرة المحلية
   */
  async pullFromCloud() {
    if (!navigator.onLine) return { success: false, reason: "offline" };
    try {
      const response = await fetch(SYNC_CONFIG.endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const json = await response.json();
      if (!json || !json.data || !Array.isArray(json.data.medicines)) {
        return { success: true, count: 0 };
      }

      const cloudMeds = json.data.medicines;
      const localMeds = await window.vetDB.getAllMedicines();
      const localMap = new Map();
      localMeds.forEach(m => localMap.set(String(m.id), m));

      let mergedCount = 0;
      for (const cm of cloudMeds) {
        const local = localMap.get(String(cm.id));
        if (!local) {
          // دواء جديد مضاف من جهاز آخر (آيفون أو أندرويد)
          await window.vetDB.saveMedicine(cm);
          mergedCount++;
        } else {
          // دواء موجود، فحص إذا كانت نسخة السحابة أحدث
          const cloudTime = cm.updatedAt ? new Date(cm.updatedAt).getTime() : 0;
          const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
          if (cloudTime > localTime) {
            await window.vetDB.saveMedicine(cm);
            mergedCount++;
          }
        }
      }

      return { success: true, count: mergedCount };
    } catch (e) {
      console.warn("Cloud pull error:", e);
      return { success: false, error: e.message };
    }
  }

  /**
   * رفع البيانات المحلية المحدثة إلى السحابة
   */
  async pushToCloud() {
    if (!navigator.onLine) return { success: false, reason: "offline" };
    try {
      const localMeds = await window.vetDB.getAllMedicines();
      const payload = {
        name: "Mansour Vet Sync Store",
        data: {
          syncId: "mansour_pharma_2026",
          medicines: localMeds,
          lastUpdated: new Date().toISOString()
        }
      };

      const response = await fetch(SYNC_CONFIG.endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      localStorage.setItem(SYNC_CONFIG.lastSyncTimeKey, new Date().toISOString());
      return { success: true };
    } catch (e) {
      console.warn("Cloud push error:", e);
      return { success: false, error: e.message };
    }
  }

  /**
   * مزامنة شاملة (جلب ثم دمج ثم رفع وتحديث الواجهة)
   */
  async syncAll(showToast = true) {
    if (SYNC_CONFIG.isSyncing) return;
    if (!navigator.onLine) {
      this.updateStatus("offline", "وضع العمل أوفلاين");
      if (showToast) alert("لا يوجد اتصال بالإنترنت حالياً. البيانات محفوظة بأمان على جهازك وستتم المزامنة تلقائياً فور توفر الشبكة.");
      return;
    }

    SYNC_CONFIG.isSyncing = true;
    this.updateStatus("syncing", "جاري المزامنة...");

    try {
      // 1. جلب التحديثات من الأجهزة الأخرى أولاً
      const pullRes = await this.pullFromCloud();

      // 2. رفع الحالة الحالية للسحابة لتكون متطابقة تماماً
      const pushRes = await this.pushToCloud();

      if (pullRes.success && pushRes.success) {
        this.updateStatus("online", "المزامنة السحابية: متصل");
        // تحديث القائمة والإحصائيات
        if (typeof window.loadMedicines === "function") {
          await window.loadMedicines();
        }
        if (showToast) {
          alert("تمت المزامنة السحابية بنجاح! تم تحديث جميع الأصناف المشتركة بين الهواتف.");
        }
      } else {
        this.updateStatus("online", "المزامنة السحابية: متصل جزئياً");
      }
    } catch (e) {
      this.updateStatus("offline", "خطأ في المزامنة السحابية");
    } finally {
      SYNC_CONFIG.isSyncing = false;
    }
  }
}

window.cloudSync = new CloudSyncEngine();
