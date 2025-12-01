/**
 * IndexedDB Manager using Dexie.js
 * Handles all data persistence with IndexedDB for PWA
 * Compatible with GitHub Pages hosting
 */

// Import Dexie from CDN (will be added to HTML)
// Using vanilla IndexedDB API for zero dependencies

class FastDB {
    constructor() {
        this.dbName = 'FastTrackDB';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Users store (for authentication)
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('username', 'username', { unique: true });
                }

                // Profile store
                if (!db.objectStoreNames.contains('profile')) {
                    db.createObjectStore('profile', { keyPath: 'userId' });
                }

                // Sessions store (fasting sessions)
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('userId', 'userId', { unique: false });
                    sessionStore.createIndex('startTime', 'startTime', { unique: false });
                }

                // Current session store
                if (!db.objectStoreNames.contains('currentSession')) {
                    db.createObjectStore('currentSession', { keyPath: 'userId' });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'userId' });
                }

                // Auth state store
                if (!db.objectStoreNames.contains('authState')) {
                    db.createObjectStore('authState', { keyPath: 'key' });
                }
            };
        });
    }

    // ==================== AUTH METHODS ====================

    /**
     * Register a new user
     */
    async register(username, email, password) {
        // Hash password BEFORE creating transaction
        const hashedPassword = await this.hashPassword(password);

        const transaction = this.db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');

        const user = {
            username,
            email,
            password: hashedPassword,
            createdAt: Date.now(),
            lastLogin: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(user);
            request.onsuccess = () => {
                user.id = request.result;
                resolve(user);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Login user
     */
    async login(emailOrUsername, password) {
        // Try to find by email first
        let user = await this.getUserByEmail(emailOrUsername);

        // If not found, try username
        if (!user) {
            user = await this.getUserByUsername(emailOrUsername);
        }

        if (!user) {
            throw new Error('المستخدم غير موجود');
        }

        // Verify password
        const isValid = await this.verifyPassword(password, user.password);
        if (!isValid) {
            throw new Error('كلمة المرور غير صحيحة');
        }

        // Update last login
        await this.updateLastLogin(user.id);

        // Save auth state
        await this.saveAuthState(user.id);

        return user;
    }

    /**
     * Logout user
     */
    async logout() {
        await this.clearAuthState();
    }

    /**
     * Get current logged-in user
     */
    async getCurrentUser() {
        const authState = await this.getAuthState();
        if (!authState || !authState.userId) {
            return null;
        }

        return await this.getUserById(authState.userId);
    }

    /**
     * Check if user is logged in
     */
    async isLoggedIn() {
        const user = await this.getCurrentUser();
        return !!user;
    }

    // ==================== USER METHODS ====================

    async getUserById(id) {
        const transaction = this.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserByEmail(email) {
        const transaction = this.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('email');

        return new Promise((resolve, reject) => {
            const request = index.get(email);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserByUsername(username) {
        const transaction = this.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('username');

        return new Promise((resolve, reject) => {
            const request = index.get(username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveAuthState(userId) {
        const transaction = this.db.transaction(['authState'], 'readwrite');
        const store = transaction.objectStore('authState');

        const authState = {
            key: 'currentUser',
            userId,
            loginTime: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(authState);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAuthState() {
        const transaction = this.db.transaction(['authState'], 'readonly');
        const store = transaction.objectStore('authState');

        return new Promise((resolve, reject) => {
            const request = store.get('currentUser');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAuthState() {
        const transaction = this.db.transaction(['authState'], 'readwrite');
        const store = transaction.objectStore('authState');

        return new Promise((resolve, reject) => {
            const request = store.delete('currentUser');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== PROFILE METHODS ====================

    async getProfile(userId) {
        const transaction = this.db.transaction(['profile'], 'readonly');
        const store = transaction.objectStore('profile');

        return new Promise((resolve, reject) => {
            const request = store.get(userId);
            request.onsuccess = () => {
                const profile = request.result || {
                    userId,
                    name: 'يا بطل',
                    joined: Date.now()
                };
                resolve(profile);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveProfile(userId, profile) {
        const transaction = this.db.transaction(['profile'], 'readwrite');
        const store = transaction.objectStore('profile');

        profile.userId = userId;

        return new Promise((resolve, reject) => {
            const request = store.put(profile);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== SESSION METHODS ====================

    async getCurrentSession(userId) {
        const transaction = this.db.transaction(['currentSession'], 'readonly');
        const store = transaction.objectStore('currentSession');

        return new Promise((resolve, reject) => {
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveCurrentSession(userId, session) {
        const transaction = this.db.transaction(['currentSession'], 'readwrite');
        const store = transaction.objectStore('currentSession');

        session.userId = userId;

        return new Promise((resolve, reject) => {
            const request = store.put(session);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearCurrentSession(userId) {
        const transaction = this.db.transaction(['currentSession'], 'readwrite');
        const store = transaction.objectStore('currentSession');

        return new Promise((resolve, reject) => {
            const request = store.delete(userId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async addSession(userId, session) {
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');

        session.userId = userId;

        return new Promise((resolve, reject) => {
            const request = store.add(session);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSessionHistory(userId, limit = 10) {
        const transaction = this.db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const index = store.index('userId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => {
                const sessions = request.result || [];
                // Sort by start time descending and limit
                sessions.sort((a, b) => b.startTime - a.startTime);
                resolve(sessions.slice(0, limit));
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== SETTINGS METHODS ====================

    async getSettings(userId) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.get(userId);
            request.onsuccess = () => {
                const settings = request.result || {
                    userId,
                    goalHours: 16,
                    theme: 'light',
                    notifications: true
                };
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveSettings(userId, settings) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');

        settings.userId = userId;

        return new Promise((resolve, reject) => {
            const request = store.put(settings);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== DATA MANAGEMENT ====================

    async exportData(userId) {
        const profile = await this.getProfile(userId);
        const sessions = await this.getSessionHistory(userId, 1000);
        const settings = await this.getSettings(userId);

        return {
            profile,
            sessions,
            settings,
            exportedAt: Date.now()
        };
    }

    async clearAllUserData(userId) {
        const transaction = this.db.transaction(
            ['profile', 'sessions', 'currentSession', 'settings'],
            'readwrite'
        );

        await Promise.all([
            new Promise((resolve) => {
                transaction.objectStore('profile').delete(userId).onsuccess = resolve;
            }),
            new Promise((resolve) => {
                transaction.objectStore('currentSession').delete(userId).onsuccess = resolve;
            }),
            new Promise((resolve) => {
                transaction.objectStore('settings').delete(userId).onsuccess = resolve;
            })
        ]);

        // Delete all sessions for this user
        const sessionStore = transaction.objectStore('sessions');
        const index = sessionStore.index('userId');
        const sessions = await new Promise((resolve) => {
            index.getAll(userId).onsuccess = (e) => resolve(e.target.result);
        });

        for (const session of sessions) {
            await new Promise((resolve) => {
                sessionStore.delete(session.id).onsuccess = resolve;
            });
        }
    }

    // ==================== PASSWORD UTILITIES ====================

    async hashPassword(password) {
        // Simple hash for demo - in production use Web Crypto API or bcrypt
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'FAST_SALT_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async verifyPassword(password, hashedPassword) {
        const hash = await this.hashPassword(password);
        return hash === hashedPassword;
    }
}

// Create global instance
const fastDB = new FastDB();
