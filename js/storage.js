/**
 * Storage Manager
 * Handles all data persistence using localStorage.
 * Designed to be easily swappable with a backend service.
 */

const STORAGE_KEYS = {
    USER_PROFILE: 'fast_user_profile',
    CURRENT_SESSION: 'fast_current_session',
    HISTORY: 'fast_history',
    SETTINGS: 'fast_settings'
};

const Storage = {
    // --- User Profile ---
    getUserProfile() {
        const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
        return data ? JSON.parse(data) : { name: 'يا بطل', joined: Date.now() };
    },

    saveUserProfile(profile) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    },

    // --- Current Fasting Session ---
    getCurrentSession() {
        const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
        return data ? JSON.parse(data) : null;
    },

    saveCurrentSession(session) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
    },

    clearCurrentSession() {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    },

    // --- History ---
    getHistory() {
        const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    },

    addHistoryItem(item) {
        const history = this.getHistory();
        history.unshift(item); // Add to beginning
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    },

    clearHistory() {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
    },

    // --- Settings ---
    getSettings() {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return data ? JSON.parse(data) : { goalHours: 16 };
    },

    saveSettings(settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },

    // --- Data Management ---
    exportData() {
        const data = {
            profile: this.getUserProfile(),
            history: this.getHistory(),
            settings: this.getSettings()
        };
        return JSON.stringify(data, null, 2);
    },

    clearAllData() {
        localStorage.clear();
    }
};
