/**
 * Main Application Logic
 */

// --- State & Constants ---
let timerInterval = null;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 110; // r=110

// --- DOM Elements ---
const els = {
    navItems: document.querySelectorAll('.nav-item'),
    pages: document.querySelectorAll('.page'),
    timerDisplay: document.getElementById('timer-display'),
    timerStatus: document.getElementById('timer-status-text'),
    timerGoalText: document.getElementById('timer-goal-text'),
    progressCircle: document.querySelector('.progress-ring__circle'),
    mainBtn: document.getElementById('main-action-btn'),
    fastingDetails: document.getElementById('fasting-details'),
    startTimeDisplay: document.getElementById('start-time-display'),
    endTimeDisplay: document.getElementById('end-time-display'),
    userName: document.getElementById('user-name-display'),
    currentDate: document.getElementById('current-date'),
    dailyTip: document.getElementById('daily-tip-text'),
    // Dashboard
    streakCount: document.getElementById('streak-count'),
    totalHours: document.getElementById('total-hours'),
    weekChart: document.getElementById('week-chart'),
    historyList: document.getElementById('history-list-items'),
    // Settings
    settingName: document.getElementById('setting-name'),
    settingGoal: document.getElementById('setting-goal'),
    settingTheme: document.getElementById('setting-theme'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    clearDataBtn: document.getElementById('clear-data-btn'),
    // News
    newsContainer: document.getElementById('news-container')
};

// --- Initialization ---
async function init() {
    // Check authentication first
    try {
        await fastDB.init();
        const isLoggedIn = await fastDB.isLoggedIn();

        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return;
        }

        // Load user data
        const user = await fastDB.getCurrentUser();
        const profile = await fastDB.getProfile(user.id);

        // Update UI with user name
        if (els.userNameDisplay) {
            els.userNameDisplay.textContent = profile.name || 'يا بطل';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        // If db.js is not loaded, continue without auth (backward compatibility)
    }

    setupNavigation();
    setupDate();
    loadUserData();
    checkFastingStatus();
    loadDashboard();
    fetchDailyNews();
    setupSettings();

    // Set initial circle dasharray
    els.progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    els.progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
}

// --- Navigation ---
function setupNavigation() {
    els.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;

            // Update Nav UI
            els.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update Page UI
            els.pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Refresh data if needed
            if (targetId === 'dashboard') loadDashboard();
        });
    });
}

function setupDate() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    els.currentDate.textContent = new Date().toLocaleDateString('ar-EG-u-nu-latn', options);
}

