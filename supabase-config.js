// =====================================================================
// supabase-config.js - الإعداد المركزي لـ Supabase
// =====================================================================

(function () {
  const SUPABASE_URL     = 'https://unmmontcbergytlqfpbn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubW1vbnRjYmVyZ3l0bHFmcGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI2NTAsImV4cCI6MjA5NTI5ODY1MH0.tpfcmKB9f3VO2IDvuw4I2AVEXH2ylGfwUtqIwdo-gw4';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] UMD غير محمّل. تأكد من وجود سكريبت Supabase قبل هذا الملف.');
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:      true,
        autoRefreshToken:    true,
        detectSessionInUrl:  false,   // يمنع تسريب التوكن في URL
      },
      global: {
        headers: { 'x-application-name': 'basmat-da3m-website' },
      },
    });

    // ── قائمة الجداول المسموح بها (تمنع استغلال API باسم جدول مزيّف) ──
    const ALLOWED_TABLES = [
      'news', 'courses', 'ambassadors', 'partners',
      'registrations', 'site_settings', 'achievements',
      'org_structure', 'org_members', 'tasks', 'chat_messages',
    ];

    // ── Wrapper آمن لكل الاستعلامات ──
    window.sbQuery = async function (table, queryFn) {
      if (!window.supabaseClient) return { data: null, error: new Error('Supabase غير متاح') };
      if (!ALLOWED_TABLES.includes(table)) {
        console.error(`[sbQuery] جدول غير مسموح به: ${table}`);
        return { data: null, error: new Error('جدول غير مسموح به') };
      }
      try {
        const result = await queryFn(window.supabaseClient.from(table));
        if (result.error) console.error(`[sbQuery] خطأ في "${table}":`, result.error.message);
        return result;
      } catch (err) {
        console.error(`[sbQuery] استثناء:`, err.message);
        return { data: null, error: err };
      }
    };

    // ── Cache بسيط في الذاكرة (5 دقائق) لتقليل الطلبات المتكررة ──
    const _cache = new Map();
    const CACHE_TTL = 5 * 60 * 1000;

    window.sbCachedQuery = async function (cacheKey, table, queryFn) {
      const now    = Date.now();
      const cached = _cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return { data: cached.data, error: null, fromCache: true };
      }
      const result = await window.sbQuery(table, queryFn);
      if (result.data && !result.error) {
        _cache.set(cacheKey, { data: result.data, timestamp: now });
      }
      return result;
    };

    // مسح الكاش عند تسجيل الخروج
    window.supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') _cache.clear();
    });

  } catch (e) {
    console.error('[Supabase] فشل إنشاء العميل:', e.message);
  }
})();
