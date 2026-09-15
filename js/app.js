/**
 * Mansour Vet Pharmacy - Main Application Controller (Clean Architecture)
 * صيدلية منصور البيطرية - وحدة التحكم الأساسية
 * خالية تماماً من أي إيموجي ومجهزة بالكامل للعمل أوفلاين
 */

// حالة التطبيق العامة
let allMedicines = [];
let currentFilter = "all";
let searchQuery = "";
let currentViewItem = null;

/**
 * فحص حالة المصادقة عند التحميل وإظهار شاشة الدخول أو التطبيق
 */
function checkAuthAndInit() {
  const loginOverlay = document.getElementById("loginScreen");
  const mainApp = document.getElementById("mainAppContainer");

  if (!window.authManager.isLoggedIn()) {
    loginOverlay.style.display = "flex";
    mainApp.style.display = "none";
  } else {
    loginOverlay.style.display = "none";
    mainApp.style.display = "block";
    loadMedicines();
  }
}

/**
 * معالجة نموذج تسجيل الدخول
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("loginUsername").value;
  const passwordInput = document.getElementById("loginPassword").value;
  const rememberMe = document.getElementById("rememberMeCheck").checked;
  const errorBox = document.getElementById("loginErrorMsg");

  const result = await window.authManager.login(usernameInput, passwordInput, rememberMe);

  if (result.success) {
    errorBox.style.display = "none";
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainAppContainer").style.display = "block";
    loadMedicines();
  } else {
    errorBox.textContent = result.error;
    errorBox.style.display = "block";
  }
}

/**
 * معالجة تسجيل الخروج
 */
function handleLogout() {
  if (confirm("هل تريد تسجيل الخروج وقفل التطبيق؟")) {
    window.authManager.logout();
    document.getElementById("mainAppContainer").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginErrorMsg").style.display = "none";
  }
}

/**
 * فتح نافذة إدارة الحساب وتغيير كلمة المرور
 */
function openSecurityModal() {
  const creds = window.authManager.getStoredCredentials();
  document.getElementById("currentUsernameDisplay").textContent = creds.username;
  document.getElementById("newUsernameInput").value = creds.username;
  document.getElementById("currentPasswordInput").value = "";
  document.getElementById("newPasswordInput").value = "";
  document.getElementById("confirmPasswordInput").value = "";
  document.getElementById("securityAlertBox").style.display = "none";
  document.getElementById("modalSecurity").classList.add("active");
}

/**
 * فتح نافذة النسخ الاحتياطي فوراً وبدون أي تعليق
 */
function openBackupModal(e) {
  if (e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  }
  const modal = document.getElementById("modalBackup");
  if (modal) {
    const ta = document.getElementById("backupTextarea");
    if (ta) ta.value = "";
    modal.classList.add("active");
  }
}
window.openBackupModal = openBackupModal;

/**
 * حفظ بيانات الحساب وكلمة المرور الجديدة
 */
async function handleSecuritySubmit(e) {
  e.preventDefault();
  const currentPass = document.getElementById("currentPasswordInput").value;
  const newUser = document.getElementById("newUsernameInput").value;
  const newPass = document.getElementById("newPasswordInput").value;
  const confirmPass = document.getElementById("confirmPasswordInput").value;
  const alertBox = document.getElementById("securityAlertBox");

  if (newPass !== confirmPass) {
    alertBox.textContent = "كلمة المرور الجديدة وتأكيدها غير متطابقين!";
    alertBox.className = "alert-box error";
    alertBox.style.display = "block";
    return;
  }

  const result = await window.authManager.updateCredentials(currentPass, newUser, newPass);

  if (result.success) {
    alertBox.textContent = result.message;
    alertBox.className = "alert-box success";
    alertBox.style.display = "block";
    document.getElementById("currentUsernameDisplay").textContent = newUser;
    setTimeout(() => {
      closeModal("modalSecurity");
    }, 1200);
  } else {
    alertBox.textContent = result.error;
    alertBox.className = "alert-box error";
    alertBox.style.display = "block";
  }
}

/**
 * حساب حالة الصلاحية بدقة بالأيام
 */
function calculateExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) {
    return { status: "safe", days: 999, label: "غير محدد", badgeClass: "badge-safe" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = expiryDateStr.split("-").map(Number);
  const expiry = new Date(y, m - 1, d);
  expiry.setHours(0, 0, 0, 0);

  const diffDays = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "critical",
      days: diffDays,
      label: `منتهي منذ ${Math.abs(diffDays)} يوم`,
      badgeClass: "badge-critical",
      borderClass: "border-critical"
    };
  } else if (diffDays <= 7) {
    return {
      status: "urgent",
      days: diffDays,
      label: diffDays === 0 ? "ينتهي اليوم" : `ينتهي خلال ${diffDays} ${diffDays === 1 ? "يوم" : diffDays === 2 ? "يومين" : "أيام"} (أسبوع)`,
      badgeClass: "badge-urgent",
      borderClass: "border-urgent"
    };
  } else if (diffDays <= 30) {
    return {
      status: "warning",
      days: diffDays,
      label: `ينتهي خلال ${diffDays} يوم (شهر)`,
      badgeClass: "badge-warning",
      borderClass: "border-warning"
    };
  } else {
    const months = Math.floor(diffDays / 30);
    return {
      status: "safe",
      days: diffDays,
      label: months > 0 ? `صالح (${months} شهر)` : `صالح (${diffDays} يوم)`,
      badgeClass: "badge-safe",
      borderClass: "border-safe"
    };
  }
}

/**
 * تحميل الأدوية وتحديث الواجهة
 */
async function loadMedicines() {
  allMedicines = await window.vetDB.getAll();
  renderDashboard();
  renderList();
}

/**
 * تحديث لوحة الإحصائيات وشريط التنبيه قبل أسبوع
 */
function renderDashboard() {
  let criticalCount = 0;
  let urgentCount = 0;
  let warningCount = 0;
  let lowStockCount = 0;

  const settings = window.vetDB.getSettings();

  allMedicines.forEach((med) => {
    const exp = calculateExpiryStatus(med.expiryDate);
    if (exp.status === "critical") criticalCount++;
    else if (exp.status === "urgent") urgentCount++;
    else if (exp.status === "warning") warningCount++;

    const qty = parseInt(med.quantity, 10) || 0;
    if (qty <= (med.minQuantity || settings.lowStockThreshold)) {
      lowStockCount++;
    }
  });

  document.getElementById("statTotal").textContent = allMedicines.length;
  document.getElementById("statUrgent").textContent = urgentCount;
  document.getElementById("statCritical").textContent = criticalCount;
  document.getElementById("statLowStock").textContent = lowStockCount;

  // تحديث حالة الأصناف في نظام الهاتف في الخلفية بصمت دون إزعاج المستخدم أو إطلاق إشعارات
  if (window.AndroidBridge && (window.AndroidBridge.syncState || window.AndroidBridge.checkAlerts)) {
    try {
      const expList = [];
      const lowList = [];
      allMedicines.forEach((m) => {
        const s = calculateExpiryStatus(m.expiryDate);
        if (s.status === "critical" || s.status === "urgent" || s.status === "warning") {
          let itemNote = m.name;
          if (s.status === "critical") itemNote += " (منتهي)";
          else if (s.days === 0) itemNote += " (ينتهي اليوم)";
          else itemNote += ` (باقي ${s.days} يوم)`;
          expList.push(itemNote);
        }
        const q = parseInt(m.quantity, 10) || 0;
        if (q <= (m.minQuantity || settings.lowStockThreshold || 5)) {
          lowList.push(m.name + " (" + q + " علبة)");
        }
      });

      if (window.AndroidBridge.syncState) {
        window.AndroidBridge.syncState(
          urgentCount + criticalCount + warningCount,
          lowStockCount,
          expList.slice(0, 3).join("، "),
          lowList.slice(0, 3).join("، ")
        );
      }
    } catch (e) {
      console.warn("Bridge silent sync error", e);
    }
  }

  // شريط التنبيه الحرج قبل أسبوع
  const urgentBanner = document.getElementById("urgentBanner");
  const urgentCountBadge = document.getElementById("urgentCountBadge");
  const urgentText = document.getElementById("urgentBannerText");

  if (urgentCount > 0) {
    urgentBanner.style.display = "flex";
    urgentCountBadge.textContent = urgentCount;
    urgentText.textContent = `تنبيه: يوجد ${urgentCount} ${urgentCount === 1 ? "صنف ينتهي" : "أصناف تنتهي"} خلال أسبوع (7 أيام أو أقل)`;
  } else {
    urgentBanner.style.display = "none";
  }
}

