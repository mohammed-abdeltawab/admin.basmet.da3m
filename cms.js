// =====================================================================
// cms.js - مبادرة بصمة دعم
// CMS Admin Dashboard Logic - النسخة المستقرة والمصححة برمجياً بالكامل
// مدمج بها نظام إدارة الهيكل التنظيمي (org_structure) بدون أكواد HTML للمستخدم
// =====================================================================

// 1️⃣ تعريف الصورة الاحتياطية الافتراضية (SVG مدمج لا يحتاج لإنترنت ولا يسقط أبداً)
const DEFAULT_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><rect width='100%' height='100%' fill='%23222'/><text x='50%' y='50%' font-family='sans-serif' font-size='14' fill='%23555' dominant-baseline='middle' text-anchor='middle'>No Image</text></svg>";

// 2️⃣ الدالة الذكية لكسر الحلقة اللانهائية وإصلاح أخطاء روابط الصور التالفة فوراً
function handleImageError(imageElement) {
    imageElement.onerror = null; // كسر الحلقة اللانهائية فوراً
    imageElement.src = DEFAULT_IMAGE; // وضع الصورة الافتراضية النظيفة
}

let currentTable = 'dashboard';
let currentId = null;

// عند تحميل الصفحة سحابياً
document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabaseClient) {
        try {
            // جلب بيانات المستخدم الحالي من الجلسة السحابية
            const { data: { user }, error } = await window.supabaseClient.auth.getUser();
            
            // 🔒 شرط الحماية الصارم: إذا كان المستخدم مسجل دخوله بنجاح
            if (user && !error) {
                // عرض بيانات المسؤول في الهيدر
                if (document.getElementById('admin-name')) document.getElementById('admin-name').textContent = user.email;
                if (document.getElementById('avatar')) document.getElementById('avatar').textContent = user.email.charAt(0).toUpperCase();

                // جلب دور المستخدم الحالي (owner/admin/editor/support) وإظهار صفحة إدارة الفريق لو مصرح له
                try {
                    const { data: roleRow } = await window.supabaseClient.from('user_roles').select('role').eq('user_id', user.id).single();
                    window.currentUserRole = roleRow ? roleRow.role : null;
                } catch (e) {
                    window.currentUserRole = null;
                }
                if (window.currentUserRole === 'owner' || window.currentUserRole === 'admin') {
                    const navTeam = document.getElementById('nav-team');
                    if (navTeam) navTeam.style.display = '';
                }

                // تفعيل لوحة التحكم وسحب البيانات فقط للمصرح لهم
                loadDashboard();
            } else {
                // إذا لم يجد مستخدم، اطرد المتسلل فوراً لصفحة الدخول
                console.warn("إمكانية وصول غير مصرح بها! جاري إعادة التوجيه...");
                window.location.href = 'admin-login.html';
            }
        } catch (e) {
            console.error('حدث خطأ أثناء فحص الحماية السحابية:', e);
            window.location.href = 'admin-login.html';
        }
    } else {
        // في حال عدم تحميل مكتبة Supabase لأي سبب
        console.error('Supabase Client غير معرف!');
        window.location.href = 'admin-login.html';
    }
});

function toggleMobileMenu() {
    document.getElementById('cms-sidebar').classList.toggle('open');
}

