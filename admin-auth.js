
        // ─────────────────────────────────────────────────────────────
        // LOGIN AUTHENTICATION
        // ─────────────────────────────────────────────────────────────
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_DURATION = 30; // seconds

        let loginAttempts = parseInt(localStorage.getItem('loginAttempts') || '0');
        let lockoutExpires = parseInt(localStorage.getItem('lockoutExpires') || '0');

        function showAlert(type, message) {
            const alertEl = document.getElementById(`alert-${type}`);
            const textEl = document.getElementById(`${type}-text`);
            
            alertEl.classList.remove('show');
            setTimeout(() => {
                textEl.textContent = message;
                alertEl.classList.add('show');
            }, 10);

            setTimeout(() => {
                alertEl.classList.remove('show');
            }, 4000);
        }

        // تم إصلاح الدالة لتستقبل الـ event وتغير الأيقونة بنجاح
        function togglePasswordVisibility(event) {
            const input = document.getElementById('password');
            const button = event.target.closest('button');
            const icon = button.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }

        async function handleLogin(event) {
            event.preventDefault();

            // Check if account is locked
            if (isAccountLocked()) {
                return;
            }

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('login-btn');
            const remember = document.getElementById('remember').checked;

            if (!email || !password) {
                showAlert('error', 'يرجى ملء جميع الحقول');
                return;
            }

            loginBtn.classList.add('loading');

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    throw error;
                }

                if (data.user) {
                    // Successful login
                    loginAttempts = 0;
                    localStorage.setItem('loginAttempts', '0');
                    
                    if (remember) {
                        localStorage.setItem('rememberedEmail', email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }

                    showAlert('success', 'تم تسجيل الدخول بنجاح!');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 800);
                }
            } catch (error) {
                loginAttempts++;
                localStorage.setItem('loginAttempts', loginAttempts.toString());

                // إزالة حالة الـ loading فوراً عند الفشل حتى لا يعلق الزر
                loginBtn.classList.remove('loading');

                if (loginAttempts >= MAX_ATTEMPTS) {
                    lockAccount();
                } else {
                    const remaining = MAX_ATTEMPTS - loginAttempts;
                    showAlert('error', `بيانات غير صحيحة (محاولات متبقية: ${remaining})`);
                }
            }
        }

        function lockAccount() {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + LOCKOUT_DURATION;
            localStorage.setItem('lockoutExpires', expiresAt.toString());
            
            showLockoutScreen();
            startLockoutTimer();
        }

        function isAccountLocked() {
            const lockoutExpires = parseInt(localStorage.getItem('lockoutExpires') || '0');
            const now = Math.floor(Date.now() / 1000);

            if (lockoutExpires && now < lockoutExpires) {
                showLockoutScreen();
                return true;
            }

            return false;
        }

        function showLockoutScreen() {
            document.getElementById('lockout-screen').classList.add('show');
            document.querySelector('.container-login').style.opacity = '0.5';
            document.querySelector('.container-login').style.pointerEvents = 'none';
        }

        function hideLockoutScreen() {
            document.getElementById('lockout-screen').classList.remove('show');
            document.querySelector('.container-login').style.opacity = '1';
            document.querySelector('.container-login').style.pointerEvents = 'auto';
        }

        function startLockoutTimer() {
            // تنظيف أي عدادات قديمة تمنعاً للتداخل
            if (window.lockoutInterval) clearInterval(window.lockoutInterval);

            window.lockoutInterval = setInterval(() => {
                const lockoutExpires = parseInt(localStorage.getItem('lockoutExpires') || '0');
                const now = Math.floor(Date.now() / 1000);
                const remaining = Math.max(0, lockoutExpires - now);

                document.getElementById('lockout-timer').textContent = remaining;

                if (remaining === 0) {
                    clearInterval(window.lockoutInterval);
                    loginAttempts = 0;
                    localStorage.setItem('loginAttempts', '0');
                    localStorage.removeItem('lockoutExpires');
                    hideLockoutScreen();
                    document.getElementById('login-btn').classList.remove('loading');
                }
            }, 1000);
        }

        function handleForgotPassword(event) {
            event.preventDefault();
            showAlert('warning', 'يرجى التواصل مع مسؤول النظام لإعادة تعيين كلمة المرور');
        }

        // ─────────────────────────────────────────────────────────────
        // ON PAGE LOAD
        // ─────────────────────────────────────────────────────────────
        window.addEventListener('load', () => {
            // Restore remembered email
            const remembered = localStorage.getItem('rememberedEmail');
            if (remembered) {
                document.getElementById('email').value = remembered;
                document.getElementById('remember').checked = true;
            }

            // Check if account is locked
            if (isAccountLocked()) {
                startLockoutTimer();
            }
        });