/**
 * زر فحص وتجربة الإشعارات (بدون إيموجي)
 */
function triggerDeviceAlerts() {
  if (window.AndroidBridge && window.AndroidBridge.testNotification) {
    window.AndroidBridge.testNotification();
    alert("تم إرسال إشعار فحص فوري لهاتفك بنجاح. تفقد شريط الإشعارات بالأعلى.");
  } else {
    alert("نظام الإشعارات نشط ومفعل لمتابعة الصلاحية والمخزون.");
  }
}

/**
 * عرض قائمة الأدوية وتطبيق الفلاتر والبحث
 */
function renderList() {
  const container = document.getElementById("medicinesList");
  const settings = window.vetDB.getSettings();

  const filtered = allMedicines.filter((med) => {
    const exp = calculateExpiryStatus(med.expiryDate);
    const qty = parseInt(med.quantity, 10) || 0;
    const minQty = med.minQuantity || settings.lowStockThreshold;

    if (currentFilter === "urgent" && exp.status !== "urgent") return false;
    if (currentFilter === "critical" && exp.status !== "critical") return false;
    if (currentFilter === "warning" && exp.status !== "warning") return false;
    if (currentFilter === "lowStock" && qty > minQty) return false;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (med.name || "").toLowerCase().includes(q);
      const matchGeneric = (med.genericName || "").toLowerCase().includes(q);
      const matchCategory = (med.category || "").toLowerCase().includes(q);
      const matchBatch = (med.batchNumber || "").toLowerCase().includes(q);
      if (!matchName && !matchGeneric && !matchCategory && !matchBatch) {
        return false;
      }
    }

    return true;
  });

  // ترتيب: الحرج والمنتهي أولاً دائماً للأهمية
  filtered.sort((a, b) => {
    const expA = calculateExpiryStatus(a.expiryDate);
    const expB = calculateExpiryStatus(b.expiryDate);
    const weight = { critical: 1, urgent: 2, warning: 3, safe: 4 };
    return weight[expA.status] - weight[expB.status] || expA.days - expB.days;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div class="empty-title">لا توجد أدوية مسجلة</div>
        <div class="empty-desc">اضغط على زر "إضافة دواء" بالأعلى لبدء تسجيل أصناف الصيدلية.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((med) => {
      const exp = calculateExpiryStatus(med.expiryDate);
      const qty = parseInt(med.quantity, 10) || 0;
      const isLowStock = qty <= (med.minQuantity || settings.lowStockThreshold);

      return `
        <div class="med-card ${exp.borderClass}" data-action="details" data-id="${escapeHtml(med.id)}">
          <div class="med-main-info" data-action="details" data-id="${escapeHtml(med.id)}">
            <div class="med-category-icon" data-action="details" data-id="${escapeHtml(med.id)}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                <path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"></path>
                <path d="M8.5 8.5l7 7"></path>
              </svg>
            </div>
            <div class="med-details-col" data-action="details" data-id="${escapeHtml(med.id)}">
              <div class="med-title">${escapeHtml(med.name)}</div>
              <div class="med-generic">${escapeHtml(med.genericName || "مستحضر بيطري")}</div>
              <div class="med-tags">
                <span class="badge ${exp.badgeClass}">
                  ${escapeHtml(exp.label)}
                </span>
                <span class="badge badge-category">${escapeHtml(med.category || "عام")}</span>
                ${isLowStock ? `<span class="badge badge-critical">نقص مخزون</span>` : ""}
              </div>
              ${(med.price || med.wholesalePrice || med.purchasePrice) ? `
              <div class="med-price-row">
                ${med.purchasePrice ? `<span class="price-tag tag-cost">شراء: ${escapeHtml(med.purchasePrice)} ج</span>` : ""}
                ${med.wholesalePrice ? `<span class="price-tag tag-wholesale">جملة: ${escapeHtml(med.wholesalePrice)} ج</span>` : ""}
                ${med.price ? `<span class="price-tag tag-retail">بيع: ${escapeHtml(med.price)} ج</span>` : ""}
              </div>` : ""}
            </div>
          </div>

          <!-- التحكم السريع في الكمية بالمخزن -->
          <div class="med-stock-control">
            <div class="stock-label">المخزن</div>
            <div class="stock-counter-wrapper">
              <button class="stock-btn" title="صرف / إنقاص" data-action="dec-stock" data-id="${escapeHtml(med.id)}">-</button>
              <span class="stock-qty-display">${qty}</span>
              <button class="stock-btn" title="إضافة / توريد" data-action="inc-stock" data-id="${escapeHtml(med.id)}">+</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * تعديل فوري لكمية المخزن
 */
async function changeStock(id, amount) {
  await window.vetDB.adjustStock(id, amount);
  await loadMedicines();
}

/**
 * تعديل آمن لكمية الدواء داخل نافذة التفاصيل دون تمرير نصوص في inline handlers
 */
async function handleCurrentItemStock(amount) {
  if (!currentViewItem || !currentViewItem.id) return;
  await changeStock(currentViewItem.id, amount);
  openDetailsModal(currentViewItem.id);
}

/**
 * فتح تفاصيل الدواء مع الذكاء الاصطناعي البيطري (بدون صور وبدون ملاحظات)
 * إذا كان غير دواء يظهر بوضوح: هذا ليس نوع دواء
 */
function openDetailsModal(id) {
  const med = allMedicines.find((m) => m.id === id);
  if (!med) return;

  currentViewItem = med;
  const exp = calculateExpiryStatus(med.expiryDate);
  const qty = parseInt(med.quantity, 10) || 0;

  document.getElementById("modalDetailsTitle").textContent = med.name;

  // التحليل البيطري الذكي
  const aiInfo = window.analyzeMedicineOffline(med.name + " " + (med.genericName || ""));

  let aiReportHtml = "";
  if (aiInfo.isDrug) {
    aiReportHtml = `
      <div class="ai-vet-card">
        <div class="ai-header">
          <div class="ai-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
            تقرير الذكاء الاصطناعي البيطري
          </div>
          <span class="ai-pill">${aiInfo.source}</span>
        </div>

        <div class="ai-section">
          <div class="ai-section-label">دواعي الاستعمال:</div>
          <div class="ai-section-content">${escapeHtml(aiInfo.indications)}</div>
        </div>

        <div class="ai-section">
          <div class="ai-section-label">الحيوانات المستهدفة:</div>
          <div class="species-tags">
            ${(aiInfo.species || []).map((sp) => `<span class="species-tag">${escapeHtml(sp)}</span>`).join("")}
          </div>
        </div>

        <div class="ai-section">
          <div class="ai-section-label">الجرعة الاسترشادية وطريقة الإعطاء:</div>
          <div class="ai-section-content">${escapeHtml(aiInfo.dosage)}</div>
        </div>

        <div class="ai-section">
          <div class="ai-section-label">فترة السحب:</div>
          <div class="ai-section-content" style="color: #fde047; font-weight: 600;">${escapeHtml(aiInfo.withdrawal)}</div>
        </div>

        ${aiInfo.cautions ? `
        <div class="ai-section">
          <div class="ai-section-label" style="color: #fca5a5;">تحذيرات هامة:</div>
          <div class="ai-section-content" style="color: #fecaca;">${escapeHtml(aiInfo.cautions)}</div>
        </div>` : ""}
      </div>
    `;
  } else {
    aiReportHtml = `
      <div class="ai-vet-card" style="border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.04);">
        <div class="ai-header" style="border-bottom: 1px solid rgba(56, 189, 248, 0.2);">
          <div class="ai-title" style="color: #38bdf8;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="13" x2="15" y2="13"></line>
              <line x1="9" y1="17" x2="11" y2="17"></line>
            </svg>
            السجل الدوائي للصيدلية
          </div>
          <span class="ai-pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">صنف مسجل</span>
        </div>
        <div class="ai-section" style="padding-top: 10px;">
          <div class="ai-section-content" style="color: #cbd5e1; line-height: 1.6;">
            مستحضر بيطري مسجل بنجاح في قاعدة بيانات الصيدلية. يمكنك استعراض الجرعة وطريقة الاستعمال الدقيقة من النشرة المرفقة بالعبوة.
          </div>
        </div>
      </div>
    `;
  }

  const detailsBody = document.getElementById("modalDetailsBody");
  detailsBody.innerHTML = `
    <!-- بطاقة معلومات الصنف والمخزون -->
    <div class="details-summary-card">
      <div class="summary-row">
        <span class="summary-label">المادة الفعالة:</span>
        <strong class="summary-val">${escapeHtml(med.genericName || "غير محدد")}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">الفئة البيطرية:</span>
        <span class="badge badge-category">${escapeHtml(med.category || "عام")}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">تاريخ الإنتاج:</span>
        <span class="summary-val">${escapeHtml(med.productionDate || "غير مدون")}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">تاريخ الانتهاء:</span>
        <div>
          <span class="badge ${exp.badgeClass}">${escapeHtml(exp.label)}</span>
          <span class="summary-val" style="margin-right: 6px;">${escapeHtml(med.expiryDate || "غير مدون")}</span>
        </div>
      </div>
      <div class="summary-row" style="border-top: 1px solid var(--border-color); padding-top: 8px;">
        <span class="summary-label">الكمية المتوفرة بالمخزن:</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="stock-btn" onclick="handleCurrentItemStock(-1)">-</button>
          <strong style="font-size: 1.2rem; color: #38bdf8; min-width: 32px; text-align: center;">${qty}</strong>
          <button class="stock-btn" onclick="handleCurrentItemStock(1)">+</button>
        </div>
      </div>
      ${med.batchNumber ? `
      <div class="summary-row">
        <span class="summary-label">رقم التشغيلة:</span>
        <span class="summary-val" style="font-family: monospace;">${escapeHtml(med.batchNumber)}</span>
      </div>` : ""}

      <!-- قسم أسعار الصيدلية (شراء، جملة، قطاعي وهامش الربح) -->
      <div style="border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">أسعار الصيدلية وهامش الربح:</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
          <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.2); padding: 7px 4px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94a3b8;">سعر الشراء</div>
            <strong style="font-size: 0.95rem; color: #cbd5e1;">${med.purchasePrice ? escapeHtml(med.purchasePrice) + ' ج' : '-'}</strong>
          </div>
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); padding: 7px 4px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #38bdf8;">سعر الجملة</div>
            <strong style="font-size: 0.95rem; color: #38bdf8;">${med.wholesalePrice ? escapeHtml(med.wholesalePrice) + ' ج' : '-'}</strong>
          </div>
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 7px 4px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #34d399;">سعر القطاعي</div>
            <strong style="font-size: 0.95rem; color: #34d399;">${med.price ? escapeHtml(med.price) + ' ج' : '-'}</strong>
          </div>
        </div>
        ${(med.price && med.purchasePrice && med.price > med.purchasePrice) ? `
        <div style="margin-top: 8px; font-size: 0.78rem; color: #34d399; background: rgba(16, 185, 129, 0.08); padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span>هامش ربح البيع القطاعي:</span>
          <strong>${(med.price - med.purchasePrice).toFixed(1)} جنيه</strong>
        </div>` : ""}
        ${(med.wholesalePrice && med.purchasePrice && med.wholesalePrice > med.purchasePrice) ? `
        <div style="margin-top: 4px; font-size: 0.78rem; color: #38bdf8; background: rgba(56, 189, 248, 0.08); padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span>هامش ربح بيع الجملة:</span>
          <strong>${(med.wholesalePrice - med.purchasePrice).toFixed(1)} جنيه</strong>
        </div>` : ""}
      </div>
    </div>

    ${aiReportHtml}
  `;

  document.getElementById("modalDetails").classList.add("active");
}

/**
 * فتح نافذة إضافة / تعديل صنف (مبسّطة: بدون صورة وبدون ملاحظات تماماً)
 */
function openAddModal(itemToEdit = null) {
  const form = document.getElementById("medForm");
  form.reset();
  document.getElementById("medId").value = "";

  const aiFeedbackBox = document.getElementById("aiLiveFeedback");
  if (aiFeedbackBox) aiFeedbackBox.style.display = "none";

  if (itemToEdit) {
    document.getElementById("modalFormTitle").textContent = "تعديل بيانات الصنف";
    document.getElementById("medId").value = itemToEdit.id;
    document.getElementById("medName").value = itemToEdit.name || "";
    document.getElementById("medGeneric").value = itemToEdit.genericName || "";
    document.getElementById("medCategory").value = itemToEdit.category || "مضادات حيوية";
    document.getElementById("medProdDate").value = itemToEdit.productionDate || "";
    document.getElementById("medExpDate").value = itemToEdit.expiryDate || "";
    document.getElementById("medQuantity").value = itemToEdit.quantity ?? 1;
    document.getElementById("medMinQuantity").value = itemToEdit.minQuantity ?? 5;
    document.getElementById("medPurchasePrice").value = itemToEdit.purchasePrice ?? "";
    document.getElementById("medWholesalePrice").value = itemToEdit.wholesalePrice ?? "";
    document.getElementById("medPrice").value = itemToEdit.price ?? "";
    document.getElementById("medBatch").value = itemToEdit.batchNumber || "";
  } else {
    document.getElementById("modalFormTitle").textContent = "إضافة صنف علاجي جديد";
    document.getElementById("medQuantity").value = "1";
    document.getElementById("medMinQuantity").value = "5";
    document.getElementById("medPurchasePrice").value = "";
    document.getElementById("medWholesalePrice").value = "";
    document.getElementById("medPrice").value = "";
    document.getElementById("medBatch").value = "";
  }

  document.getElementById("modalForm").classList.add("active");
}

/**
 * فحص اسم الدواء مباشرة أثناء الكتابة بالذكاء الاصطناعي البيطري
 */
function checkMedicineNameLive() {
  const nameInput = document.getElementById("medName");
  const aiFeedbackBox = document.getElementById("aiLiveFeedback");
  if (!nameInput || !aiFeedbackBox) return;

  const val = nameInput.value.trim();
  if (val.length < 2) {
    aiFeedbackBox.style.display = "none";
    return;
  }

  const analysis = window.analyzeMedicineOffline(val);
  aiFeedbackBox.style.display = "block";

  if (analysis.isDrug) {
    if (analysis.matched) {
      aiFeedbackBox.style.background = "rgba(16, 185, 129, 0.1)";
      aiFeedbackBox.style.borderColor = "rgba(16, 185, 129, 0.3)";
      aiFeedbackBox.style.color = "#34d399";
      aiFeedbackBox.innerHTML = `<strong>دواء بيطري معتمد:</strong> ${escapeHtml(analysis.arName)} - ${escapeHtml(analysis.category)}`;

      // ملء المادة الفعالة تلقائياً إذا كانت فارغة
      const genericInput = document.getElementById("medGeneric");
      if (genericInput && !genericInput.value.trim() && analysis.arName) {
        genericInput.value = analysis.arName;
      }
    } else {
      aiFeedbackBox.style.background = "rgba(56, 189, 248, 0.1)";
      aiFeedbackBox.style.borderColor = "rgba(56, 189, 248, 0.25)";
      aiFeedbackBox.style.color = "#38bdf8";
      aiFeedbackBox.innerHTML = `<strong>مستحضر بيطري:</strong> سيتم تسجيل وحفظ الصنف محلياً بالصيدلية`;
    }
  } else {
    aiFeedbackBox.style.background = "rgba(239, 68, 68, 0.1)";
    aiFeedbackBox.style.borderColor = "rgba(239, 68, 68, 0.3)";
    aiFeedbackBox.style.color = "#f87171";
    aiFeedbackBox.innerHTML = `<strong>تنبيه:</strong> ${escapeHtml(analysis.message || "يرجى كتابة اسم مستحضر دوائي صالح")}`;
  }
}

/**
 * حفظ الصنف (يشمل سعر الشراء، سعر الجملة، وسعر البيع القطاعي)
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("medId").value;
  const name = document.getElementById("medName").value.trim();
  const genericName = document.getElementById("medGeneric").value.trim();
  const category = document.getElementById("medCategory").value;
  const productionDate = document.getElementById("medProdDate").value;
  const expiryDate = document.getElementById("medExpDate").value;
  const quantity = parseInt(document.getElementById("medQuantity").value, 10) || 0;
  const minQuantity = parseInt(document.getElementById("medMinQuantity").value, 10) || 5;
  const purchasePrice = parseFloat(document.getElementById("medPurchasePrice").value) || 0;
  const wholesalePrice = parseFloat(document.getElementById("medWholesalePrice").value) || 0;
  const price = parseFloat(document.getElementById("medPrice").value) || 0;
  const batchNumber = document.getElementById("medBatch").value.trim();

  if (!name || !expiryDate) {
    alert("يرجى إدخال اسم الصنف وتاريخ الانتهاء على الأقل.");
    return;
  }

  const payload = {
    name,
    genericName,
    category,
    productionDate,
    expiryDate,
    quantity,
    minQuantity,
    purchasePrice,
    wholesalePrice,
    price,
    batchNumber
  };

  if (id) {
    await window.vetDB.update(id, payload);
  } else {
    await window.vetDB.add(payload);
  }

  closeModal("modalForm");
  await loadMedicines();
  if (window.cloudSync) {
    window.cloudSync.pushToCloud();
  }
}

/**
 * حذف الصنف الحالي
 */
async function handleDeleteCurrent() {
  if (!currentViewItem) return;
  if (confirm(`هل أنت متأكد من حذف صنف "${currentViewItem.name}"؟`)) {
    await window.vetDB.delete(currentViewItem.id);
    closeModal("modalDetails");
    await loadMedicines();
    if (window.cloudSync) {
      window.cloudSync.pushToCloud();
    }
  }
}

/**
 * تعديل الصنف الحالي
 */
function handleEditCurrent() {
  if (!currentViewItem) return;
  const item = currentViewItem;
  closeModal("modalDetails");
  openAddModal(item);
}

/**
 * إغلاق أي نافذة منبثقة
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

/**
 * تصفية القائمة بالفلاتر
 */
function setFilter(filterName) {
  currentFilter = filterName;

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === filterName);
  });

  document.querySelectorAll(".stat-card").forEach((card) => {
    card.classList.toggle("active-filter", card.dataset.filter === filterName);
  });

  renderList();
}

/**
 * تصدير نسخة احتياطية (يدعم الحفظ على أندرويد والمشاركة على آيفون)
 */
async function handleExport() {
  const jsonStr = await window.vetDB.exportBackup();
  if (window.AndroidBridge && window.AndroidBridge.exportBackupToAndroid) {
    window.AndroidBridge.exportBackupToAndroid(jsonStr);
    return;
  }
  try {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mansour-vet-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    handleCopyBackup();
  }
}

/**
 * نسخ كود النسخة الاحتياطية بالكامل للحافظة (متوافق 100% مع كافة الأجهزة)
 */
async function handleCopyBackup() {
  try {
    const jsonStr = await window.vetDB.exportBackup();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(jsonStr);
      alert("تم نسخ كود النسخة الاحتياطية بنجاح إلى الحافظة. يمكنك الآن لصقه في محادثة واتساب أو حفظه في الملاحظات لنقله لأي جهاز.");
    } else {
      const textarea = document.getElementById("backupTextarea");
      if (textarea) {
        textarea.value = jsonStr;
        textarea.select();
        document.execCommand("copy");
        alert("تم نسخ كود النسخة الاحتياطية بنجاح إلى الحافظة.");
      }
    }
  } catch (e) {
    const textarea = document.getElementById("backupTextarea");
    if (textarea) {
      const jsonStr = await window.vetDB.exportBackup();
      textarea.value = jsonStr;
      alert("تم عرض كود النسخة في المربع أدناه، يمكنك تحديده ونسخه يدوياً.");
    } else {
      alert("تعذر النسخ التلقائي: " + e.message);
    }
  }
}

/**
 * مشاركة النسخة الاحتياطية مباشرة (واتساب / درايف / ملاحظات)
 */
async function handleShareBackup() {
  const jsonStr = await window.vetDB.exportBackup();
  if (window.AndroidBridge && window.AndroidBridge.exportBackupToAndroid) {
    window.AndroidBridge.exportBackupToAndroid(jsonStr);
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({
        title: "نسخة احتياطية Mansour Vet",
        text: jsonStr
      });
    } catch (e) {
      console.log("Share cancelled or dismissed");
    }
  } else {
    handleCopyBackup();
  }
}

/**
 * استيراد واستعادة النسخة الاحتياطية من الكود الملصوق
 */
async function handleTextImport() {
  const textarea = document.getElementById("backupTextarea");
  const text = textarea ? textarea.value.trim() : "";
  if (!text) {
    alert("يرجى لصق كود النسخة الاحتياطية في المربع أولاً ثم الضغط على استعادة.");
    return;
  }

  const res = await window.vetDB.importBackup(text);
  if (res.success) {
    alert(`تمت استعادة ${res.count} صنف بنجاح.`);
    closeModal("modalBackup");
    if (textarea) textarea.value = "";
    await loadMedicines();
    if (window.cloudSync) {
      window.cloudSync.pushToCloud();
    }
  } else {
    alert("حدث خطأ في قراءة كود النسخة الاحتياطية: " + res.error);
  }
}

/**
 * استيراد نسخة احتياطية من ملف
 */
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (event) {
    const res = await window.vetDB.importBackup(event.target.result);
    if (res.success) {
      alert(`تمت استعادة ${res.count} صنف بنجاح.`);
      closeModal("modalBackup");
      await loadMedicines();
      if (window.cloudSync) {
        window.cloudSync.pushToCloud();
      }
    } else {
      alert("حدث خطأ في قراءة ملف النسخة الاحتياطية: " + res.error);
    }
  };
  reader.readAsText(file);
}

/**
 * حماية وتطهير النصوص
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * تهيئة التطبيق عند اكتمال تحميل DOM
 */
document.addEventListener("DOMContentLoaded", async () => {
  await window.vetDB.init();
  checkAuthAndInit();

  // تهيئة محرك المزامنة السحابية المشتركة
  if (window.cloudSync) {
    window.cloudSync.init();
  }

  // أحداث تسجيل الدخول والأمان
  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("securityForm").addEventListener("submit", handleSecuritySubmit);

  // أحداث البحث
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  // أحداث حفظ الأدوية
  document.getElementById("medForm").addEventListener("submit", handleFormSubmit);

  // الفحص اللحظي لاسم الدواء بالذكاء الاصطناعي
  const medNameInput = document.getElementById("medName");
  if (medNameInput) {
    medNameInput.addEventListener("input", checkMedicineNameLive);
  }

  // أحداث القائمة الآمنة (Event Delegation - XSS Safe)
  const medListContainer = document.getElementById("medicinesList");
  if (medListContainer) {
    medListContainer.addEventListener("click", async (e) => {
      const stockBtn = e.target.closest(".stock-btn");
      if (stockBtn) {
        e.stopPropagation();
        const action = stockBtn.dataset.action;
        const id = stockBtn.dataset.id;
        if (action === "inc-stock") await changeStock(id, 1);
        else if (action === "dec-stock") await changeStock(id, -1);
        return;
      }
      const card = e.target.closest(".med-card");
      if (card && card.dataset.id) {
        openDetailsModal(card.dataset.id);
      }
    });
  }

  // إخفاء/إظهار كلمة المرور
  const togglePassBtn = document.getElementById("togglePassBtn");
  if (togglePassBtn) {
    togglePassBtn.addEventListener("click", () => {
      const passInput = document.getElementById("loginPassword");
      passInput.type = passInput.type === "password" ? "text" : "password";
    });
  }

  // إغلاق النوافذ المنبثقة بالنقر الصريح على الخلفية المظلمة فقط
  let overlayPointerDownTarget = null;
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("pointerdown", (e) => {
      overlayPointerDownTarget = e.target;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && overlayPointerDownTarget === overlay) {
        overlay.classList.remove("active");
      }
      overlayPointerDownTarget = null;
    });
  });
});
