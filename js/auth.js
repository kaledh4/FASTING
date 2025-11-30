/**
 * Authentication Handler
 * Manages login, registration, and session management
 */

let isProcessing = false;

// Initialize database when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await fastDB.init();
        console.log('✅ Database initialized');

        // Check if already logged in
        const isLoggedIn = await fastDB.isLoggedIn();
        if (isLoggedIn) {
            redirectToApp();
        }
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        showError('login', 'حدث خطأ في تهيئة التطبيق. يرجى تحديث الصفحة.');
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Guest button
    document.getElementById('guest-btn').addEventListener('click', handleGuestLogin);

    // Forgot password
    document.getElementById('forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        alert('لاستعادة كلمة المرور، يرجى التواصل مع الدعم الفني.');
    });
}

function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update form sections
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = tab === 'login' ? 'login-form' : 'register-form';
    document.getElementById(targetSection).classList.add('active');

    // Clear messages
    clearMessages();
}

async function handleLogin(e) {
    e.preventDefault();

    if (isProcessing) return;
    isProcessing = true;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Clear previous messages
    clearMessages();

    // Validation
    if (!email || !password) {
        showError('login', 'يرجى ملء جميع الحقول');
        isProcessing = false;
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';

    try {
        const user = await fastDB.login(email, password);

        showSuccess('login', 'تم تسجيل الدخول بنجاح! جاري التحويل...');

        // Redirect after short delay
        setTimeout(() => {
            redirectToApp();
        }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        showError('login', error.message || 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        isProcessing = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();

    if (isProcessing) return;
    isProcessing = true;

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;

    // Clear previous messages
    clearMessages();

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showError('register', 'يرجى ملء جميع الحقول');
        isProcessing = false;
        return;
    }

    if (username.length < 3) {
        showError('register', 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
        isProcessing = false;
        return;
    }

    if (!isValidEmail(email)) {
        showError('register', 'البريد الإلكتروني غير صحيح');
        isProcessing = false;
        return;
    }

    if (password.length < 6) {
        showError('register', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        isProcessing = false;
        return;
    }

    if (password !== confirmPassword) {
        showError('register', 'كلمات المرور غير متطابقة');
        isProcessing = false;
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الحساب...';

    try {
        // Register user
        const user = await fastDB.register(username, email, password);

        // Auto-login after registration
        await fastDB.saveAuthState(user.id);

        // Create default profile
        await fastDB.saveProfile(user.id, {
            name: username,
            joined: Date.now()
        });

        // Create default settings
        await fastDB.saveSettings(user.id, {
            goalHours: 16,
            theme: 'light',
            notifications: true
        });

        showSuccess('register', 'تم إنشاء الحساب بنجاح! جاري التحويل...');

        // Redirect after short delay
        setTimeout(() => {
            redirectToApp();
        }, 1500);

    } catch (error) {
        console.error('Registration error:', error);

        let errorMessage = 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.';

        if (error.message && error.message.includes('email')) {
            errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
        } else if (error.message && error.message.includes('username')) {
            errorMessage = 'اسم المستخدم مستخدم بالفعل';
        }

        showError('register', errorMessage);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        isProcessing = false;
    }
}

async function handleGuestLogin() {
    if (isProcessing) return;
    isProcessing = true;

    const guestBtn = document.getElementById('guest-btn');
    const originalText = guestBtn.innerHTML;
    guestBtn.disabled = true;
    guestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

    try {
        // Create a guest account with random credentials
        const guestId = 'guest_' + Date.now();
        const guestEmail = `${guestId}@guest.local`;
        const guestPassword = Math.random().toString(36).substring(7);

        const user = await fastDB.register(guestId, guestEmail, guestPassword);
        await fastDB.saveAuthState(user.id);

        // Create default profile for guest
        await fastDB.saveProfile(user.id, {
            name: 'ضيف',
            joined: Date.now(),
            isGuest: true
        });

        // Create default settings
        await fastDB.saveSettings(user.id, {
            goalHours: 16,
            theme: 'light',
            notifications: false
        });

        setTimeout(() => {
            redirectToApp();
        }, 500);

    } catch (error) {
        console.error('Guest login error:', error);
        showError('login', 'فشل الدخول كضيف. يرجى المحاولة مرة أخرى.');
        guestBtn.disabled = false;
        guestBtn.innerHTML = originalText;
        isProcessing = false;
    }
}

function redirectToApp() {
    window.location.href = 'index.html';
}

function showError(formType, message) {
    const errorEl = document.getElementById(`${formType}-error`);
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function showSuccess(formType, message) {
    const successEl = document.getElementById(`${formType}-success`);
    successEl.textContent = message;
    successEl.classList.add('show');
}

function clearMessages() {
    document.querySelectorAll('.error-message, .success-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered'))
            .catch(err => console.log('SW registration failed', err));
    });
}