function switchPage(pageName) {
    currentTable = pageName;
    
    document.querySelectorAll('.cms-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.cms-nav-item').forEach(n => n.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');
    
    const activeBtn = document.querySelector(`.cms-nav-item[data-target="${pageName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.getElementById('cms-sidebar').classList.remove('open');

    if (pageName === 'dashboard') loadDashboard();
    if (pageName === 'settings') loadSiteSettings();
    if (pageName === 'registrations') loadRegistrations();
    if (pageName === 'messages') loadMessages();
    if (pageName === 'ambassadors') loadAmbassadors();
    if (pageName === 'news') loadNews();
    if (pageName === 'courses') loadCourses();
    if (pageName === 'partners') loadPartners();
    if (pageName === 'org_structure') loadOrgStructure(); // تفعيل جلب بيانات الهيكل التنظيمي
    if (pageName === 'team') loadTeam();
}

let govChartInstance = null;
let timeChartInstance = null;
let skillsChartInstance = null;

async function loadDashboard() {
    try {
        // سحب كافة البيانات بالتوازي وبسرعة فائقة شاملة جدول الزيارات الجديد
        const [regResponse, amb, part, cr, visitsResponse] = await Promise.all([
            window.supabaseClient.from('registrations').select('name_ar, governorate, created_at, skill_video, skill_design, skill_voice, skill_media, skill_social, skill_content').order('created_at', { ascending: false }),
            window.supabaseClient.from('ambassadors').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('partners').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('courses').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('site_visits').select('created_at')
        ]);

        const regData = regResponse.data || [];
        const visitsData = visitsResponse.data || [];

        // 1. تحديث الأرقام السريعة والكروت في الواجهة
        if (document.getElementById('stat-total-views')) document.getElementById('stat-total-views').textContent = visitsData.length;
        if (document.getElementById('stat-reg-count')) document.getElementById('stat-reg-count').textContent = regData.length;
        if (document.getElementById('stat-amb-count')) document.getElementById('stat-amb-count').textContent = amb.count || 0;
        if (document.getElementById('stat-partners-count')) document.getElementById('stat-partners-count').textContent = part.count || 0;
        if (document.getElementById('stat-course-count')) document.getElementById('stat-course-count').textContent = cr.count || 0;

        // 2. تحليل وقت الذروة للزيارات وعرضه
        calculatePeakHour(visitsData);

        // 3. تحليل مصفوفات البيانات وتحويلها لرسوم بيانية
        processAdvancedCharts(regData);

        // 4. تحديث جدول النشاط حي (أحدث 5 تسجيلات)
        updateRecentActivity(regData.slice(0, 5));

    } catch (e) { 
        console.error('Dashboard failed:', e); 
        showToast('حدث خطأ أثناء معالجة الإحصائيات المتقدمة', 'error');
    }
}

function calculatePeakHour(visits) {
    const peakElement = document.getElementById('stat-peak-time');
    if (!peakElement) return;

    if (visits.length === 0) {
        peakElement.textContent = "لا توجد زيارات بعد";
        return;
    }

    const hourCounts = Array(24).fill(0);
    visits.forEach(v => {
        if (v.created_at) {
            const hour = new Date(v.created_at).getHours();
            hourCounts[hour]++;
        }
    });

    let maxVisits = -1;
    let peakHour = 0;
    for (let i = 0; i < 24; i++) {
        if (hourCounts[i] > maxVisits) {
            maxVisits = hourCounts[i];
            peakHour = i;
        }
    }

    let formattedHour = '';
    if (peakHour === 0) formattedHour = "12 منتصف الليل";
    else if (peakHour === 12) formattedHour = "12 ظهراً";
    else if (peakHour > 12) formattedHour = (peakHour - 12) + " مساءً";
    else formattedHour = peakHour + " صباحاً";

    peakElement.innerHTML = `<i class="far fa-clock" style="color:var(--gold)"></i> ${formattedHour} <span style="font-size:11px; display:block; color:#64748b; font-weight:normal;">(${maxVisits} زيارة)</span>`;
}

function processAdvancedCharts(registrations) {
    const govCounts = {};
    const dateCounts = {};
    const skillsCounts = { 'المونتاج': 0, 'التصميم': 0, 'التعليق الصوتي': 0, 'الإعلام': 0, 'السوشيال ميديا': 0, 'كتابة المحتوى': 0 };

    registrations.forEach(reg => {
        const gov = reg.governorate && reg.governorate.trim() !== '' ? reg.governorate : 'أخرى';
        govCounts[gov] = (govCounts[gov] || 0) + 1;

        if (reg.created_at) {
            const dateStr = new Date(reg.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
        }

        if (reg.skill_video) skillsCounts['المونتاج']++;
        if (reg.skill_design) skillsCounts['التصميم']++;
        if (reg.skill_voice) skillsCounts['التعليق الصوتي']++;
        if (reg.skill_media) skillsCounts['الإعلام']++;
        if (reg.skill_social) skillsCounts['السوشيال ميديا']++;
        if (reg.skill_content) skillsCounts['كتابة المحتوى']++;
    });

    const sortedGovs = Object.entries(govCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    renderChart('govChart', 'doughnut', sortedGovs.map(i => i[0]), sortedGovs.map(i => i[1]));

    const dateLabels = Object.keys(dateCounts).slice(-14);
    renderChart('timeChart', 'line', dateLabels, dateLabels.map(l => dateCounts[l]));

    renderChart('skillsChart', 'bar', Object.keys(skillsCounts), Object.values(skillsCounts));
}

function renderChart(canvasId, type, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (canvasId === 'govChart' && govChartInstance) govChartInstance.destroy();
    if (canvasId === 'timeChart' && timeChartInstance) timeChartInstance.destroy();
    if (canvasId === 'skillsChart' && skillsChartInstance) skillsChartInstance.destroy();

    const config = {
        type: type,
        data: {
            labels: labels.length > 0 ? labels : ['لا يوجد بيانات'],
            datasets: [{
                label: 'العدد المتاح',
                data: data.length > 0 ? data : [0],
                backgroundColor: type === 'line' ? 'rgba(0, 102, 204, 0.1)' : ['#0066CC', '#F4A261', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'],
                borderColor: type === 'line' ? '#0066CC' : '#fff',
                borderWidth: type === 'line' ? 3 : 1,
                fill: type === 'line',
                tension: 0.3,
                borderRadius: type === 'bar' ? 6 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: type === 'doughnut', position: 'bottom', labels: { font: { family: 'Tajawal' } } } },
            scales: type !== 'doughnut' ? { y: { beginAtZero: true, ticks: { stepSize: 1 } } } : {}
        }
    };

    const newChart = new Chart(ctx, config);
    if (canvasId === 'govChart') govChartInstance = newChart;
    if (canvasId === 'timeChart') timeChartInstance = newChart;
    if (canvasId === 'skillsChart') skillsChartInstance = newChart;
}

function updateRecentActivity(recentRegs) {
    const tbody = document.getElementById('recent-activity-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (recentRegs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">لا توجد تسجيلات حتى الآن</td></tr>';
        return;
    }

    recentRegs.forEach(reg => {
        let skills = [];
        if (reg.skill_video) skills.push('مونتاج');
        if (reg.skill_design) skills.push('تصميم');
        if (reg.skill_voice) skills.push('فويس أوفر');
        if (reg.skill_content) skills.push('محتوى');

        const dateObj = new Date(reg.created_at);
        const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

        tbody.innerHTML += `
            <tr>
                <td><strong>${escapeHtml(reg.name_ar)}</strong></td>
                <td>${escapeHtml(reg.governorate || '-')}</td>
                <td><span style="background: rgba(0,102,204,0.1); color: #0066CC; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${skills.join('، ') || 'عام'}</span></td>
                <td><small style="color:#64748b;"><i class="far fa-clock"></i> ${dateStr} - ${timeStr}</small></td>
            </tr>
        `;
    });
}

async function loadSiteSettings() {
    const container = document.getElementById('settings-dynamic-fields');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--blue)">جاري سحب مفاتيح الإعدادات السحابية...</p>';
    try {
        const { data, error } = await window.supabaseClient.from('site_settings').select('*');
        if (error) throw error;
        container.innerHTML = '';
        data.forEach(setting => {
            container.innerHTML += `
                <div class="form-group" style="margin-bottom:20px;">
                    <label style="color:var(--blue); font-weight:bold;">${escapeHtml(setting.key)}</label>
                    <textarea class="form-control setting-input-field" data-key="${escapeHtml(setting.key)}" rows="2">${escapeHtml(setting.value || '')}</textarea>
                </div>
            `;
        });
    } catch (err) { showToast(err.message, 'error'); }
}

async function saveSiteSettings(e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.setting-input-field');
    try {
        for (let input of inputs) {
            const key = input.getAttribute('data-key');
            const value = input.value;
            await window.supabaseClient.from('site_settings').update({ value, updated_at: new Date() }).eq('key', key);
        }
        showToast('تم تحديث إعدادات ونصوص الواجهة للموقع بنجاح!');
    } catch (err) { showToast(err.message, 'error'); }
}

async function loadRegistrations() {
    const tbody = document.getElementById('registrations-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="13">جاري تحميل البيانات الشاملة للمتقدمين...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('registrations').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        tbody.innerHTML = '';
        const canApprove = window.currentUserRole === 'owner' || window.currentUserRole === 'admin';
        const STATUS_LABELS = { pending: 'قيد المراجعة', approved: 'تم القبول', rejected: 'مرفوض' };
        const STATUS_COLORS = { pending: '#F4A261', approved: 'var(--green)', rejected: 'var(--red)' };
        data.forEach(item => {
            let skills = [];
            if (item.skill_video) skills.push('مونتاج');
            if (item.skill_design) skills.push('تصميم');
            if (item.skill_voice) skills.push('فويس أوفر');
            if (item.skill_media) skills.push('إعلام');
            if (item.skill_social) skills.push('سوشيال media');
            if (item.skill_content) skills.push('كتابة محتوى');

            const status = item.approval_status || 'pending';
            let controlsHtml = `<span style="color:${STATUS_COLORS[status]}; font-weight:bold;">${STATUS_LABELS[status]}</span>`;
            if (canApprove) {
                controlsHtml += `
                    <div style="margin-top:6px; display:flex; gap:4px;">
                        <button class="btn-primary" style="background:var(--green); padding:4px 8px; font-size:11px;" onclick="setRegistrationStatus('${item.id}', 'approved')">قبول</button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:11px;" onclick="setRegistrationStatus('${item.id}', 'rejected')">رفض</button>
                    </div>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td data-label="الحالة">${controlsHtml}</td>
                    <td data-label="الاسم (عربي)"><strong>${escapeHtml(item.name_ar)}</strong></td>
                    <td data-label="الاسم (إنجليزي)">${escapeHtml(item.name_en || '-')}</td>
                    <td data-label="المحافظة">${escapeHtml(item.governorate || '-')}</td>
                    <td data-label="الواتساب"><a href="https://wa.me/${item.whatsapp}" target="_blank" style="color:var(--green); font-weight:bold;"><i class="fab fa-whatsapp"></i> ${escapeHtml(item.whatsapp)}</a></td>
                    <td data-label="الرقم القومي"><code>${escapeHtml(item.national_id || '-')}</code></td>
                    <td data-label="العنوان بالتفصيل"><small>${escapeHtml(item.address || '-')}</small></td>
                    <td data-label="الجنسية">${escapeHtml(item.nationality || '-')}</td>
                    <td data-label="الموقف من العمل">${escapeHtml(item.status_work || '-')}</td>
                    <td data-label="الخبرات"><small>${escapeHtml(item.experience || '-')}</small></td>
                    <td data-label="الكورسات المطلوبة"><small>${escapeHtml(item.courses || '-')}</small></td>
                    <td data-label="المهارات المحددة"><small>${skills.join(' ، ') || 'لا يوجد'}</small></td>
                    <td data-label="التاريخ"><small>${formatDateShort(item.created_at)}</small></td>
                </tr>
            `;
        });
    } catch (err) { tbody.innerHTML = `<tr><td colspan="13" style="color:var(--red);">${err.message}</td></tr>`; }
}

async function setRegistrationStatus(id, status) {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const { error } = await window.supabaseClient.from('registrations').update({
            approval_status: status,
            reviewed_by: user?.email || null,
            reviewed_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw error;
        showToast(status === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب');
        loadRegistrations();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}

async function loadMessages() {
    const tbody = document.getElementById('messages-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('chat_leads').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        tbody.innerHTML = '';
        const canDelete = window.currentUserRole === 'owner' || window.currentUserRole === 'admin';
        (data || []).forEach(item => {
            const reviewed = !!item.is_reviewed;
            let controlsHtml = `
                <button class="btn-primary" style="background:${reviewed ? '#888' : 'var(--green)'}; padding:4px 8px; font-size:11px;" onclick="toggleLeadReviewed('${item.id}', ${!reviewed})">
                    ${reviewed ? 'إلغاء المتابعة' : 'تمت المتابعة'}
                </button>`;
            if (canDelete) {
                controlsHtml += ` <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:11px;" onclick="deleteLead('${item.id}')"><i class="fas fa-trash"></i></button>`;
            }
            tbody.innerHTML += `
                <tr>
                    <td data-label="الحالة"><span style="color:${reviewed ? 'var(--green)' : '#F4A261'}; font-weight:bold;">${reviewed ? 'تمت المتابعة' : 'جديدة'}</span></td>
                    <td data-label="الاسم">${escapeHtml(item.name || '-')}</td>
                    <td data-label="الهاتف">${item.phone ? `<a href="https://wa.me/${item.phone}" target="_blank" style="color:var(--green); font-weight:bold;"><i class="fab fa-whatsapp"></i> ${escapeHtml(item.phone)}</a>` : '-'}</td>
                    <td data-label="الملاحظة"><small>${escapeHtml(item.note || '-')}</small></td>
                    <td data-label="التاريخ"><small>${formatDateShort(item.created_at)}</small></td>
                    <td data-label="التحكم">${controlsHtml}</td>
                </tr>
            `;
        });
        if ((data || []).length === 0) tbody.innerHTML = '<tr><td colspan="6">لا يوجد رسائل بعد</td></tr>';
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);">${err.message}</td></tr>`; }
}