// --- User Data ---
function loadUserData() {
    const profile = Storage.getUserProfile();
    els.userName.textContent = profile.name;
    els.settingName.value = profile.name;

    const settings = Storage.getSettings();
    els.settingGoal.value = settings.goalHours;
    els.settingTheme.value = settings.theme || 'light';

    // Apply settings immediately
    els.timerGoalText.textContent = `الهدف: ${settings.goalHours} ساعة`;
    applyTheme(settings.theme || 'light');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// --- Fasting Logic ---
function checkFastingStatus() {
    const session = Storage.getCurrentSession();
    if (session) {
        startTimerUI(session);
    } else {
        resetTimerUI();
    }
}

function startFasting() {
    const settings = Storage.getSettings();
    const now = Date.now();
    const goalMs = settings.goalHours * 60 * 60 * 1000;

    const session = {
        startTime: now,
        goalHours: settings.goalHours,
        endTime: now + goalMs
    };

    Storage.saveCurrentSession(session);
    startTimerUI(session);
    showToast('بدأ الصيام! بالتوفيق 💪');
}

function endFasting() {
    const session = Storage.getCurrentSession();
    if (!session) return;

    const now = Date.now();
    const durationMs = now - session.startTime;
    const durationHours = durationMs / (1000 * 60 * 60);

    // Save to history
    const historyItem = {
        startTime: session.startTime,
        endTime: now,
        duration: durationHours,
        goal: session.goalHours,
        completed: durationHours >= session.goalHours
    };

    Storage.addHistoryItem(historyItem);
    Storage.clearCurrentSession();

    resetTimerUI();
    loadDashboard(); // Refresh stats
    showToast('تم إنهاء الصيام. وجبة هنيئة! 😋');
}

function startTimerUI(session) {
    els.mainBtn.innerHTML = '<i class="fas fa-stop"></i> إنهاء الصيام';
    els.mainBtn.classList.add('danger');
    els.mainBtn.classList.remove('pulse-animation');
    els.mainBtn.onclick = endFasting;

    els.fastingDetails.classList.remove('hidden');
    els.startTimeDisplay.textContent = formatTimeShort(session.startTime);
    els.endTimeDisplay.textContent = formatTimeShort(session.endTime);

    updateTimer(session);
    timerInterval = setInterval(() => updateTimer(session), 1000);
}

function resetTimerUI() {
    if (timerInterval) clearInterval(timerInterval);

    els.timerDisplay.textContent = '00:00:00';
    els.timerStatus.textContent = 'جاهز للصيام';
    els.progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;

    els.mainBtn.innerHTML = '<i class="fas fa-play"></i> ابدأ الصيام';
    els.mainBtn.classList.remove('danger');
    els.mainBtn.classList.add('pulse-animation');
    els.mainBtn.onclick = startFasting;

    els.fastingDetails.classList.add('hidden');
}

function updateTimer(session) {
    const now = Date.now();
    const elapsed = now - session.startTime;
    const totalGoal = session.endTime - session.startTime;
    const remaining = session.endTime - now;

    // Update Text
    if (remaining > 0) {
        els.timerDisplay.textContent = formatDuration(remaining);
        els.timerStatus.textContent = 'الوقت المتبقي';
    } else {
        els.timerDisplay.textContent = '+' + formatDuration(Math.abs(remaining));
        els.timerStatus.textContent = 'تجاوزت الهدف!';

        // Send notification when goal reached (only once)
        if (!session.notificationSent && Math.abs(remaining) < 1000) {
            sendFastingCompleteNotification(session.goalHours);
            session.notificationSent = true;
            Storage.saveCurrentSession(session);
        }
    }

    // Update Circle
    const progress = Math.min(elapsed / totalGoal, 1);
    const offset = CIRCLE_CIRCUMFERENCE - (progress * CIRCLE_CIRCUMFERENCE);
    els.progressCircle.style.strokeDashoffset = offset;
}

// Request notification permission and send notification
async function sendFastingCompleteNotification(hours) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        new Notification('🎉 تهانينا!', {
            body: `أكملت ${hours} ساعة من الصيام! وجبة هنيئة 😋`,
            icon: 'pwa/icon.svg',
            badge: 'pwa/icon.svg',
            vibrate: [200, 100, 200]
        });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification('🎉 تهانينا!', {
                body: `أكملت ${hours} ساعة من الصيام! وجبة هنيئة 😋`,
                icon: 'pwa/icon.svg'
            });
        }
    }
}

// --- Dashboard ---
function loadDashboard() {
    const history = Storage.getHistory();

    // Calculate Stats
    let totalHours = 0;
    history.forEach(item => totalHours += item.duration);
    els.totalHours.textContent = Math.floor(totalHours);

    // Streak (Simplified: consecutive sessions < 48h apart)
    let streak = 0;
    if (history.length > 0) {
        streak = 1;
        for (let i = 0; i < history.length - 1; i++) {
            const diff = history[i].startTime - history[i + 1].endTime;
            if (diff < 48 * 60 * 60 * 1000) { // Less than 48h gap
                streak++;
            } else {
                break;
            }
        }
    }
    els.streakCount.textContent = streak;

    // Render Chart (Last 7 days)
    renderWeekChart(history);

    // Render List
    renderHistoryList(history.slice(0, 10)); // Last 10 items
}

function renderWeekChart(history) {
    els.weekChart.innerHTML = '';
    const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    // Create 7 bars
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayName = days[date.getDay()];

        // Sum hours for this day
        const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
        const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

        const dayHours = history
            .filter(h => h.endTime >= dayStart && h.endTime <= dayEnd)
            .reduce((sum, h) => sum + h.duration, 0);

        const heightPercentage = Math.min((dayHours / 24) * 100, 100); // Max 24h

        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';
        barContainer.innerHTML = `
            <div class="chart-bar ${dayHours > 0 ? 'active' : ''}" style="height: ${heightPercentage}%"></div>
            <span class="chart-day">${dayName}</span>
        `;
        els.weekChart.appendChild(barContainer);
    }
}

