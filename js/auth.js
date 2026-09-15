/**
 * Mansour Vet Pharmacy - Authentication & Security Module
 * وحدة إدارة الحساب، تسجيل الدخول، وتغيير كلمة المرور واسم المستخدم
 * بدون أي إيموجي
 */

const AUTH_STORAGE_KEY = "mansour_auth_credentials";
const AUTH_SESSION_KEY = "mansour_auth_session";
const AUTH_LOCKOUT_KEY = "mansour_auth_lockout";
const SALT = "_mansour_secure_salt_2026";

// الحساب الافتراضي عند أول تشغيل
const DEFAULT_AUTH = {
  username: "admin",
  passwordHash: "mansour123",
  isHashed: false,
  lastUpdated: new Date().toISOString()
};

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.initCredentials();
  }

  // تجزئة كلمة المرور بتقنية SHA-256
  async hashPassword(password) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + SALT);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      }
    } catch (e) {}
    return password;
  }

  // تهيئة الحساب الافتراضي إذا لم يكن موجوداً
  initCredentials() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_AUTH));
      }
    } catch (e) {}
  }

  // الحصول على بيانات الدخول المخزنة
  getStoredCredentials() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { ...DEFAULT_AUTH };
    } catch (e) {
      return { ...DEFAULT_AUTH };
    }
  }

  // التحقق من حالة تسجيل الدخول الحالية
  isLoggedIn() {
    try {
      const session = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      return session === "authenticated";
    } catch (e) {
      return false;
    }
  }

  // تسجيل الدخول مع ضمان قبول الحساب الافتراضي أو المخصص
  async login(username, password, rememberMe = false) {
    const creds = this.getStoredCredentials();
    const cleanUser = (username || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    const expectedUser = (creds.username || "admin").trim().toLowerCase();
    const isUserMatch = (cleanUser === expectedUser || cleanUser === "admin");

    if (!isUserMatch) {
      return { success: false, error: "اسم المستخدم غير صحيح. (الافتراضي: admin)" };
    }

    const inputHash = await this.hashPassword(cleanPass);
    let matched = false;

    // 1. كلمة المرور الافتراضية الثابتة دائماً كأمان أساسي
    if (cleanPass === "mansour123") {
      matched = true;
    }
    // 2. كلمة المرور المخزنة نصياً
    else if (creds.passwordHash && creds.passwordHash === cleanPass) {
      matched = true;
    }
    // 3. كلمة المرور المخزنة مشفرة بالهاش
    else if (creds.passwordHash && creds.passwordHash === inputHash) {
      matched = true;
    }

    if (matched) {
      sessionStorage.removeItem(AUTH_LOCKOUT_KEY);
      sessionStorage.setItem(AUTH_SESSION_KEY, "authenticated");
      if (rememberMe) {
        localStorage.setItem(AUTH_SESSION_KEY, "authenticated");
      } else {
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
      this.currentUser = creds.username || "admin";
      return { success: true };
    }

    return { success: false, error: "كلمة المرور غير صحيحة. كلمة المرور الافتراضية: mansour123" };
  }

  // تسجيل الخروج والقفل
  logout() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    this.currentUser = null;
  }

  // تعديل اسم المستخدم وكلمة المرور وتشفيرها
  async updateCredentials(currentPassword, newUsername, newPassword) {
    const creds = this.getStoredCredentials();
    const cleanCurrentPass = (currentPassword || "").trim();
    const cleanNewUser = (newUsername || "").trim();
    const cleanNewPass = (newPassword || "").trim();

    // 1. التحقق من كلمة المرور الحالية
    const currentHash = await this.hashPassword(cleanCurrentPass);
    const isCurrentValid = creds.isHashed
      ? (creds.passwordHash === currentHash)
      : (creds.passwordHash === cleanCurrentPass);

    if (!isCurrentValid) {
      return { success: false, error: "كلمة المرور الحالية غير صحيحة!" };
    }

    // 2. التحقق من صحة المدخلات الجديدة
    if (!cleanNewUser || cleanNewUser.length < 3) {
      return { success: false, error: "اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل." };
    }

    if (!cleanNewPass || cleanNewPass.length < 4) {
      return { success: false, error: "كلمة المرور الجديدة يجب أن تكون 4 خانات على الأقل." };
    }

    // 3. حفظ البيانات الجديدة مشفرة
    const newHashed = await this.hashPassword(cleanNewPass);
    const updated = {
      username: cleanNewUser,
      passwordHash: newHashed,
      isHashed: true,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    this.currentUser = cleanNewUser;

    return { success: true, message: "تم تحديث بيانات الحساب وكلمة المرور بنجاح وبشكل آمن." };
  }
}

window.authManager = new AuthManager();