async function toggleLeadReviewed(id, newValue) {
    try {
        const { error } = await window.supabaseClient.from('chat_leads').update({ is_reviewed: newValue }).eq('id', id);
        if (error) throw error;
        loadMessages();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}

async function deleteLead(id) {
    if (!confirm('تأكيد حذف الرسالة؟')) return;
    try {
        const { error } = await window.supabaseClient.from('chat_leads').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف');
        loadMessages();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}

async function loadAmbassadors() {
    const tbody = document.getElementById('ambassadors-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('ambassadors').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        tbody.innerHTML = '';
        data.forEach(item => {
            const img = (item.image_url && item.image_url.trim() !== "") ? item.image_url : DEFAULT_IMAGE;
            tbody.innerHTML += `
                <tr>
                    <td data-label="الصورة"><img src="${img}" width="40" height="40" style="border-radius:50%; object-fit:cover;" onerror="handleImageError(this)"></td>
                    <td data-label="الاسم بالكامل"><strong>${escapeHtml(item.full_name)}</strong></td>
                    <td data-label="المدينة/المحافظة">${escapeHtml(item.city || '-')}</td>
                    <td data-label="النبذة (Bio)"><small>${escapeHtml(item.bio || '-')}</small></td>
                    <td data-label="الترتيب">${item.display_order}</td>
                    <td data-label="التحكم">
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="editCrudItem('ambassadors', '${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px;" onclick="deleteCrudItem('ambassadors', '${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

async function loadNews() {
    const tbody = document.getElementById('news-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">جاري التحميل...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('news').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        tbody.innerHTML = '';
        data.forEach(item => {
            const img = (item.image_url && item.image_url.trim() !== "") ? item.image_url : DEFAULT_IMAGE;
            tbody.innerHTML += `
                <tr>
                    <td data-label="صورة الخبر"><img src="${img}" width="50" style="border-radius:4px;" onerror="handleImageError(this)"></td>
                    <td data-label="العنوان الرئيس"><strong>${escapeHtml(item.title)}</strong></td>
                    <td data-label="التصنيف">${escapeHtml(item.category || '-')}</td>
                    <td data-label="المحتوى"><small>${escapeHtml(item.content || '-')}</small></td>
                    <td data-label="حالة العرض">${item.is_visible ? 'ظاهر 👁️' : 'مخفي 📁'}</td>
                    <td data-label="الترتيب">${item.display_order}</td>
                    <td data-label="التحكم">
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="editCrudItem('news', '${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px;" onclick="deleteCrudItem('news', '${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

async function loadCourses() {
    const tbody = document.getElementById('courses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">جاري التحميل...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('courses').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        tbody.innerHTML = '';
        data.forEach(item => {
            const img = (item.image_url && item.image_url.trim() !== "") ? item.image_url : DEFAULT_IMAGE;
            tbody.innerHTML += `
                <tr>
                    <td data-label="غلاف الدورة"><img src="${img}" width="50" style="border-radius:4px;" onerror="handleImageError(this)"></td>
                    <td data-label="اسم الدورة"><strong>${escapeHtml(item.title)}</strong></td>
                    <td data-label="الوصف"><small>${escapeHtml(item.description || '-')}</small></td>
                    <td data-label="المقر / المكان">${escapeHtml(item.place || '-')}</td>
                    <td data-label="تاريخ وموعد الانعقاد">${escapeHtml(item.date_text || '-')}</td>
                    <td data-label="الحالة">${escapeHtml(item.status || '-')}</td>
                    <td data-label="رابط الاستمارة"><small>${escapeHtml(item.register_link || '-')}</small></td>
                    <td data-label="الترتيب">${item.display_order}</td>
                    <td data-label="التحكم">
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="editCrudItem('courses', '${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px;" onclick="deleteCrudItem('courses', '${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

async function loadPartners() {
    const tbody = document.getElementById('partners-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('partners').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        tbody.innerHTML = '';
        data.forEach(item => {
            const img = (item.logo_url && item.logo_url.trim() !== "") ? item.logo_url : DEFAULT_IMAGE;
            tbody.innerHTML += `
                <tr>
                    <td data-label="الشعار (Logo)"><img src="${img}" width="50" style="max-height:40px; object-fit:contain;" onerror="handleImageError(this)"></td>
                    <td data-label="اسم الجهة/الشركة"><strong>${escapeHtml(item.name)}</strong></td>
                    <td data-label="رابط الموقع الالكتروني"><small>${escapeHtml(item.website_url || '-')}</small></td>
                    <td data-label="الترتيب">${item.display_order}</td>
                    <td data-label="الظهور بالموقع">${item.is_visible ? 'نعم' : 'لا'}</td>
                    <td data-label="التحكم">
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="editCrudItem('partners', '${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px;" onclick="deleteCrudItem('partners', '${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

// 🌐 دالة جلب بيانات الهيكل التنظيمي وعرضها في جدول الـ CMS
async function loadOrgStructure() {
    const tbody = document.getElementById('org_structure-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">جاري تحميل بيانات الهيكل التنظيمي...</td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('org_structure').select('*').order('sort_order', { ascending: true });
        if (error) throw error;
        
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد بيانات حالياً. ابدأ بإضافة عضو!</td></tr>';
            return;
        }

        data.forEach(item => {
            let memberName = '-', memberRole = '-';
            try {
                // محاولة قراءة البيانات المخزنة بصيغة JSON نظيفة بدلاً من HTML
                const parsed = JSON.parse(item.content);
                memberName = parsed.name || '-';
                memberRole = parsed.role || '-';
            } catch (jsonErr) {
                memberName = 'بيانات نصية قديمة (يُرجى تحديثها)';
            }

            tbody.innerHTML += `
                <tr>
                    <td data-label="الترتيب"><span style="background: rgba(0,102,204,0.1); color: #0066CC; padding: 3px 8px; border-radius: 4px; font-weight:bold;">${item.sort_order}</span></td>
                    <td data-label="القسم التابع له"><strong>${escapeHtml(item.title)}</strong></td>
                    <td data-label="اسم العضو والمسمى الوظيفي">
                        <span style="display:block; font-weight:bold; color:var(--navy);">${escapeHtml(memberName)}</span>
                        <span style="font-size:12px; color:var(--muted);">${escapeHtml(memberRole)}</span>
                    </td>
                    <td data-label="التحكم">
                        <button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="editCrudItem('org_structure', '${item.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px;" onclick="deleteCrudItem('org_structure', '${item.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--red); text-align:center;">${err.message}</td></tr>`;
    }
}

function openCrudModal(table) {
    currentId = null;
    const hiddenIdEl = document.getElementById('modal-item-id');
    if (hiddenIdEl) hiddenIdEl.value = '';
    
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = '';
    
    if (table === 'ambassadors') {
        document.getElementById('modal-title').textContent = 'إضافة سفير جديد';
        body.innerHTML = `
            <div class="form-group"><label>الاسم بالكامل</label><input type="text" id="field-full_name" class="form-control" required></div>
            <div class="form-group"><label>المدينة / المحافظة</label><input type="text" id="field-city" class="form-control"></div>
            <div class="form-group"><label>النبذة التعريفية (Bio)</label><textarea id="field-bio" class="form-control" rows="3"></textarea></div>
            <div class="form-group"><label>رابط صورة السفير (Image URL)</label><input type="text" id="field-image_url" class="form-control" placeholder="يمكن تركه فارغاً"></div>
            <div class="form-group"><label>ترتيب العرض</label><input type="number" id="field-display_order" class="form-control" value="0"></div>
        `;
    } else if (table === 'news') {
        document.getElementById('modal-title').textContent = 'إضافة خبر أو فعالية';
        body.innerHTML = `
            <div class="form-group"><label>عنوان الخبر الرئيسي</label><input type="text" id="field-title" class="form-control" required></div>
            <div class="form-group"><label>التصنيف</label><input type="text" id="field-category" class="form-control" placeholder="مثال: ورش عمل"></div>
            <div class="form-group"><label>نص ومحتوى الفعالية</label><textarea id="field-content" class="form-control" rows="4"></textarea></div>
            <div class="form-group"><label>رابط غلاف الصورة</label><input type="text" id="field-image_url" class="form-control" placeholder="يمكن تركه فارغاً"></div>
            <div class="form-group"><label>ترتيب العرض</label><input type="number" id="field-display_order" class="form-control" value="0"></div>
            <div class="form-group"><label>حالة الظهور الفوري</label><select id="field-is_visible" class="form-control"><option value="true">نعم، ظاهر للعموم</option><option value="false">حفظ كمسودة مخفية</option></select></div>
        `;
    } else if (table === 'courses') {
        document.getElementById('modal-title').textContent = 'إضافة دورة تدريبية';
        body.innerHTML = `
            <div class="form-group"><label>اسم الدورة</label><input type="text" id="field-title" class="form-control" required></div>
            <div class="form-group"><label>الوصف العام للكورس</label><textarea id="field-description" class="form-control" rows="3"></textarea></div>
            <div class="form-group"><label>المكان / المقر</label><input type="text" id="field-place" class="form-control"></div>
            <div class="form-group"><label>تاريخ وموعد الكورس</label><input type="text" id="field-date_text" class="form-control" placeholder="مثال: الأحد القادم 6 مساءً"></div>
            <div class="form-group"><label>الحالة التشغيلية</label><input type="text" id="field-status" class="form-control" placeholder="قادمة / منتهية"></div>
            <div class="form-group"><label>رابط استمارة التسجيل</label><input type="text" id="field-register_link" class="form-control"></div>
            <div class="form-group"><label>رابط صورة غلاف الكورس</label><input type="text" id="field-image_url" class="form-control" placeholder="يمكن تركه فارغاً"></div>
            <div class="form-group"><label>ترتيب العرض</label><input type="number" id="field-display_order" class="form-control" value="0"></div>
        `;
    } else if (table === 'partners') {
        document.getElementById('modal-title').textContent = 'إضافة شريك نجاح جديد';
        body.innerHTML = `
            <div class="form-group"><label>اسم الجهة/الشركة</label><input type="text" id="field-name" class="form-control" required></div>
            <div class="form-group"><label>وصف مختصر</label><input type="text" id="field-description" class="form-control" placeholder="اختياري"></div>
            <div class="form-group"><label>رابط الشعار (Logo URL)</label><input type="text" id="logo_url" class="form-control"></div>
            <div class="form-group"><label>رابط الموقع الإلكتروني</label><input type="text" id="field-website_url" class="form-control"></div>
            <div class="form-group"><label>ترتيب العرض</label><input type="number" id="field-display_order" class="form-control" value="0"></div>
            <div class="form-group">
                <label>الحالة بالموقع</label>
                <select id="field-is_visible" class="form-control">
                    <option value="true">تفعيل العرض (ظاهر)</option>
                    <option value="false">إيقاف مؤقت (مخفي)</option>
                </select>
            </div>
        `;
    } else if (table === 'org_structure') {
    document.getElementById('modal-title').textContent = 'إضافة عضو جديد للهيكل الإداري';
    // تحديد الأقسام المتاحة
    const departments = [
        "رئاسة بصمة دعم",
        "المكتب الاستشاري",
        "المركز الإعلامي والدعم الفني",
        "الإدارات الفرعية للمحافظات",
        "قسم الموارد البشرية",
        "قسم العلاقات العامة"
    ];
    
    let optionsHtml = departments.map(d => `<option value="${d}">${d}</option>`).join('');

    body.innerHTML = `
        <div class="form-group">
            <label>اختر القسم الرئيسي</label>
            <select id="org-title" class="form-control" required>
                ${optionsHtml}
            </select>
        </div>
        <div class="form-group"><label>اسم العضو بالكامل</label><input type="text" id="member-name" class="form-control" required></div>
        <div class="form-group"><label>المسمى الوظيفي / المنصب</label><input type="text" id="member-role" class="form-control" required></div>
        <div class="form-group"><label>رابط صورة العضو</label><input type="text" id="member-image" class="form-control"></div>
        <div class="form-group"><label>ترتيب العرض</label><input type="number" id="org-sort_order" class="form-control" value="0"></div>
    `;
}
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() { 
    document.getElementById('modal-overlay').classList.remove('show'); 
    currentId = null; 
}

async function handleCrudFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const hiddenIdEl = document.getElementById('modal-item-id');
    if (hiddenIdEl && hiddenIdEl.value.trim() !== '') {
        currentId = hiddenIdEl.value;
    }
    
    try {
        if (!window.supabaseClient) throw new Error('مكتبة سوبابيس (Supabase) لم تتحمل بعد!');

        let payload = {};

        if (currentTable === 'ambassadors') {
            payload = {
                full_name: document.getElementById('field-full_name').value.trim(),
                city: document.getElementById('field-city').value.trim(),
                bio: document.getElementById('field-bio').value.trim(),
                image_url: document.getElementById('field-image_url').value.trim(),
                display_order: parseInt(document.getElementById('field-display_order').value) || 0
            };
        } else if (currentTable === 'news') {
            payload = {
                title: document.getElementById('field-title').value.trim(),
                category: document.getElementById('field-category').value.trim(),
                content: document.getElementById('field-content').value.trim(),
                image_url: document.getElementById('field-image_url').value.trim(),
                display_order: parseInt(document.getElementById('field-display_order').value) || 0,
                is_visible: document.getElementById('field-is_visible').value === 'true'
            };
        } else if (currentTable === 'courses') {
            payload = {
                title: document.getElementById('field-title').value.trim(),
                description: document.getElementById('field-description').value.trim(),
                place: document.getElementById('field-place').value.trim(),
                date_text: document.getElementById('field-date_text').value.trim(),
                status: document.getElementById('field-status').value.trim(),
                register_link: document.getElementById('field-register_link').value.trim(),
                image_url: document.getElementById('field-image_url').value.trim(),
                display_order: parseInt(document.getElementById('field-display_order').value) || 0
            };
        } else if (currentTable === 'partners') {
            const isVisibleSelect = document.getElementById('field-is_visible');
            const calculatedVisibility = isVisibleSelect ? (isVisibleSelect.value === 'true') : true;

            payload = {
                name: document.getElementById('field-name').value.trim(),
                description: document.getElementById('field-description') ? document.getElementById('field-description').value.trim() : '',
                logo_url: document.getElementById('logo_url').value.trim(), 
                website_url: document.getElementById('field-website_url').value.trim(), 
                display_order: parseInt(document.getElementById('field-display_order').value) || 0,
                is_visible: calculatedVisibility
            };
        } else if (currentTable === 'org_structure') {
            // تجميع مدخلات العضو داخل كائن JSON نظيف قبل الحفظ
            const memberJson = {
                name: document.getElementById('member-name').value.trim(),
                role: document.getElementById('member-role').value.trim(),
                image: document.getElementById('member-image').value.trim()
            };
            
            payload = {
                title: document.getElementById('org-title').value.trim(),
                sort_order: parseInt(document.getElementById('org-sort_order').value) || 0,
                content: JSON.stringify(memberJson) // تخزين البيانات كـ JSON نصي لحماية قاعدة البيانات ومستندات DOM
            };
        }

        if (currentId) {
            const { error } = await window.supabaseClient.from(currentTable).update(payload).eq('id', currentId);
            if (error) throw error;
            showToast('تم تعديل السجل بنجاح.');
        } else {
            const { error } = await window.supabaseClient.from(currentTable).insert([payload]);
            if (error) throw error;
            showToast('تم إضافة السجل بنجاح.');
        }

        closeModal();
        switchPage(currentTable);

    } catch(err) { 
        console.error('[CMS Submit Error]:', err.message);
        showToast(err.message, 'error'); 
    }
}

async function editCrudItem(table, id) {
    openCrudModal(table);
    currentId = id;
    if (document.getElementById('modal-item-id')) {
        document.getElementById('modal-item-id').value = id;
    }
    try {
        const { data, error } = await window.supabaseClient.from(table).select('*').eq('id', id).single();
        if (error) throw error;
        
        if (table === 'ambassadors') {
            document.getElementById('field-full_name').value = data.full_name || '';
            document.getElementById('field-city').value = data.city || '';
            document.getElementById('field-bio').value = data.bio || '';
            document.getElementById('field-image_url').value = data.image_url || '';
            document.getElementById('field-display_order').value = data.display_order || 0;
        } else if (table === 'news') {
            document.getElementById('field-title').value = data.title || '';
            document.getElementById('field-category').value = data.category || '';
            document.getElementById('field-content').value = data.content || '';
            document.getElementById('field-image_url').value = data.image_url || '';
            document.getElementById('field-display_order').value = data.display_order || 0;
            document.getElementById('field-is_visible').value = data.is_visible ? 'true' : 'false';
        } else if (table === 'courses') {
            document.getElementById('field-title').value = data.title || '';
            document.getElementById('field-description').value = data.description || '';
            document.getElementById('field-place').value = data.place || '';
            document.getElementById('field-date_text').value = data.date_text || '';
            document.getElementById('field-status').value = data.status || '';
            document.getElementById('field-register_link').value = data.register_link || '';
            document.getElementById('field-image_url').value = data.image_url || '';
            document.getElementById('field-display_order').value = data.display_order || 0;
        } else if (table === 'partners') {
            document.getElementById('field-name').value = data.name || '';
            if (document.getElementById('field-description')) {
                document.getElementById('field-description').value = data.description || '';
            }
            document.getElementById('field-logo_url').value = data.logo_url || '';
            document.getElementById('field-website_url').value = data.website_url || '';
            document.getElementById('field-display_order').value = data.display_order || 0;
            document.getElementById('field-is_visible').value = data.is_visible ? 'true' : 'false';
        } else if (table === 'org_structure') {
    // نحدد القيمة في الـ select بناءً على البيانات القادمة من قاعدة البيانات
    const titleSelect = document.getElementById('org-title');
    titleSelect.value = data.title || ''; // سيقوم المتصفح باختيار القسم تلقائياً
    
    document.getElementById('org-sort_order').value = data.sort_order || 0;
    try {
        const parsed = JSON.parse(data.content);
        document.getElementById('member-name').value = parsed.name || '';
        document.getElementById('member-role').value = parsed.role || '';
        document.getElementById('member-image').value = parsed.image || '';
    } catch (jsonErr) {
        document.getElementById('member-name').value = '';
        document.getElementById('member-role').value = '';
        document.getElementById('member-image').value = '';
    }
}
    } catch(e) { showToast('خطأ بتحميل السجل', 'error'); }
}

async function deleteCrudItem(table, id) {
    if (!confirm('هل أنت متأكد من الحذف النهائي؟')) return;
    try {
        const { error } = await window.supabaseClient.from(table).delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح');
        switchPage(table);
    } catch (e) { showToast(e.message, 'error'); }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function escapeHtml(str) { return str ? str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }
function formatDateShort(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '-'; }

function handleLogout() {
    if (window.supabaseClient) {
        window.supabaseClient.auth.signOut().finally(() => {
            sessionStorage.clear();
            window.location.href = 'admin-login.html';
        });
    } else {
        window.location.href = 'admin-login.html';
    }
}

// ====================== إدارة الفريق والصلاحيات ======================

const ROLE_LABELS = {
    owner:   'مالك (Owner)',
    admin:   'أدمن',
    editor:  'محرر محتوى',
    support: 'متابع طلبات',
};

// الدور الحالي يقدر يضيف/يعدل الأدوار دي بس
function assignableRoles() {
    if (window.currentUserRole === 'owner') return ['admin', 'editor', 'support'];
    if (window.currentUserRole === 'admin') return ['editor', 'support'];
    return [];
}

async function loadTeam() {
    const tbody = document.getElementById('team-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    try {
        const { data, error } = await window.supabaseClient.from('user_roles').select('*').order('created_at', { ascending: true });
        if (error) throw error;

        tbody.innerHTML = '';
        (data || []).forEach(member => {
            const canManage = assignableRoles().includes(member.role) ||
                (window.currentUserRole === 'owner' && member.role !== 'owner');
            const isOwnerRow = member.role === 'owner';

            let controlsHtml = '';
            if (isOwnerRow) {
                controlsHtml = '<span style="color:#888;">محمي</span>';
            } else if (canManage) {
                const roleOptions = assignableRoles().map(r =>
                    `<option value="${r}" ${r === member.role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`
                ).join('');
                controlsHtml = `
                    <select class="form-control" style="display:inline-block; width:auto; padding:4px 8px; font-size:12px;" onchange="changeMemberRole('${member.id}', this.value)">
                        ${roleOptions}
                    </select>
                    <button class="btn-primary" style="background:var(--red); padding:4px 8px; font-size:12px; margin-right:6px;" onclick="removeMember('${member.id}')"><i class="fas fa-trash"></i></button>
                `;
            } else {
                controlsHtml = `<span>${ROLE_LABELS[member.role] || member.role}</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(member.email || '-')}</td>
                <td>${ROLE_LABELS[member.role] || member.role}</td>
                <td>${formatDateShort(member.created_at)}</td>
                <td>${controlsHtml}</td>
            `;
            tbody.appendChild(tr);
        });

        if ((data || []).length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">لا يوجد أعضاء بعد</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">حصل خطأ في تحميل الفريق</td></tr>';
        showToast('خطأ في تحميل الفريق: ' + e.message, 'error');
    }
}

function openTeamModal() {
    const roles = assignableRoles();
    if (roles.length === 0) {
        showToast('مالكش صلاحية إضافة أعضاء', 'error');
        return;
    }
    const select = document.getElementById('invite-role');
    select.innerHTML = roles.map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('');
    document.getElementById('invite-email').value = '';
    document.getElementById('team-modal-overlay').classList.add('show');
}

function closeTeamModal() {
    document.getElementById('team-modal-overlay').classList.remove('show');
}

async function submitInvite(e) {
    e.preventDefault();
    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;
    if (!email || !role) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري الإرسال...'; }

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) throw new Error('انتهت الجلسة، سجّل دخول تاني');

        const res = await fetch('https://unmmontcbergytlqfpbn.supabase.co/functions/v1/invite-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ email, role }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'حصل خطأ غير متوقع');

        showToast('تم إرسال الدعوة بنجاح');
        closeTeamModal();
        loadTeam();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'إرسال الدعوة'; }
    }
}

async function changeMemberRole(id, newRole) {
    try {
        const { error } = await window.supabaseClient.from('user_roles').update({ role: newRole }).eq('id', id);
        if (error) throw error;
        showToast('تم تحديث الدور بنجاح');
        loadTeam();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
        loadTeam();
    }
}

async function removeMember(id) {
    if (!confirm('هل أنت متأكد من إزالة العضو ده من الفريق؟')) return;
    try {
        const { error } = await window.supabaseClient.from('user_roles').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح');
        loadTeam();
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    }
}