function renderHistoryList(history) {
    els.historyList.innerHTML = '';
    if (history.length === 0) {
        els.historyList.innerHTML = '<li class="text-center text-gray-400 py-4">لا توجد سجلات بعد</li>';
        return;
    }

    history.forEach(item => {
        const date = new Date(item.endTime).toLocaleDateString('ar-EG-u-nu-latn');
        const duration = Math.floor(item.duration * 10) / 10;

        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span class="history-date">${date}</span>
            <span class="history-duration">${duration} ساعة</span>
        `;
        els.historyList.appendChild(li);
    });
}

// --- News & Tips ---
async function fetchDailyNews() {
    try {
        // In a real scenario, this fetches from the generated JSON file
        const response = await fetch('data/daily_news.json');
        if (!response.ok) throw new Error('Failed to load news');

        const data = await response.json();

        // Update Tip
        if (data.tip) {
            els.dailyTip.textContent = data.tip;
        }

        // Update News Feed - Filter out Gaza/political news
        if (data.articles && data.articles.length > 0) {
            // Keywords to filter out (Gaza, Israel, political content)
            const excludeKeywords = [
                'غزة', 'gaza', 'إسرائيل', 'israel', 'فلسطين', 'palestine',
                'حرب', 'war', 'قصف', 'bombing', 'صاروخ', 'rocket',
                'حماس', 'hamas', 'الاحتلال', 'occupation', 'مستوطن',
                'نتنياهو', 'netanyahu', 'سياسي', 'political'
            ];

            // Filter articles
            const healthArticles = data.articles.filter(article => {
                const title = (article.title || '').toLowerCase();
                const description = (article.description || '').toLowerCase();
                const content = title + ' ' + description;

                // Check if article contains any excluded keywords
                return !excludeKeywords.some(keyword => content.includes(keyword.toLowerCase()));
            });

            if (healthArticles.length > 0) {
                els.newsContainer.innerHTML = healthArticles.map(article => `
                    <div class="news-card">
                        <div class="news-image" style="background-image: url('${article.urlToImage || 'https://via.placeholder.com/300?text=Health'}')"></div>
                        <div class="news-content">
                            <h4 class="news-title">${article.title}</h4>
                            <p class="news-excerpt">${article.description || ''}</p>
                            <a href="${article.url}" target="_blank" class="text-sm text-blue-500 mt-2 block">اقرأ المزيد</a>
                        </div>
                    </div>
                `).join('');
            } else {
                // If all articles were filtered out, show fallback
                els.newsContainer.innerHTML = '<div class="text-center p-4 text-gray-400">لا توجد أخبار صحية متاحة حالياً</div>';
            }
        }
    } catch (error) {
        console.log('Using fallback data', error);
        // Fallback content if fetch fails (e.g., first run)
        els.dailyTip.textContent = "شرب الماء بانتظام يساعد على تحسين عملية التمثيل الغذائي.";
        els.newsContainer.innerHTML = '<div class="text-center p-4 text-gray-400">جاري تحديث الأخبار...</div>';
    }
}

// --- Settings ---
function setupSettings() {
    els.saveSettingsBtn.addEventListener('click', () => {
        const name = els.settingName.value;
        const goal = parseInt(els.settingGoal.value);
        const theme = els.settingTheme.value;

        Storage.saveUserProfile({ ...Storage.getUserProfile(), name });
        Storage.saveSettings({ ...Storage.getSettings(), goalHours: goal, theme: theme });

        els.userName.textContent = name;
        els.timerGoalText.textContent = `الهدف: ${goal} ساعة`;
        applyTheme(theme);

        showToast('تم حفظ الإعدادات');
    });

    els.clearDataBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من حذف جميع بياناتك؟ لا يمكن التراجع عن هذا الإجراء.')) {
            Storage.clearAllData();
            location.reload();
        }
    });
}

// --- Utilities ---
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatTimeShort(ms) {
    return new Date(ms).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
}

function pad(num) {
    return String(num).padStart(2, '0');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Start App
window.addEventListener('DOMContentLoaded', init);
