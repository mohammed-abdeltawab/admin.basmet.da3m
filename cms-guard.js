// ====================== cms-guard.js - مبادرة بصمة دعم ======================
// Authentication guard for CMS pages - checks Supabase session

(async function checkGuard() { // ✅ التعديل هنا: إضافة كلمة async
    // Wait for Supabase client to be loaded
    if (!window.supabaseClient) {
        // Retry after a short delay
        setTimeout(checkGuard, 100); 
        return;
    }

    try {
        // Check if there's an active Supabase session
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();

        if (error) {
            console.error('Auth check error:', error);
            redirectToLogin();
            return;
        }

        if (!session || !session.user) {
            // No active session - redirect to login
            console.warn('No active session found');
            redirectToLogin();
            return;
        }

        // Session is valid - user can access CMS
        console.log('CMS access granted for:', session.user.email);
        
    } catch (err) {
        console.error('Unexpected error during auth check:', err);
        redirectToLogin();
    }

    function redirectToLogin() {
        window.location.href = 'admin-login.html';
    }
})();