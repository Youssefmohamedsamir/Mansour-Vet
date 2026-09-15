/**
 * Mansour Vet Pharmacy - Lifetime Offline Database Engine (IndexedDB + Persistent Storage)
 * محرك تخزين البيانات الدائم مدى الحياة لصيدلية منصور البيطرية
 * بدون إنترنت وبدون أي إيموجي
 */

const DB_NAME = "MansourVetPharmacyDB";
const DB_VERSION = 2;
const STORE_NAME = "medicines";
const SETTINGS_KEY = "mansour_vet_settings";
const BACKUP_KEY = "mansour_medicines_permanent_backup";

const DEFAULT_SETTINGS = {
  pharmacyName: "صيدلية منصور البيطرية",
  ownerName: "د. منصور",
  phone: "",
  criticalAlertDays: 7,
  warningAlertDays: 30,
  lowStockThreshold: 5,
  soundEnabled: true
};

class VetDB {
  constructor() {
    this.db = null;
    this.isReady = false;
  }

  async init() {
    // 1. تفعيل الحفظ الدائم على ذاكرة الجهاز مدى الحياة (Prevent Browser Eviction)
    this.requestPersistentStorage();

    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported, falling back to LocalStorage.");
        this.isReady = true;
        resolve(this);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("expiryDate", "expiryDate", { unique: false });
          store.createIndex("category", "category", { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.isReady = true;
        await this.syncRecoveryData();
        resolve(this);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        this.isReady = true;
        resolve(this);
      };
    });
  }

  /**
   * طلب إذن التخزين الدائم من نظام التشغيل (iOS / Android) لمنع مسح البيانات إطلاقاً
   */
  async requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log("Lifetime Persistent Storage granted:", isPersisted);
      }
    } catch (e) {
      console.warn("Storage persist request error:", e);
    }
  }

  /**
   * مزامنة واسترجاع تلقائي لحماية البيانات من أي مسح غير مقصود
   */
  async syncRecoveryData() {
    try {
      const dbItems = await this.getAllFromDB();
      const backupItems = this.getBackupFromStorage();

      if (dbItems.length === 0 && backupItems.length > 0) {
        // استعادة تلقائية من النسخة الاحتياطية الدائمة
        for (const it of backupItems) {
          await this.putToDB(it);
        }
      } else if (dbItems.length > 0) {
        // تحديث النسخة الدائمة
        localStorage.setItem(BACKUP_KEY, JSON.stringify(dbItems));
      }
    } catch (e) {
      console.warn("Sync recovery warning:", e);
    }
  }

  getSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error("Failed to save settings", e);
      return false;
    }
  }

  getBackupFromStorage() {
    try {
      const saved = localStorage.getItem(BACKUP_KEY) || localStorage.getItem("mansour_medicines_fallback");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  async getAllFromDB() {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async putToDB(item) {
    if (!this.db) return item;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll() {
    if (this.db) {
      const items = await this.getAllFromDB();
      // تحديث نسخة الطوارئ الدائمة
      if (items.length > 0) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
      }
      return items;
    } else {
      return this.getBackupFromStorage();
    }
  }

  async add(item) {
    if (!item.id) {
      item.id = "med_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }
    item.createdAt = new Date().toISOString();
    item.updatedAt = item.createdAt;

    if (this.db) {
      await this.putToDB(item);
    }

    // حفظ فوري في النسخة الدائمة (Dual Storage)
    const all = await this.getAll();
    const exists = all.some(m => m.id === item.id);
    if (!exists) all.push(item);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(all));

    return item;
  }

  async update(id, updates) {
    const items = await this.getAll();
    const index = items.findIndex((it) => it.id === id);
    if (index === -1) return null;

    const updatedItem = { ...items[index], ...updates, updatedAt: new Date().toISOString() };

    if (this.db) {
      await this.putToDB(updatedItem);
    }

    items[index] = updatedItem;
    localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
    return updatedItem;
  }

  async adjustStock(id, amount) {
    const items = await this.getAll();
    const item = items.find((it) => it.id === id);
    if (!item) return null;

    const newQty = Math.max(0, (parseInt(item.quantity, 10) || 0) + amount);
    return await this.update(id, { quantity: newQty });
  }

  async delete(id) {
    if (this.db) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }

    let items = this.getBackupFromStorage();
    items = items.filter((it) => it.id !== id);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
    return true;
  }

  async exportBackup() {
    const medicines = await this.getAll();
    const settings = this.getSettings();
    return JSON.stringify(
      {
        appName: "Mansour Vet Pharmacy",
        version: "2.0",
        exportDate: new Date().toISOString(),
        totalItems: medicines.length,
        settings,
        medicines
      },
      null,
      2
    );
  }

  async importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.medicines || !Array.isArray(data.medicines)) {
        throw new Error("ملف النسخة الاحتياطية غير صالح.");
      }

      for (const item of data.medicines) {
        if (item.id) {
          await this.update(item.id, item).catch(() => this.add(item));
        } else {
          await this.add(item);
        }
      }

      if (data.settings) {
        this.saveSettings(data.settings);
      }
      return { success: true, count: data.medicines.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // توافق ومزامنة مع المحرك السحابي
  async getAllMedicines() {
    return await this.getAll();
  }

  async saveMedicine(item) {
    if (!item || !item.id) return null;
    if (this.db) {
      await this.putToDB(item);
    }
    const all = await this.getAll();
    const idx = all.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      all[idx] = item;
    } else {
      all.push(item);
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
    return item;
  }
}

window.vetDB = new VetDB();
