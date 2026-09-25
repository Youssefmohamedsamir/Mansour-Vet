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
   * قائمة الأدوية التجريبية الافتراضية للتجربة المباشرة دون الحاجة لإدخال يدوي
   * تواريخ الصلاحية محسوبة ديناميكياً لتناسب أي وقت يتم تشغيل التطبيق فيه
   */
  getDefaultMedicines() {
    function getOffsetDate(days) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    const nowIso = new Date().toISOString();

    return [
      {
        id: "med_demo_01",
        name: "أوكسي تتراسيكلين 20% طويل المفعول",
        genericName: "Oxytetracycline Dihydrate 20%",
        category: "مضادات حيوية",
        expiryDate: getOffsetDate(-12),
        quantity: 2,
        minQuantity: 5,
        purchasePrice: "95",
        wholesalePrice: "110",
        price: "130",
        batchNumber: "B-7041",
        notes: "مضاد حيوي واسع المدى لعلاج النزلات الشعبية وحمى النقل وعفن الحوافر في الأبقار والأغنام.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_02",
        name: "تايلوزين 20% تيلوفيت حقن",
        genericName: "Tylosin Tartrate 20%",
        category: "مضادات حيوية",
        expiryDate: getOffsetDate(4),
        quantity: 8,
        minQuantity: 5,
        purchasePrice: "140",
        wholesalePrice: "165",
        price: "195",
        batchNumber: "TY-992",
        notes: "علاج فعال للالتهابات الرئوية الناتجة عن الميكوبلازما والتهاب المفاصل في العجول والخراف.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_03",
        name: "إنروفلوكساسين 10% بايتريل محلول",
        genericName: "Enrofloxacin 10%",
        category: "مضادات حيوية",
        expiryDate: getOffsetDate(21),
        quantity: 14,
        minQuantity: 5,
        purchasePrice: "75",
        wholesalePrice: "88",
        price: "105",
        batchNumber: "EN-403",
        notes: "مضاد بكتيري قوي للقضاء على العدوى المعوية والتنفسية ومقاومة بكتيريا الكولاي والسالمونيلا.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_04",
        name: "فلورفينيكول 30% نوكلوفلور",
        genericName: "Florfenicol 30%",
        category: "مضادات حيوية",
        expiryDate: getOffsetDate(180),
        quantity: 25,
        minQuantity: 5,
        purchasePrice: "210",
        wholesalePrice: "245",
        price: "280",
        batchNumber: "FL-8812",
        notes: "علاج نوعي متقدم لحالات التهاب الجهاز التنفسي البقري الحاد (BRD) المقاوم للمضادات الأخرى.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_05",
        name: "ألفا فيتامين AD3E فورت عالي التركيز",
        genericName: "Vitamin A + D3 + E Forte",
        category: "فيتامينات ومقويات",
        expiryDate: getOffsetDate(365),
        quantity: 40,
        minQuantity: 10,
        purchasePrice: "50",
        wholesalePrice: "62",
        price: "75",
        batchNumber: "VT-104",
        notes: "رافع مناعة ممتاز، يحسن الخصوبة ومعدل التحويل الغذائي ويقي من حالات الإجهاد ولين العظام.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_06",
        name: "إيفرمكتين 1% سوبر تكس",
        genericName: "Ivermectin 1% + Clorsulon",
        category: "مضادات طفيليات وديدان",
        expiryDate: getOffsetDate(300),
        quantity: 3,
        minQuantity: 6,
        purchasePrice: "85",
        wholesalePrice: "100",
        price: "120",
        batchNumber: "IV-553",
        notes: "علاج فعال للطفيليات الداخلية والديدان الكبدية والطفيليات الخارجية كالجرب والقراد.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_07",
        name: "ديكلوفيناك صوديوم 5% بيطري",
        genericName: "Diclofenac Sodium 5%",
        category: "مضادات التهاب ومسكنات",
        expiryDate: getOffsetDate(420),
        quantity: 18,
        minQuantity: 5,
        purchasePrice: "42",
        wholesalePrice: "50",
        price: "60",
        batchNumber: "DF-209",
        notes: "مسكن غير ستيرويدي خافض للحرارة ومضاد للالتهاب في حالات العرج والتهاب الضرع الحاد.",
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "med_demo_08",
        name: "كالفوزيت محلول كالسيوم وفسفور",
        genericName: "Calcium Borogluconate 25% + Phosphorus",
        category: "أمراض هضمية وكرش",
        expiryDate: getOffsetDate(270),
        quantity: 15,
        minQuantity: 4,
        purchasePrice: "65",
        wholesalePrice: "78",
        price: "95",
        batchNumber: "CA-330",
        notes: "لعلاج حمى اللبن ونقص الكالسيوم وحالات الرقاد بعد الولادة والكزاز في الماشية والخيول.",
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ];
  }

  /**
   * تكييش البيانات التجريبية تلقائياً في التخزين الدائم
   */
  async seedDemoData() {
    const demoMeds = this.getDefaultMedicines();
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          for (const item of demoMeds) {
            store.put(item);
          }
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      } catch (err) {
        console.warn("Error putting demo items to DB:", err);
      }
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(demoMeds));
    return demoMeds;
  }

  /**
   * إعادة ضبط وتحميل البيانات التجريبية بطلب المستخدم
   */
  async resetToDemoData() {
    const demoMeds = this.getDefaultMedicines();
    if (this.db) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        for (const item of demoMeds) {
          store.put(item);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(demoMeds));
    return demoMeds;
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
      } else if (dbItems.length === 0 && backupItems.length === 0) {
        // تهيئة فورية وتكييش مسبق بالبيانات التجريبية
        await this.seedDemoData();
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
        return items;
      } else {
        const backup = this.getBackupFromStorage();
        if (backup && backup.length > 0) {
          for (const it of backup) {
            await this.putToDB(it);
          }
          return backup;
        } else {
          // لم يتم العثور على أي بيانات، يتم التكييش التلقائي بالبيانات التجريبية
          return await this.seedDemoData();
        }
      }
    } else {
      const backup = this.getBackupFromStorage();
      if (backup && backup.length > 0) {
        return backup;
      }
      return await this.seedDemoData();
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
      if (!jsonString) {
        throw new Error("كود النسخة الاحتياطية فارغ.");
      }

      let data = null;
      if (typeof jsonString !== "string") {
        data = jsonString;
      } else {
        let str = jsonString.trim();
        // إزالة علامة BOM إن وجدت
        if (str.charCodeAt(0) === 0xFEFF) {
          str = str.substring(1);
        }
        // إزالة كتل الماركداون
        if (str.startsWith("```")) {
          str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        }
        data = JSON.parse(str);
      }

      let meds = null;
      if (Array.isArray(data)) {
        meds = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.medicines)) meds = data.medicines;
        else if (Array.isArray(data.data)) meds = data.data;
        else if (data.data && Array.isArray(data.data.medicines)) meds = data.data.medicines;
        else if (Array.isArray(data.items)) meds = data.items;
        else if (Array.isArray(data.drugs)) meds = data.drugs;
        else if (Array.isArray(data.products)) meds = data.products;
        else if (Array.isArray(data.mansour_medicines_permanent_backup)) meds = data.mansour_medicines_permanent_backup;
        else {
          for (const key of Object.keys(data)) {
            if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === "object") {
              meds = data[key];
              break;
            }
          }
        }
      }

      if (!meds || !Array.isArray(meds)) {
        throw new Error("ملف النسخة الاحتياطية غير صالح أو لا يحتوي على قائمة أدوية صحيحة.");
      }

      // تصفية وتجهيز وتطبيع عناصر الأدوية لضمان قراءتها وعرضها فوراً
      const validItems = [];
      const nowIso = new Date().toISOString();
      for (const raw of meds) {
        if (!raw || typeof raw !== "object") continue;
        const item = {
          id: String(raw.id || ("med_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5))),
          name: String(raw.name || raw.medName || raw.tradeName || "دواء بيطري"),
          genericName: String(raw.genericName || raw.scientificName || ""),
          category: String(raw.category || "عام"),
          expiryDate: String(raw.expiryDate || raw.expDate || raw.expiry || ""),
          quantity: raw.quantity !== undefined ? raw.quantity : (raw.qty !== undefined ? raw.qty : (raw.stock !== undefined ? raw.stock : 0)),
          price: raw.price || raw.sellPrice || "",
          wholesalePrice: raw.wholesalePrice || "",
          purchasePrice: raw.purchasePrice || raw.costPrice || "",
          minQuantity: raw.minQuantity || raw.lowStock || 5,
          batchNumber: raw.batchNumber || raw.batch || "",
          notes: raw.notes || "",
          createdAt: raw.createdAt || nowIso,
          updatedAt: nowIso
        };
        validItems.push(item);
      }

      if (validItems.length === 0) {
        throw new Error("لم يتم العثور على أي أدوية مسجلة داخل هذا الكود.");
      }

      // حفظ دفعة واحدة سريعة ومباشرة في IndexedDB
      if (this.db) {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([STORE_NAME], "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          for (const item of validItems) {
            store.put(item);
          }
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      }

      // دمج وتحديث النسخة الدائمة الفورية في LocalStorage
      const currentList = this.getBackupFromStorage();
      const map = new Map();
      for (const it of currentList) {
        if (it && it.id) map.set(it.id, it);
      }
      for (const it of validItems) {
        map.set(it.id, it);
      }
      const allMerged = Array.from(map.values());
      localStorage.setItem(BACKUP_KEY, JSON.stringify(allMerged));

      if (data.settings) {
        this.saveSettings(data.settings);
      }

      return { success: true, count: validItems.length };
    } catch (err) {
      console.error("Import backup failed:", err);
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
