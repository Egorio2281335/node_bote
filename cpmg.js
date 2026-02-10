const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const { Level } = require('level');

// const WORKER_PROCESS_ID = parseInt(process.env.WORKER_ID, 10);
const WORKER_PROCESS_ID = 1;

// Оптимизация памяти для массовой генерации
if (global.gc) {
    setInterval(() => global.gc(), 30000);
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Необработанный rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Непойманное исключение:', error);
    process.exit(1);
});

//const logFile = path.resolve(__dirname, 'logs/mass_generation.log');
//const logStream = fs.createWriteStream(logFile, { flags: 'a' });
/*
function timestamp() {
    return new Date().toLocaleString();
}
*/
// Переопределяем console.log для логирования
/*
['log', 'warn', 'error'].forEach(method => {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        const message = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        const logLine = `[${timestamp()}] [${method.toUpperCase()}] ${message}\n`;
        logStream.write(logLine);
        original(...args);
    };
});
*/
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class ProfileDataCache {
    constructor() {
        this.cacheDir = path.resolve(__dirname, 'profile_cache');
        this.cachedData = new Map();
    }

    _randomChoice(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    async init() {
        await mkdir(this.cacheDir, { recursive: true });
        await this._preloadCommonData();
    }

    async _preloadCommonData() {
        const cacheFiles = {
            'websites.json': () => this._generateWebsitesCache(),
            'user_agents.json': () => this._generateUserAgentsCache(),
            'cities_data.json': () => this._generateCitiesCache(),
            'common_cookies.json': () => this._generateCommonCookiesCache(),
            'search_queries.json': () => this._generateSearchQueriesCache()
        };

        for (const [filename, generator] of Object.entries(cacheFiles)) {
            const filePath = path.join(this.cacheDir, filename);
            if (!fs.existsSync(filePath)) {
                // console.log(`Генерация кэша: ${filename}`);
                const data = await generator();
                await writeFile(filePath, JSON.stringify(data, null, 2));
            }
            const fileContent = fs.readFileSync(filePath, 'utf8');
            this.cachedData.set(filename, JSON.parse(fileContent));
        }
    }

    _generateWebsitesCache() {
        const categories = {
            'social': ['vk.com', 'facebook.com', 'twitter.com', 'instagram.com', 'ok.ru'],
            'news': ['ria.ru', 'lenta.ru', 'rbc.ru', 'kommersant.ru', 'gazeta.ru'],
            'tech': ['habr.com', 'stackoverflow.com', 'github.com', 'gitlab.com', 'medium.com'],
            'shopping': ['aliexpress.ru', 'wildberries.ru', 'ozon.ru', 'citilink.ru', 'dns-shop.ru'],
            'entertainment': ['youtube.com', 'kinopoisk.ru', 'ivi.ru', 'twitch.tv', 'netflix.com'],
            'search': ['yandex.ru', 'google.com', 'mail.ru', 'rambler.ru', 'bing.com']
        };

        const sites = {};
        Object.entries(categories).forEach(([category, domains]) => {
            domains.forEach(domain => {
                sites[domain] = {
                    visits_per_month: Math.floor(Math.random() * 100) + 10,
                    category: category,
                    popularity: Math.random() * 0.8 + 0.2
                };
            });
        });

        for (let i = 0; i < 500; i++) {
            const domain = this._generateRandomDomain();
            sites[domain] = {
                visits_per_month: Math.floor(Math.random() * 50) + 1,
                category: this._randomChoice(Object.keys(categories)),
                popularity: Math.random() * 0.5
            };
        }

        return sites;
    }

    _generateUserAgentsCache() {
        const desktop = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        const mobile = [
            'Mozilla/5.0 (Linux; Android 10; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'
        ];

        return { desktop, mobile };
    }

    _generateCitiesCache() {
        return [
            { city: 'Москва', region: 'Московская область', timezone: 'Europe/Moscow', ip_prefix: '95.165' },
            { city: 'Санкт-Петербург', region: 'Ленинградская область', timezone: 'Europe/Moscow', ip_prefix: '95.167' },
            { city: 'Новосибирск', region: 'Новосибирская область', timezone: 'Asia/Novosibirsk', ip_prefix: '95.169' },
            { city: 'Екатеринбург', region: 'Свердловская область', timezone: 'Asia/Yekaterinburg', ip_prefix: '95.171' },
            { city: 'Казань', region: 'Татарстан', timezone: 'Europe/Moscow', ip_prefix: '95.173' },
            { city: 'Нижний Новгород', region: 'Нижегородская область', timezone: 'Europe/Moscow', ip_prefix: '95.175' },
            { city: 'Самара', region: 'Самарская область', timezone: 'Europe/Samara', ip_prefix: '95.177' },
            { city: 'Омск', region: 'Омская область', timezone: 'Asia/Omsk', ip_prefix: '95.179' },
            { city: 'Ростов-на-Дону', region: 'Ростовская область', timezone: 'Europe/Moscow', ip_prefix: '95.181' },
            { city: 'Уфа', region: 'Башкортостан', timezone: 'Asia/Yekaterinburg', ip_prefix: '95.183' }
        ];
    }

    _generateCommonCookiesCache() {
        return {
            'yandex': [
                { name: 'yandexuid', value: 'random_hex_32', expiresDays: 365 },
                { name: 'ymex', value: 'random_hex_32', expiresDays: 365 },
                { name: '_ym_uid', value: 'timestamp', expiresDays: 365 }
            ],
            'google': [
                { name: 'NID', value: 'random_string_150', expiresDays: 180 },
                { name: 'CONSENT', value: 'YES+RU.ru+20240101-00-0', expiresDays: 730 }
            ]
        };
    }

    _generateSearchQueriesCache() {
        return {
            'погода': ['погода в {city}', 'прогноз погоды {city}', 'погода на неделю {city}'],
            'новости': ['новости {city}', 'события {city}', 'последние новости'],
            'работа': ['вакансии {city}', 'работа {city}', 'карьера {city}'],
            'развлечения': ['кино {city}', 'рестораны {city}', 'мероприятия {city}']
        };
    }

    _generateRandomDomain() {
        const domains = ['com', 'ru', 'net', 'org', 'io'];
        const name = Math.random().toString(36).substring(2, 10);
        return `${name}.${domains[Math.floor(Math.random() * domains.length)]}`;
    }

    getWebsites(count = 50) {
        const websitesData = this.cachedData.get('websites.json');
        if (!websitesData) return [];

        const allSites = Object.entries(websitesData);
        const shuffled = this._shuffleArray([...allSites]);

        return shuffled.slice(0, count).map(([domain, data]) => ({
            url: `https://${domain}`,
            title: domain,
            ...data
        }));
    }

    getUserAgent(isMobile) {
        const agents = this.cachedData.get('user_agents.json');
        if (!agents) return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        const agentList = isMobile ? agents.mobile : agents.desktop;
        return agentList[Math.floor(Math.random() * agentList.length)] || agentList[0];
    }

    getRandomCity() {
        const cities = this.cachedData.get('cities_data.json');
        return cities[Math.floor(Math.random() * cities.length)] || { city: 'Москва', region: 'Московская область', timezone: 'Europe/Moscow', ip_prefix: '95.165' };
    }

    _shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

class CompleteChromeProfileGenerator {
    constructor(profileId, cache, options = {}) {
        this.profileId = profileId;
        this.cache = cache;

        this.userDataPath = path.resolve(__dirname, `chrome_profiles_${WORKER_PROCESS_ID}/profile_${profileId}`);
        this.profilePath = path.join(this.userDataPath, 'Default');
        this.localStatePath = this.userDataPath;

        this.options = {
            minimalMode: options.minimalMode || false,
            enableHeavyData: options.enableHeavyData !== false,
            ...options
        };

        this.data = this._loadDataFiles();

        this.userProfile = null;
        this.config = null;
        this.autofillData = null;
        this.browsingPatterns = null;
        this.browserFingerprint = null;
        this.syncData = null;

        this._initializeData();
    }

    _initializeData() {
        // 1. Сначала создаем БАЗОВЫЙ config (без зависимостей)
        this.config = this._generateBaseConfig();

        // 2. Потом создаем userProfile (использует базовый config)
        this.userProfile = this._generateEnhancedUserProfile();

        // 3. Затем ОБНОВЛЯЕМ config с данными профиля
        this.config = { ...this.config, personality: this.userProfile.personality };

        // 4. Остальные данные (используют и config и userProfile)
        this.autofillData = this._generateRealAutofillData();
        this.browsingPatterns = this._generateRealisticBrowsingPatterns();
        this.browserFingerprint = this._generateBrowserFingerprint();
        this.syncData = this._generateSyncData();
    }

    async _saveConfigToFile() {
        const config = {
            userAgentString: this.config.userAgentString,
            viewportSize: this.config.viewportSize,
            isMobile: this.config.isMobile,
            originalProxy: this.config.originalProxy,
            createdAt: this.config.createdAt
        };

        const configPath = path.join(this.userDataPath, 'config.json');
        await writeFile(configPath, JSON.stringify(config, null, 2));
        // console.log(`[${this.profileId}] 💾 Создана новая конфигурация профиля`);
    }

    _generateBaseConfig() {
        //const isMobile = this._randomBool(0.3);
        const isMobile = 0;
        const viewportSize = this._generateViewportSize(isMobile);

        return {
            userAgentString: this.cache.getUserAgent(isMobile),
            viewportSize: viewportSize,
            isMobile: isMobile,
            creationDate: this.options.creationTime || Date.now()
            // personality добавим позже, после создания профиля
        };
    }

    _generateConfig() {
        //const isMobile = this._randomBool(0.3);
        const isMobile = 0;
        const viewportSize = this._generateViewportSize(isMobile);



        return {
            userAgentString: this.cache.getUserAgent(isMobile),
            viewportSize: viewportSize,
            isMobile: isMobile,
            personality: this.userProfile.personality,
            creationDate: this.options.creationTime || Date.now()
        };
    }

    _generateViewportSize(isMobile) {
        if (isMobile) {
            return {
                width: this._randomInt(320, 520),
                height: this._randomInt(600, 900)
            };
        } else {
            return {
                width: this._randomInt(1200, 1920),
                height: this._randomInt(700, 1200)
            };
        }
    }

    _randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    _randomBool(probability = 0.5) {
        return Math.random() < probability;
    }

    _randomChoice(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    _generateId(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    _generateHex(length = 16) {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    _generateRealisticBrowsingPatterns() {
        const patterns = {
            morning: [
                { time: "06:00-08:00", sites: ["news", "email", "social"], duration: 15 },
                { time: "08:00-10:00", sites: ["work", "search", "news"], duration: 45 },
                { time: "10:00-12:00", sites: ["work", "shopping", "social"], duration: 30 }
            ],
            daytime: [
                { time: "12:00-14:00", sites: ["news", "entertainment", "social"], duration: 20 },
                { time: "14:00-16:00", sites: ["work", "search", "tech"], duration: 60 },
                { time: "16:00-18:00", sites: ["social", "entertainment", "shopping"], duration: 25 }
            ],
            evening: [
                { time: "18:00-20:00", sites: ["entertainment", "social", "news"], duration: 40 },
                { time: "20:00-22:00", sites: ["entertainment", "social", "gaming"], duration: 90 },
                { time: "22:00-24:00", sites: ["social", "entertainment", "search"], duration: 30 }
            ]
        };

        const patternKeys = Object.keys(patterns);
        return patterns[patternKeys[Math.floor(Math.random() * patternKeys.length)]];
    }

    _generateRealAutofillData() {
        const russianNames = {
            male: ["Александр", "Дмитрий", "Михаил", "Сергей", "Андрей", "Алексей"],
            female: ["Екатерина", "Мария", "Анна", "Ольга", "Елена", "Ирина"]
        };

        const isMale = this._randomBool(0.5);
        const firstName = this._randomChoice(isMale ? russianNames.male : russianNames.female);
        const lastName = this._randomChoice(this.data.users.last_names);

        return {
            name: `${firstName} ${lastName}`,
            first_name: firstName,
            last_name: lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${this._randomInt(1, 99)}@${this._randomChoice(['gmail.com', 'yandex.ru', 'mail.ru'])}`,
            phone: `+79${this._randomInt(100000000, 999999999)}`,
            address: {
                city: this.userProfile.geoData.city,
                street: `ул. ${this._randomChoice(['Ленина', 'Пушкина', 'Гагарина', 'Советская'])}`,
                building: this._randomInt(1, 150),
                apartment: this._randomInt(1, 300)
            },
            company: this._randomChoice(['ООО "Рога и копыта"', 'ИП Иванов', 'АО "Технологии"', 'ЗАО "Стройсервис"']),
            birth_date: new Date(1980 + this._randomInt(0, 40), this._randomInt(0, 11), this._randomInt(1, 28))
        };
    }

    _generateBrowserFingerprint() {
        return {
            canvas_fingerprint: this._generateHex(32),
            webgl_fingerprint: this._generateHex(32),
            audio_fingerprint: this._generateHex(32),
            screen_resolution: `${this.config.viewportSize.width}x${this.config.viewportSize.height}`,
            timezone: this.userProfile.geoData.timezone,
            language: "ru-RU",
            platform: this.config.isMobile ? "Android" : "Win32",
            hardware_concurrency: this._randomChoice([2, 4, 8, 16]),
            device_memory: this._randomChoice([4, 8, 16, 32]),
            fonts: this._getInstalledFonts(),
            plugins: this._getBrowserPlugins()
        };
    }

    _getDefaultPersonalityTypes() {
        return {
            'tech_enthusiast': {
                session_pattern: { sessions_per_day: 8, sites_per_session: 15 },
                sites: ['tech', 'news', 'social'],
                online_time: 'evening'
            },
            'casual_user': {
                session_pattern: { sessions_per_day: 3, sites_per_session: 5 },
                sites: ['news', 'entertainment', 'social'],
                online_time: 'evening'
            }
        };
    }

    _getInstalledFonts() {
        const commonFonts = ["Arial", "Times New Roman", "Verdana", "Tahoma"];
        const russianFonts = ["Roboto", "Open Sans", "PT Sans", "Fira Sans"];
        return [...commonFonts, ...russianFonts].sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    _getBrowserPlugins() {
        return [
            "Chrome PDF Viewer",
            "Chrome PDF Plugin",
            "Native Client",
            "Widevine Content Decryption Module"
        ];
    }

    _generateSyncData() {
        return {
            sync_enabled: this._randomBool(0.7),
            account: {
                email: this.userProfile.email,
                avatar_url: `https://avatar.example.com/${this._generateHex(16)}.jpg`,
                last_sync: Date.now() - this._randomInt(0, 86400000)
            },
            synced_data: {
                bookmarks: this._randomBool(0.9),
                history: this._randomBool(0.8),
                passwords: this._randomBool(0.6),
                extensions: this._randomBool(0.7),
                themes: this._randomBool(0.4)
            }
        };
    }

    _generateCoordinates(city) {
        const coordinates = {
            'Москва': { lat: 55.7558, lon: 37.6173 },
            'Санкт-Петербург': { lat: 59.9343, lon: 30.3351 },
            'Новосибирск': { lat: 55.0084, lon: 82.9357 },
            'Екатеринбург': { lat: 56.8389, lon: 60.6057 },
            'Казань': { lat: 55.7961, lon: 49.1064 },
            'Нижний Новгород': { lat: 56.3269, lon: 44.0059 },
            'Самара': { lat: 53.1951, lon: 50.1069 },
            'Омск': { lat: 54.9893, lon: 73.3686 },
            'Ростов-на-Дону': { lat: 47.2221, lon: 39.7203 },
            'Уфа': { lat: 54.7351, lon: 55.9587 }
        };

        const base = coordinates[city] || coordinates['Москва'];
        return {
            lat: base.lat + (Math.random() * 0.1 - 0.05),
            lon: base.lon + (Math.random() * 0.1 - 0.05),
            accuracy: this._randomInt(50, 150)
        };
    }

    _generateActivityPeriod() {
        const creation = Date.now() - (this._randomInt(30, 365) * 24 * 60 * 60 * 1000);
        return {
            creation: creation,
            firstUse: creation + (this._randomInt(0, 7) * 24 * 60 * 60 * 1000),
            lastUse: Date.now() - (this._randomInt(0, 3) * 24 * 60 * 60 * 1000)
        };
    }

    _generateInterests(personalityType) {
        const interestsMap = {
            "tech_enthusiast": ["программирование", "гаджеты", "игры", "технологии", "айти", "робототехника"],
            "business_professional": ["бизнес", "финансы", "карьера", "недвижимость", "инвестиции", "менеджмент"],
            "student": ["учеба", "развлечения", "спорт", "путешествия", "музыка", "кино"],
            "casual_user": ["новости", "развлечения", "спорт", "кино", "кулинария", "автомобили"]
        };
        return interestsMap[personalityType] || ["новости", "развлечения", "спорт"];
    }

    _generateSearchPatterns(personalityType) {
        const queries = this.data.search_queries?.queries || {};
        const patterns = {};

        const categories = this.data.behaviors.personality_types[personalityType]?.search_categories || ['general'];

        for (const category of categories) {
            if (queries[category]) {
                patterns[category] = queries[category].map(query =>
                    this._fillQueryTemplate(query)
                ).slice(0, 10); // Ограничиваем количество запросов
            }
        }

        return patterns;
    }

    _fillQueryTemplate(template) {
        const templates = this.data.search_queries?.templates || {};
        return template.replace(/{(\w+)}/g, (match, key) => {
            return templates[key] ? this._randomChoice(templates[key]) : key;
        });
    }

    _generateBrowsingHabits(personality) {
        return {
            sessionsPerDay: personality.session_pattern?.sessions_per_day || 5,
            sitesPerSession: personality.session_pattern?.sites_per_session || 8,
            preferredCategories: personality.sites || ['news', 'social'],
            onlineTime: personality.online_time || 'daytime',
            timeSlots: this.data.behaviors.time_slots?.[personality.primary_time] || [{ start: 9, end: 18, weight: 1 }]
        };
    }

    _generateLogContent() {
        return `Лог LevelDB\nСоздан: ${new Date().toISOString()}\n`;
    }

    _generateManifestContent() {
        return Buffer.from([0x4D, 0x41, 0x4E, 0x49, 0x46, 0x45, 0x53, 0x54]); // "MANIFEST"
    }

    _chromeTime(timestamp = Date.now()) {
        const windowsEpoch = Date.UTC(1601, 0, 1);
        const microseconds = (timestamp - windowsEpoch) * 1000;
        return microseconds.toString();
    }

    async _generateFaviconsDatabase() {
        const faviconsPath = path.join(this.profilePath, 'Favicons');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(faviconsPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    db.run(`CREATE TABLE favicons(id INTEGER PRIMARY KEY, url TEXT, icon_data BLOB, last_updated INTEGER)`);

                    const sites = [
                        'yandex.ru', 'google.com', 'vk.com', 'youtube.com',
                        'mail.ru', 'github.com', 'stackoverflow.com', 'habr.com'
                    ];

                    sites.forEach((site, index) => {
                        db.run(`INSERT INTO favicons(url, last_updated) VALUES(?, ?)`,
                            [`https://${site}`, Date.now() - index * 86400000]);
                    });

                    db.close((err) => {
                        if (err) reject(err);
                        else resolve('Favicons database created');
                    });
                });
            });
        });
    }

    async _generateWebDataDatabase() {
        const webDataPath = path.join(this.profilePath, 'Web Data');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(webDataPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    db.run(`CREATE TABLE autofill(name TEXT, value TEXT, value_lower TEXT, date_created INTEGER, date_last_used INTEGER, count INTEGER)`);
                    db.run(`CREATE TABLE keywords(
                        id INTEGER PRIMARY KEY,
                        short_name TEXT,
                        keyword TEXT,
                        favicon_url TEXT,
                        url TEXT,
                        safe_for_autoreplace INTEGER,
                        originating_url TEXT,
                        date_created INTEGER,
                        usage_count INTEGER,
                        input_encodings TEXT,
                        show_in_default_list INTEGER,
                        suggest_url TEXT,
                        prepopulate_id INTEGER,
                        created_by_policy INTEGER,
                        instant_url TEXT,
                        last_modified INTEGER,
                        sync_guid TEXT,
                        alternate_urls TEXT,
                        image_url TEXT,
                        search_url_post_params TEXT,
                        suggest_url_post_params TEXT,
                        instant_url_post_params TEXT,
                        image_url_post_params TEXT,
                        new_tab_url TEXT
                    )`);
                    //db.run(`CREATE TABLE autofill_profiles(guid TEXT PRIMARY KEY, label TEXT, first_name TEXT, last_name TEXT, email TEXT, phone_number TEXT)`);

                    // РЕАЛЬНЫЕ ДАННЫЕ АВТОЗАПОЛНЕНИЯ
                    const autofillData = [
                        ['name', this.autofillData.name],
                        ['email', this.autofillData.email],
                        ['phone', this.autofillData.phone],
                        ['city', this.autofillData.address.city],
                        ['address', `ул. ${this.autofillData.address.street}, д. ${this.autofillData.address.building}`],
                        ['company', this.autofillData.company],
                        ['birth_date', this.autofillData.birth_date.toISOString().split('T')[0]]
                    ];

                    autofillData.forEach(([name, value], index) => {
                        db.run(`INSERT INTO autofill VALUES(?, ?, ?, ?, ?, ?)`,
                            [name, value, value.toLowerCase(),
                                Date.now() - index * 86400000, Date.now(),
                                this._randomInt(1, 20)]);
                    });

                    // ПРОФИЛИ АВТОЗАПОЛНЕНИЯ
                    /*db.run(`INSERT INTO autofill_profiles VALUES(?, ?, ?, ?, ?, ?)`, 
                        [this._generateHex(16), 'Основной профиль', 
                        this.autofillData.first_name, this.autofillData.last_name,
                        this.autofillData.email, this.autofillData.phone]);*/

                    // ПОИСКОВЫЕ СИСТЕМЫ С ИСТОРИЕЙ
                    const searchEngines = [
                        [1, 'Google', 'google.com', '', 'https://www.google.com/search?q={searchTerms}', 1, '', Date.now(), this._randomInt(50, 200), 'UTF-8', 1, '', 1, 0, '', Date.now(), this._generateHex(32), '', '', '', '', '', '', ''],
                        [2, 'Яндекс', 'yandex.ru', '', 'https://yandex.ru/search/?text={searchTerms}', 1, '', Date.now(), this._randomInt(100, 300), 'UTF-8', 1, '', 2, 0, '', Date.now(), this._generateHex(32), '', '', '', '', '', '', ''],
                        [3, 'YouTube', 'youtube.com', '', 'https://www.youtube.com/results?search_query={searchTerms}', 1, '', Date.now(), this._randomInt(30, 150), 'UTF-8', 1, '', 0, 0, '', Date.now(), this._generateHex(32), '', '', '', '', '', '', '']
                    ];

                    searchEngines.forEach(data => {
                        db.run(`INSERT INTO keywords VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, data);
                    });

                    db.close((err) => {
                        if (err) reject(err);
                        else resolve('Web Data database created with realistic autofill');
                    });
                });
            });
        });
    }

    // async _generateLoginDataDatabase() {
    //     const loginDataPath = path.join(this.profilePath, 'Login Data');
    //     return new Promise((resolve, reject) => {
    //         const db = new sqlite3.Database(loginDataPath, (err) => {
    //             if (err) return reject(err);

    //             db.serialize(() => {
    //                 db.run(`CREATE TABLE logins(origin_url TEXT, username_value TEXT, password_value BLOB, date_created INTEGER)`);

    //                 const logins = [
    //                     ['https://vk.com', this.userProfile.email],
    //                     ['https://github.com', this.userProfile.username],
    //                     ['https://yandex.ru', this.userProfile.email],
    //                     ['https://mail.google.com', this.userProfile.email]
    //                 ];

    //                 logins.forEach(([url, username], index) => {
    //                     db.run(`INSERT INTO logins VALUES(?, ?, ?, ?)`,
    //                         [url, username, Buffer.from('encrypted_password_' + this._generateId(16)),
    //                             Date.now() - index * 86400000]);
    //                 });

    //                 db.close((err) => {
    //                     if (err) reject(err);
    //                     else resolve('Login Data database created');
    //                 });
    //             });
    //         });
    //     });
    // }
    async _generateLoginDataDatabase() {
        const loginDataPath = path.join(this.profilePath, 'Login Data');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(loginDataPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    // ПОЛНАЯ структура таблицы logins как в Chrome
                    db.run(`CREATE TABLE logins(
                        origin_url VARCHAR NOT NULL,
                        action_url VARCHAR,
                        username_element VARCHAR,
                        username_value VARCHAR,
                        password_element VARCHAR,
                        password_value BLOB,
                        submit_element VARCHAR,
                        signon_realm VARCHAR NOT NULL,
                        preferred INTEGER NOT NULL,
                        date_created INTEGER NOT NULL,
                        blacklisted_by_user INTEGER NOT NULL,
                        scheme INTEGER NOT NULL,
                        password_type INTEGER,
                        times_used INTEGER,
                        form_data BLOB,
                        display_name VARCHAR,
                        icon_url VARCHAR,
                        federation_url VARCHAR,
                        skip_zero_click INTEGER,
                        generation_upload_status INTEGER,
                        possible_username_pairs BLOB,
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date_last_used INTEGER,
                        moving_blocked_for BLOB,
                        date_password_modified INTEGER
                    )`);

                    // Данные с ВСЕМИ необходимыми полями (25 значений)
                    const logins = [
                        [
                            'https://vk.com', // origin_url
                            'https://vk.com/login', // action_url
                            'email', // username_element
                            this.userProfile.email, // username_value
                            'password', // password_element
                            Buffer.from('encrypted_password_' + this._generateId(16)), // password_value
                            'button[type="submit"]', // submit_element
                            'https://vk.com/', // signon_realm
                            1, // preferred
                            Date.now() - 86400000, // date_created
                            0, // blacklisted_by_user
                            0, // scheme
                            0, // password_type
                            this._randomInt(1, 20), // times_used
                            null, // form_data
                            'VK', // display_name
                            'https://vk.com/favicon.ico', // icon_url
                            '', // federation_url
                            0, // skip_zero_click
                            0, // generation_upload_status
                            null, // possible_username_pairs
                            // id - НЕ включаем, так как AUTOINCREMENT
                            Date.now(), // date_last_used
                            null, // moving_blocked_for
                            Date.now() - 86400000 // date_password_modified
                        ]
                    ];

                    // Подготовленный запрос с ВСЕМИ 24 колонками (id исключен)
                    const stmt = db.prepare(`INSERT INTO logins(
                        origin_url, action_url, username_element, username_value, password_element,
                        password_value, submit_element, signon_realm, preferred, date_created,
                        blacklisted_by_user, scheme, password_type, times_used, form_data,
                        display_name, icon_url, federation_url, skip_zero_click, generation_upload_status,
                        possible_username_pairs, date_last_used, moving_blocked_for, date_password_modified
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                    logins.forEach(loginData => {
                        stmt.run(loginData);
                    });

                    stmt.finalize();

                    // Meta таблица
                    db.run(`CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)`);
                    db.run(`INSERT INTO meta VALUES('version','104')`);
                    db.run(`INSERT INTO meta VALUES('last_compatible_version','99')`);

                    db.close((err) => {
                        if (err) reject(err);
                        else resolve('Login Data database created with correct structure');
                    });
                });
            });
        });
    }

    async _generateNetworkActionPredictor() {
        const predictorPath = path.join(this.profilePath, 'Network Action Predictor');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(predictorPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    db.run(`CREATE TABLE network_action_predictor(user_text TEXT, url TEXT, number_of_hits INTEGER)`);

                    const predictions = [
                        ['яндекс', 'https://yandex.ru', this._randomInt(5, 50)],
                        ['google', 'https://google.com', this._randomInt(5, 30)],
                        ['вк', 'https://vk.com', this._randomInt(3, 25)],
                        ['ютуб', 'https://youtube.com', this._randomInt(10, 40)]
                    ];

                    predictions.forEach(([text, url, hits]) => {
                        db.run(`INSERT INTO network_action_predictor VALUES(?, ?, ?)`, [text, url, hits]);
                    });

                    db.close((err) => {
                        if (err) reject(err);
                        else resolve('Network Action Predictor created');
                    });
                });
            });
        });
    }

    _generateShortcuts() {
        return {
            "shortcuts": [
                {
                    "url": "https://yandex.ru",
                    "title": "Яндекс",
                    "last_visit": this._chromeTime(Date.now() - 86400000)
                },
                {
                    "url": "https://google.com",
                    "title": "Google",
                    "last_visit": this._chromeTime(Date.now() - 172800000)
                }
            ]
        };
    }

    _getRandomStreet() {
        const streets = ['Ленина', 'Пушкина', 'Гагарина', 'Советская', 'Мира', 'Центральная'];
        return this._randomChoice(streets);
    }

    _loadDataFiles() {
        const dataPath = path.resolve(__dirname, 'data');
        const files = {
            users: 'users.json',
            user_agents: 'user_agents.json',
            proxies: 'proxies.json',
            websites: 'websites.json',
            search_queries: 'search_queries.json',
            behaviors: 'behaviors.json',
            behavior_patterns: 'behavior_patterns.json'
        };

        const data = {};
        for (const [key, filename] of Object.entries(files)) {
            try {
                const filePath = path.join(dataPath, filename);
                if (fs.existsSync(filePath)) {
                    data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                } else {
                    // Генерируем базовые данные если файлов нет
                    data[key] = this._generateDefaultData(key);
                }
            } catch (error) {
                console.warn(`Не удалось загрузить ${filename}:`, error.message);
                data[key] = this._generateDefaultData(key);
            }
        }
        return data;
    }

    _generateDefaultData(type) {
        const generators = {
            users: () => ({
                first_names: [
                    'Александр', 'Дмитрий', 'Михаил', 'Сергей', 'Андрей', 'Алексей', 'Екатерина', 'Мария', 'Анна', 'Ольга',
                    'Иван', 'Максим', 'Артем', 'Владимир', 'Кирилл', 'Никита', 'Елена', 'Наталья', 'Ирина', 'Светлана',
                    'Виктор', 'Константин', 'Павел', 'Роман', 'Евгений', 'Тимофей', 'Георгий', 'Станислав', 'Василий', 'Юрий',
                    'Анастасия', 'Татьяна', 'Юлия', 'Ксения', 'Алина', 'Дарья', 'Полина', 'София', 'Вероника', 'Александра',
                    'Валерия', 'Вадим', 'Игорь', 'Олег', 'Григорий', 'Борис', 'Федор', 'Семен', 'Леонид', 'Петр',
                    'Валентин', 'Аркадий', 'Всеволод', 'Вячеслав', 'Геннадий', 'Даниил', 'Егор', 'Захар', 'Илья', 'Клим',
                    'Лев', 'Макар', 'Николай', 'Ростислав', 'Степан', 'Тарас', 'Филипп', 'Эдуард', 'Ярослав', 'Агния',
                    'Алевтина', 'Алла', 'Ангелина', 'Анфиса', 'Василиса', 'Галина', 'Диана', 'Евгения', 'Елизавета', 'Жанна',
                    'Зоя', 'Инна', 'Кира', 'Лариса', 'Лидия', 'Любовь', 'Людмила', 'Маргарита', 'Марина', 'Милана',
                    'Надежда', 'Нина', 'Оксана', 'Раиса', 'Регина', 'Римма', 'Серафима', 'Таисия', 'Ульяна', 'Эльвира',
                    'Яна', 'Адам', 'Адриан', 'Альберт', 'Амос', 'Анатолий', 'Арсений', 'Артур', 'Богдан', 'Валентин',
                    'Варфоломей', 'Виталий', 'Влад', 'Владислав', 'Гарри', 'Глеб', 'Давид', 'Денис', 'Емельян', 'Ефим',
                    'Игнат', 'Иосиф', 'Камиль', 'Карен', 'Кузьма', 'Лука', 'Марат', 'Матвей', 'Мирон', 'Нестор',
                    'Остап', 'Прохор', 'Радик', 'Ренат', 'Роберт', 'Рудольф', 'Савелий', 'Савва', 'Святослав', 'Соломон',
                    'Тимур', 'Тихон', 'Феликс', 'Эрик', 'Юлиан', 'Яков', 'Ян', 'Агата', 'Агнесса', 'Ада',
                    'Азиза', 'Аида', 'Акулина', 'Альбина', 'Амалия', 'Анжела', 'Анжелика', 'Ариадна', 'Арина', 'Беатриса',
                    'Берта', 'Божена', 'Валерия', 'Ванда', 'Варвара', 'Василина', 'Веста', 'Виолетта', 'Владислава', 'Гелла',
                    'Гертруда', 'Гульнара', 'Дана', 'Дина', 'Доминика', 'Ева', 'Евдокия', 'Есения', 'Жасмин', 'Зара',
                    'Зинаида', 'Иванна', 'Изабелла', 'Изольда', 'Илона', 'Инга', 'Ираида', 'Калерия', 'Капитолина', 'Карина',
                    'Клавдия', 'Клара', 'Клементина', 'Кристина', 'Лада', 'Лейла', 'Леся', 'Лиана', 'Лилиана', 'Лина',
                    'Лолита', 'Любава', 'Люся', 'Майя', 'Марта', 'Мелания', 'Милена', 'Мирослава', 'Моника', 'Наталия',
                    'Нелли', 'Ника', 'Нонна', 'Олеся', 'Паула', 'Пелагея', 'Радмила', 'Роза', 'Роксана', 'Русалина',
                    'Сабина', 'Санта', 'Снежана', 'Станислава', 'Сусанна', 'Сюзанна', 'Тереза', 'Устинья', 'Фаина', 'Флоренция',
                    'Фрида', 'Цветана', 'Эвелина', 'Эдита', 'Элеонора', 'Элина', 'Элла', 'Эльза', 'Эмма', 'Юлиана',
                    'Юния', 'Ядвига', 'Ярослава', 'Ясмина', 'Абрам', 'Август', 'Авдей', 'Авель', 'Аверьян', 'Авксентий',
                    'Авраам', 'Агап', 'Агафон', 'Адам', 'Адий', 'Адонис', 'Акакий', 'Акиндин', 'Александр', 'Алексий',
                    'Альфред', 'Анатолий', 'Андриан', 'Андрон', 'Андроник', 'Анект', 'Антон', 'Антонин', 'Антроп', 'Аристарх',
                    'Аркадий', 'Арнольд', 'Артем', 'Артемий', 'Архип', 'Асаф', 'Афанасий', 'Афиноген', 'Бажен', 'Бенедикт',
                    'Богдан', 'Болеслав', 'Борис', 'Борислав', 'Боян', 'Бронислав', 'Будимир', 'Вавила', 'Вадим', 'Валентин',
                    'Валериан', 'Варлаам', 'Варфоломей', 'Василий', 'Васой', 'Велизар', 'Венедикт', 'Вениамин', 'Викентий', 'Виктор',
                    'Викторин', 'Виссарион', 'Виталий', 'Владилен', 'Владимир', 'Владислав', 'Владлен', 'Влас', 'Всеволод', 'Вячеслав',
                    'Гавриил', 'Галактион', 'Гедеон', 'Геннадий', 'Георгий', 'Герасим', 'Герман', 'Глеб', 'Гордей', 'Григорий',
                    'Гурий', 'Давид', 'Давыд', 'Данакт', 'Даниил', 'Демид', 'Демьян', 'Денис', 'Дмитрий', 'Добрыня',
                    'Дорофей', 'Евгений', 'Евграф', 'Евдоким', 'Евсей', 'Евстафий', 'Егор', 'Елизар', 'Елисей', 'Емельян',
                    'Епифан', 'Еремей', 'Ермолай', 'Ерофей', 'Ефим', 'Ефрем', 'Ждан', 'Захар', 'Зиновий', 'Зорий',
                    'Иван', 'Игнатий', 'Игорь', 'Измаил', 'Изот', 'Изяслав', 'Иларион', 'Илиан', 'Илья', 'Иннокентий',
                    'Иосиф', 'Ипатий', 'Ипполит', 'Ираклий', 'Исаак', 'Исидор', 'Казимир', 'Каллистрат', 'Капитон', 'Ким',
                    'Кир', 'Кирилл', 'Климент', 'Кондрат', 'Конон', 'Константин', 'Корнил', 'Кузьма', 'Куприян', 'Лавр',
                    'Лаврентий', 'Ладимир', 'Лазарь', 'Лев', 'Леон', 'Леонид', 'Леонтий', 'Логвин', 'Лука', 'Лукьян',
                    'Любим', 'Любомир', 'Макар', 'Максим', 'Мамонт', 'Марк', 'Мартын', 'Матвей', 'Мефодий', 'Мечислав',
                    'Милан', 'Мирон', 'Мирослав', 'Митрофан', 'Михаил', 'Михей', 'Модест', 'Моисей', 'Мстислав', 'Назар',
                    'Наум', 'Нестор', 'Никанор', 'Никита', 'Никифор', 'Никодим', 'Николай', 'Никон', 'Олег', 'Онисим',
                    'Орест', 'Осип', 'Оскар', 'Павел', 'Панкрат', 'Пантелеймон', 'Парамон', 'Петр', 'Платон', 'Поликарп',
                    'Порфирий', 'Потап', 'Пров', 'Прокоп', 'Прохор', 'Радий', 'Радим', 'Ратибор', 'Ратмир', 'Родион',
                    'Роман', 'Ростислав', 'Руслан', 'Руф', 'Рюрик', 'Савва', 'Савелий', 'Самсон', 'Светозар', 'Святополк',
                    'Севастьян', 'Семен', 'Серафим', 'Сергей', 'Сигизмунд', 'Сильвестр', 'Созон', 'Сократ', 'Соломон', 'Софрон',
                    'Спартак', 'Спиридон', 'Станислав', 'Степан', 'Стоян', 'Тарас', 'Твердислав', 'Творимир', 'Терентий', 'Тимофей',
                    'Тимур', 'Тит', 'Тихон', 'Трифон', 'Трофим', 'Ульян', 'Фаддей', 'Федор', 'Федот', 'Феликс',
                    'Феоктист', 'Феофан', 'Феофил', 'Ферапонт', 'Филат', 'Филимон', 'Филипп', 'Фирс', 'Флор', 'Фома',
                    'Фортунат', 'Фрол', 'Харитон', 'Христиан', 'Христофор', 'Чеслав', 'Эдуард', 'Эмиль', 'Эммануил', 'Эраст',
                    'Эрнест', 'Эрнст', 'Юлиан', 'Юлий', 'Юрий', 'Яков', 'Ян', 'Януарий', 'Ярополк', 'Ярослав',
                    'Абрамий', 'Авакум', 'Аввакум', 'Августин', 'Авдей', 'Аверкий', 'Авив', 'Авксентий', 'Автоном', 'Агапит',
                    'Агафангел', 'Агафодор', 'Агафон', 'Аггей', 'Адам', 'Адис', 'Адольф', 'Адриан', 'Азарий', 'Акакий',
                    'Акинф', 'Александр', 'Алексий', 'Алемдар', 'Альберт', 'Альфред', 'Амадей', 'Амадеус', 'Амвросий', 'Амос',
                    'Ананий', 'Анатолий', 'Андрей', 'Андроник', 'Анект', 'Аникей', 'Аникита', 'Анисим', 'Антип', 'Антон',
                    'Антонин', 'Анфим', 'Аполлинарий', 'Аполлон', 'Арефий', 'Аристарх', 'Аркадий', 'Арнольд', 'Арсен', 'Арсений',
                    'Артемий', 'Артур', 'Архип', 'Асаф', 'Афанасий', 'Афиноген', 'Африкан', 'Бажен', 'Богдан', 'Болеслав',
                    'Бонифаций', 'Борис', 'Борислав', 'Боян', 'Бронислав', 'Будимир', 'Вадим', 'Валентин', 'Валерий', 'Вальтер',
                    'Варлаам', 'Варфоломей', 'Василий', 'Вахтанг', 'Велимир', 'Венедикт', 'Вениамин', 'Викентий', 'Виктор', 'Вилен',
                    'Виссарион', 'Виталий', 'Витольд', 'Владимир', 'Владислав', 'Владлен', 'Влас', 'Всеволод', 'Вячеслав', 'Гавриил',
                    'Галактион', 'Геласий', 'Гелий', 'Геннадий', 'Генрих', 'Георгий', 'Герасим', 'Герман', 'Гермоген', 'Глеб',
                    'Гордей', 'Горислав', 'Градимир', 'Григорий', 'Гурий', 'Давид', 'Давыд', 'Дамир', 'Даниил', 'Демид',
                    'Дементий', 'Демьян', 'Денис', 'Джамиль', 'Джереми', 'Джозеф', 'Джон', 'Диомид', 'Дмитрий', 'Добрыня',
                    'Доминик', 'Дорофей', 'Евгений', 'Евграф', 'Евдоким', 'Евсей', 'Евстафий', 'Евстигней', 'Егор', 'Елизар',
                    'Елисей', 'Емельян', 'Епифан', 'Еремей', 'Ермил', 'Ермолай', 'Ерофей', 'Ефим', 'Ефрем', 'Жан',
                    'Ждан', 'Захар', 'Зиновий', 'Зорий', 'Ибрагим', 'Иван', 'Игнатий', 'Игорь', 'Измаил', 'Изяслав',
                    'Иларион', 'Илиан', 'Илья', 'Иннокентий', 'Иосиф', 'Ипатий', 'Ипполит', 'Ираклий', 'Исаак', 'Исай',
                    'Исидор', 'Июлий', 'Казимир', 'Каллиник', 'Каллистрат', 'Капитон', 'Карл', 'Касьян', 'Ким', 'Кир',
                    'Кирилл', 'Климент', 'Кондрат', 'Конон', 'Константин', 'Корнилий', 'Кузьма', 'Куприян', 'Лавр', 'Лаврентий',
                    'Ладимир', 'Ладислав', 'Лазарь', 'Лев', 'Леон', 'Леонид', 'Леонтий', 'Логгин', 'Лука', 'Лукьян',
                    'Любим', 'Любомир', 'Людвиг', 'Макар', 'Максим', 'Максимилиан', 'Мариан', 'Марк', 'Мартин', 'Матвей',
                    'Мелентий', 'Мефодий', 'Мечислав', 'Милан', 'Милен', 'Мирон', 'Мирослав', 'Митрофан', 'Михаил', 'Михей',
                    'Модест', 'Моисей', 'Мстислав', 'Назар', 'Наум', 'Нестор', 'Никанор', 'Никита', 'Никифор', 'Никодим',
                    'Николай', 'Никон', 'Нил', 'Ной', 'Олег', 'Олимпий', 'Онисим', 'Орест', 'Осип', 'Оскар',
                    'Павел', 'Панкрат', 'Пантелеймон', 'Парамон', 'Парфен', 'Патрикей', 'Пахом', 'Петр', 'Пимен', 'Платон',
                    'Поликарп', 'Порфирий', 'Потап', 'Пров', 'Прокл', 'Прокофий', 'Прокоп', 'Прохор', 'Радий', 'Радим',
                    'Радислав', 'Радомир', 'Ратибор', 'Ратмир', 'Рафаил', 'Родион', 'Роман', 'Ростислав', 'Рубен', 'Руслан',
                    'Руф', 'Рюрик', 'Савелий', 'Самсон', 'Светозар', 'Святополк', 'Севастьян', 'Семен', 'Серафим', 'Сергей',
                    'Сильвестр', 'Созон', 'Сократ', 'Соломон', 'Софрон', 'Спартак', 'Спиридон', 'Станислав', 'Степан', 'Стоян',
                    'Тарас', 'Твердислав', 'Творимир', 'Терентий', 'Тимофей', 'Тимур', 'Тит', 'Тихон', 'Трифон', 'Трофим',
                    'Ульян', 'Фаддей', 'Федор', 'Федот', 'Феликс', 'Феоктист', 'Феофан', 'Феофил', 'Ферапонт', 'Филат',
                    'Филимон', 'Филипп', 'Фирс', 'Флор', 'Фома', 'Фортунат', 'Фрол', 'Харитон', 'Харлампий', 'Христиан',
                    'Христофор', 'Чеслав', 'Эдуард', 'Эмиль', 'Эммануил', 'Эраст', 'Эрнест', 'Эрнст', 'Юлиан', 'Юлий',
                    'Юрий', 'Яков', 'Ян', 'Януарий', 'Ярополк', 'Ярослав', 'Агафья', 'Аглая', 'Агния', 'Агриппина',
                    'Ада', 'Аделаида', 'Аделина', 'Адиля', 'Адриана', 'Аза', 'Азалия', 'Аида', 'Акилина', 'Аксинья',
                    'Акулина', 'Алевтина', 'Александра', 'Алена', 'Алина', 'Алиса', 'Алла', 'Альбина', 'Амалия', 'Анастасия',
                    'Ангелина', 'Анжела', 'Анжелика', 'Анисья', 'Анна', 'Антонина', 'Анфиса', 'Аполлинария', 'Ариадна', 'Арина',
                    'Арьяна', 'Аста', 'Астра', 'Афанасия', 'Беатриса', 'Белла', 'Береслава', 'Богдана', 'Божена', 'Борислава',
                    'Бронислава', 'Валентина', 'Валерия', 'Ванда', 'Варвара', 'Василиса', 'Васса', 'Венера', 'Вера', 'Вероника',
                    'Веселина', 'Весна', 'Виктория', 'Вилена', 'Вилла', 'Виола', 'Виталина', 'Влада', 'Владислава', 'Владлена',
                    'Воислава', 'Всеслава', 'Галина', 'Галя', 'Гелла', 'Генриетта', 'Гелена', 'Глафира', 'Гликерия', 'Горислава',
                    'Дана', 'Дара', 'Дарья', 'Дария', 'Джамиля', 'Диана', 'Дина', 'Динара', 'Добромила', 'Доброслава',
                    'Доминика', 'Дора', 'Ева', 'Евангелина', 'Евгения', 'Евдокия', 'Евлалия', 'Евлампия', 'Евпраксия', 'Евфросиния',
                    'Екатерина', 'Елена', 'Елизавета', 'Епистима', 'Ермиония', 'Жанна', 'Жозефина', 'Забава', 'Заира', 'Замира',
                    'Зара', 'Зарема', 'Зарина', 'Земфира', 'Зинаида', 'Злата', 'Зоряна', 'Зоя', 'Иванна', 'Ида',
                    'Изабелла', 'Изольда', 'Илга', 'Илина', 'Илона', 'Инга', 'Инесса', 'Инна', 'Иоанна', 'Ираида',
                    'Ирина', 'Ирма', 'Ия', 'Калерия', 'Капитолина', 'Карина', 'Каролина', 'Кира', 'Клавдия', 'Клара',
                    'Клариса', 'Клементина', 'Кондратия', 'Констанция', 'Кристина', 'Ксения', 'Лада', 'Лариса', 'Лейла', 'Леона',
                    'Леонила', 'Леся', 'Лидия', 'Лилия', 'Лина', 'Лолита', 'Луиза', 'Лукерья', 'Любава', 'Любовь',
                    'Любомила', 'Любомира', 'Людмила', 'Люсьена', 'Мавра', 'Мадина', 'Майя', 'Мальвина', 'Маргарита', 'Марианна',
                    'Марина', 'Мария', 'Марфа', 'Марьяна', 'Мастридия', 'Матильда', 'Мелания', 'Милица', 'Милена', 'Милослава',
                    'Мира', 'Мирослава', 'Мирра', 'Млада', 'Мстислава', 'Муза', 'Надежда', 'Наталья', 'Нелли', 'Неонила',
                    'Ника', 'Нина', 'Нинель', 'Нонна', 'Нора', 'Оксана', 'Октавия', 'Олеся', 'Ольга', 'Павла',
                    'Пелагея', 'Полина', 'Прасковья', 'Рада', 'Радмила', 'Раиса', 'Регина', 'Рената', 'Римма', 'Рогнеда',
                    'Роза', 'Роксана', 'Ростислава', 'Руслана', 'Руфина', 'Руфь', 'Сабина', 'Саломея', 'Светлана', 'Светозара',
                    'Святослава', 'Севастьяна', 'Серафима', 'Снежана', 'София', 'Станислава', 'Стелла', 'Степанида', 'Сусанна', 'Таисия',
                    'Тамара', 'Татьяна', 'Ульяна', 'Устинья', 'Фаина', 'Феврония', 'Федора', 'Фекла', 'Фелицата', 'Флора',
                    'Фрида', 'Харита', 'Цветана', 'Эдита', 'Элеонора', 'Элина', 'Элла', 'Эльвира', 'Эльза', 'Эльмира',
                    'Эмилия', 'Эмма', 'Эрика', 'Юлиана', 'Юлия', 'Юния', 'Юнона', 'Ядвига', 'Яна', 'Янина',
                    'Ярослава', 'Ясмина'
                ],
                last_names: [
                    'Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Новиков', 'Федоров', 'Морозов',
                    'Волков', 'Алексеев', 'Лебедев', 'Семенов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов',
                    'Андреев', 'Макаров', 'Никитин', 'Захаров', 'Зайцев', 'Соловьев', 'Борисов', 'Яковлев', 'Григорьев', 'Романов',
                    'Воробьев', 'Сергеев', 'Киселев', 'Максимов', 'Поляков', 'Фомин', 'Владимиров', 'Филиппов', 'Марков', 'Беляев',
                    'Тимофеев', 'Федотов', 'Чернов', 'Мартынов', 'Савельев', 'Шестаков', 'Голубев', 'Кудрявцев', 'Прохоров', 'Назаров',
                    'Ефимов', 'Баранов', 'Королев', 'Афанасьев', 'Власов', 'Маслов', 'Исаков', 'Тихонов', 'Аксенов', 'Гаврилов',
                    'Родионов', 'Котов', 'Горбунов', 'Крюков', 'Быков', 'Зуев', 'Третьяков', 'Сазонов', 'Симонов', 'Михайлов',
                    'Ширяев', 'Александров', 'Коновалов', 'Шелепов', 'Харитонов', 'Артемьев', 'Сорокин', 'Дмитриев', 'Калинин', 'Анисимов',
                    'Лапин', 'Лукин', 'Рожков', 'Туров', 'Комаров', 'Белов', 'Жуков', 'Воронов', 'Цветков', 'Давыдов',
                    'Журавлев', 'Хохлов', 'Бирюков', 'Копылов', 'Щербаков', 'Блинов', 'Игнатьев', 'Колесников', 'Карпов', 'Абрамов',
                    'Рыбаков', 'Лазарев', 'Медведев', 'Ершов', 'Кошелев', 'Потапов', 'Панов', 'Рогов', 'Одинцов', 'Гусев',
                    'Агеев', 'Нестеров', 'Петухов', 'Логинов', 'Герасимов', 'Прокофьев', 'Мельников', 'Кириллов', 'Шмидт', 'Денисов',
                    'Громов', 'Фокин', 'Дементьев', 'Ситников', 'Царев', 'Корнилов', 'Пахомов', 'Золотов', 'Матвеев', 'Бобылев',
                    'Жданов', 'Белоусов', 'Мухин', 'Лавров', 'Гордеев', 'Петровский', 'Богатырев', 'Тарасов', 'Шарапов', 'Моисеев',
                    'Суханов', 'Горшков', 'Еремин', 'Терентьев', 'Лыткин', 'Кобелев', 'Уваров', 'Старостин', 'Капустин', 'Корчагин',
                    'Маркелов', 'Кононов', 'Ларин', 'Евдокимов', 'Гребнев', 'Токарев', 'Русаков', 'Савин', 'Орехов', 'Мышкин',
                    'Носков', 'Доронин', 'Зимин', 'Субботин', 'Устинов', 'Вишняков', 'Евсеев', 'Лаврентьев', 'Брагин', 'Константинов',
                    'Корнев', 'Кузьмин', 'Демин', 'Шубин', 'Сафонов', 'Поздняков', 'Казаков', 'Шилов', 'Большаков', 'Панфилов',
                    'Костин', 'Лобанова', 'Воронцов', 'Варламов', 'Приходько', 'Горбачев', 'Селиванов', 'Цветаев', 'Шевцов', 'Филатов',
                    'Платонов', 'Некрасов', 'Балашов', 'Бычков', 'Софронов', 'Островский', 'Меркушев', 'Литвинов', 'Ермолаев', 'Стрельцов',
                    'Гуляев', 'Тихомиров', 'Ильин', 'Крамской', 'Савицкий', 'Белкин', 'Марьин', 'Круглов', 'Бессонов', 'Дроздов',
                    'Черкасов', 'Антипов', 'Зверев', 'Светлов', 'Малышев', 'Дьяконов', 'Рябов', 'Муравьев', 'Руднев', 'Владимировский',
                    'Туманов', 'Карелин', 'Котельников', 'Суворов', 'Краснов', 'Кожевников', 'Веселов', 'Лужков', 'Хромов', 'Яшин',
                    'Селезнев', 'Нефедов', 'Спиридонов', 'Раков', 'Самойлов', 'Курганов', 'Демьянов', 'Коваленко', 'Тихонравов', 'Клюев',
                    'Воронков', 'Лаптев', 'Пименов', 'Панков', 'Чернышев', 'Андрианов', 'Павликов', 'Горлин', 'Сахаров', 'Ушаков',
                    'Тютчев', 'Демченко', 'Золотарев', 'Коробов', 'Юдин', 'Щукин', 'Наумов', 'Шерстнев', 'Ладыгин', 'Калугин',
                    'Снегирев', 'Гладков', 'Долгов', 'Судаков', 'Колосов', 'Пантелеев', 'Отставнов', 'Чистяков', 'Носов', 'Широков',
                    'Михеев', 'Данилов', 'Головин', 'Порошин', 'Великанов', 'Карасев', 'Завьялов', 'Богомолов', 'Щеглов', 'Фирсов',
                    'Абросимов', 'Авдеев', 'Агафонов', 'Акимов', 'Алехин', 'Ананьев', 'Андреевский', 'Антипов', 'Архипов', 'Астафьев',
                    'Астахов', 'Бабаев', 'Баженов', 'Балакин', 'Барановский', 'Барсуков', 'Басов', 'Бахтин', 'Белозеров', 'Беляков',
                    'Березин', 'Беркутов', 'Беспалов', 'Бирюков', 'Благов', 'Богданов', 'Болотов', 'Борисоглебский', 'Бородин', 'Бочаров',
                    'Брусникин', 'Булатов', 'Булгаков', 'Буров', 'Бутырин', 'Вавилов', 'Важенин', 'Варенцов', 'Васнецов', 'Ведерников',
                    'Велихов', 'Венедиктов', 'Вершинин', 'Вешняков', 'Виноградов', 'Витковский', 'Владиславлев', 'Водопьянов', 'Вознесенский', 'Волгин',
                    'Волошин', 'Воронков', 'Второв', 'Высоцкий', 'Гаврилов', 'Гайдуков', 'Галкин', 'Ганичев', 'Генералов', 'Георгиев',
                    'Герасимов', 'Герман', 'Глебов', 'Голиков', 'Голованов', 'Головина', 'Гончаров', 'Горбатов', 'Горбунков', 'Горелов',
                    'Горячев', 'Грачев', 'Греков', 'Грибов', 'Гришин', 'Громыко', 'Грушин', 'Губанов', 'Гурьев', 'Гущин',
                    'Данильцев', 'Девятов', 'Дегтярев', 'Дедов', 'Демидов', 'Державин', 'Добролюбов', 'Долгоруков', 'Дорофеев', 'Достоевский',
                    'Дружинин', 'Дубинин', 'Дубов', 'Дубровский', 'Дьячков', 'Евстигнеев', 'Егоров', 'Елизаров', 'Ельцин', 'Емельянов',
                    'Ерофеев', 'Ершов', 'Ефимов', 'Жаров', 'Жбанов', 'Железнов', 'Жилин', 'Жириновский', 'Жолудов', 'Журавлев',
                    'Заболотный', 'Завражнов', 'Задорнов', 'Заикин', 'Закревский', 'Залесский', 'Замыслов', 'Занков', 'Запорожский', 'Зарубин',
                    'Заславский', 'Захаров', 'Звягинцев', 'Земцов', 'Зимин', 'Зинченко', 'Злобин', 'Золотусский', 'Зонтов', 'Зорин',
                    'Зубков', 'Зубов', 'Зуев', 'Зыков', 'Ивановский', 'Ивашутин', 'Игнатов', 'Измайлов', 'Ильинский', 'Ильюшин',
                    'Илюхин', 'Исаев', 'Исайчев', 'Каблуков', 'Каверин', 'Каганович', 'Кадников', 'Казаков', 'Казанцев', 'Калачев',
                    'Калашников', 'Калистратов', 'Калмыков', 'Каменев', 'Каменский', 'Камусин', 'Кандинский', 'Капица', 'Карамзин', 'Карасев',
                    'Каргашин', 'Каренин', 'Карташов', 'Касаткин', 'Катаев', 'Катин', 'Каштанов', 'Киреев', 'Кирсанов', 'Кирьянов',
                    'Кислов', 'Климов', 'Клюев', 'Князев', 'Ковалев', 'Ковалевский', 'Кожин', 'Козинцев', 'Козловский', 'Колесников',
                    'Колмогоров', 'Колобов', 'Колокольцев', 'Колчин', 'Кольцов', 'Комиссаров', 'Комолов', 'Кондратов', 'Кондратьев', 'Кондрашин',
                    'Конин', 'Конкин', 'Кононов', 'Конюхов', 'Копейкин', 'Копнин', 'Коржаков', 'Корнеев', 'Коробейников', 'Королевский',
                    'Коротин', 'Коршунов', 'Косарев', 'Костиков', 'Костомаров', 'Костюков', 'Котлов', 'Кочергин', 'Кочетков', 'Кошевой',
                    'Кравцов', 'Краев', 'Красноперов', 'Красовский', 'Кренделев', 'Кривошеин', 'Кропоткин', 'Кругликов', 'Крупин', 'Крутов',
                    'Крылов', 'Крымов', 'Крючков', 'Кудрин', 'Кудряшов', 'Кузичев', 'Кузьминых', 'Куклачев', 'Кулешов', 'Кулибин',
                    'Куликов', 'Куприянов', 'Курбатов', 'Курехин', 'Курчатов', 'Кутузов', 'Куценко', 'Кушнарев', 'Лавренов', 'Лагутенко',
                    'Лазарев', 'Ландышев', 'Лапшин', 'Ларионов', 'Ласкин', 'Лебедев', 'Левин', 'Левитан', 'Левченко', 'Леднев',
                    'Лейкин', 'Ленский', 'Леонов', 'Леонтьев', 'Лепский', 'Лермонтов', 'Лесков', 'Летов', 'Ливанов', 'Липский',
                    'Лисовой', 'Литвинов', 'Лихachev', 'Лобанов', 'Ловчев', 'Ломоносов', 'Лосев', 'Лужков', 'Лукьянов', 'Лыков',
                    'Львов', 'Любимов', 'Лядов', 'Лялин', 'Макаров', 'Макеев', 'Максимов', 'Малахов', 'Маликов', 'Малкин',
                    'Малютин', 'Мамаев', 'Манаев', 'Мануйлов', 'Маренин', 'Маринов', 'Марков', 'Мартынов', 'Масленников', 'Матвиенко',
                    'Матусов', 'Махнов', 'Машеров', 'Медников', 'Мелентьев', 'Мельников', 'Менделеев', 'Меньшиков', 'Меренков', 'Мещеряков',
                    'Миклашевский', 'Микоян', 'Милехин', 'Милорадов', 'Милюков', 'Минеев', 'Миронов', 'Митрофанов', 'Михалков', 'Мишин',
                    'Можаев', 'Моисеев', 'Мокроусов', 'Молчанов', 'Моргунов', 'Морозов', 'Москвин', 'Муратов', 'Мурин', 'Мухортов',
                    'Мягков', 'Набоков', 'Нагорный', 'Наджиев', 'Назаров', 'Найденов', 'Нарышкин', 'Наумов', 'Невский', 'Невзоров',
                    'Негодяев', 'Недобежкин', 'Некипелов', 'Некрасов', 'Нелидов', 'Немцов', 'Нестеров', 'Нефедов', 'Нечаев', 'Никаноров',
                    'Николаев', 'Никольский', 'Никонов', 'Никулин', 'Новиков', 'Новожилов', 'Носов', 'Нуриев', 'Обухов', 'Овечкин',
                    'Огородников', 'Озеров', 'Окунев', 'Олейников', 'Оленев', 'Ольховский', 'Опалин', 'Орлов', 'Осинцев', 'Островерхов',
                    'Остроумов', 'Панарин', 'Панкратов', 'Папушин', 'Парамонов', 'Парфенов', 'Пастухов', 'Пахомов', 'Пенкин', 'Перлов',
                    'Пермяков', 'Пестов', 'Петров', 'Петровский', 'Петухов', 'Пешков', 'Пивоваров', 'Пименов', 'Пирогов', 'Пискунов',
                    'Плахов', 'Плеханов', 'Плющев', 'Погорельский', 'Подольский', 'Поздняков', 'Покровский', 'Поликарпов', 'Полозов', 'Полунин',
                    'Поляков', 'Пономарев', 'Попов', 'Порохов', 'Портнов', 'Поспелов', 'Постников', 'Потапов', 'Похлебкин', 'Прокопьев',
                    'Пронин', 'Проскурин', 'Протасов', 'Прохоров', 'Пугачев', 'Путин', 'Пушкарев', 'Пушкин', 'Пырьев', 'Разумовский',
                    'Райкин', 'Распутин', 'Расторгуев', 'Рахманинов', 'Репин', 'Решетников', 'Родин', 'Рождественский', 'Розанов', 'Рокоссовский',
                    'Романов', 'Романцев', 'Ростиславлев', 'Рублев', 'Руденко', 'Рудский', 'Румянцев', 'Русанов', 'Рыбкин', 'Рыжов',
                    'Рюриков', 'Рябинин', 'Рязанов', 'Сабуров', 'Савинов', 'Савицкий', 'Садков', 'Садовский', 'Сазонов', 'Салтыков',
                    'Самсонов', 'Сапунов', 'Сараев', 'Сафонов', 'Светлов', 'Светозаров', 'Свиридов', 'Севастьянов', 'Селезнев', 'Селиверстов',
                    'Семенов', 'Серебряков', 'Серов', 'Сибирцев', 'Сивяков', 'Силантьев', 'Сильвестров', 'Симонов', 'Ситников', 'Скворцов',
                    'Скобельцын', 'Скоморохов', 'Скопин', 'Скрябин', 'Славский', 'Слепаков', 'Слободской', 'Сметанин', 'Смирнов', 'Смольянинов',
                    'Снегирев', 'Соболев', 'Собчак', 'Соколов', 'Сокольников', 'Солнцев', 'Соловьев', 'Соломин', 'Сорокин', 'Сотников',
                    'Сочинский', 'Спицин', 'Стариков', 'Старовойтов', 'Старостин', 'Степанов', 'Столяров', 'Стрежнев', 'Стрельников', 'Стругацкий',
                    'Ступин', 'Судаков', 'Суриков', 'Суслов', 'Сутулов', 'Суханов', 'Сухоруков', 'Сысоев', 'Сычев', 'Сюкосев',
                    'Талалихин', 'Тамбовцев', 'Тараканов', 'Тарковский', 'Татаринцев', 'Татищев', 'Твардовский', 'Терехов', 'Терентьев', 'Тимофеев',
                    'Титов', 'Тихвинский', 'Тихонов', 'Ткачев', 'Токарев', 'Толмачев', 'Толстой', 'Топоров', 'Торопов', 'Травников',
                    'Третьяков', 'Трифонов', 'Троицкий', 'Трофимов', 'Трошин', 'Трубецкой', 'Трусов', 'Трыкин', 'Тулупов', 'Туров',
                    'Тургенев', 'Тюленев', 'Тютчев', 'Углов', 'Удальцов', 'Ульянов', 'Усачев', 'Успенский', 'Устинов', 'Уткин',
                    'Ушаков', 'Фадеев', 'Федоров', 'Федосеев', 'Федотов', 'Фетисов', 'Филатов', 'Филимонов', 'Филиппов', 'Фирсов',
                    'Фокин', 'Фомин', 'Фомичев', 'Форопонов', 'Фролов', 'Хабаров', 'Халтурин', 'Харитонов', 'Хлебников', 'Хлопонин',
                    'Хмелев', 'Хомяков', 'Хохлов', 'Хромов', 'Хрущев', 'Худяков', 'Царицын', 'Цветков', 'Цветаев', 'Циолковский',
                    'Чаадаев', 'Чайковский', 'Чапаев', 'Чебодаев', 'Чекалин', 'Челпанов', 'Черепанов', 'Черкасов', 'Чернавский', 'Черненко',
                    'Черников', 'Чернов', 'Чернышев', 'Чернышенко', 'Черняев', 'Черняков', 'Чесноков', 'Чижиков', 'Чистяков', 'Чкалов',
                    'Чубайс', 'Чувахов', 'Чуковский', 'Чулков', 'Чупринин', 'Чурсинов', 'Шабуров', 'Шагин', 'Шаламов', 'Шаляпин',
                    'Шандыбин', 'Шаповалов', 'Шарапов', 'Шаров', 'Шаталов', 'Шахматов', 'Шашков', 'Швецов', 'Шебалин', 'Шевелев',
                    'Шевченко', 'Шевчук', 'Шелестов', 'Шеповалов', 'Шереметев', 'Шерстобитов', 'Шилов', 'Шипилов', 'Широков', 'Ширяев',
                    'Шишкин', 'Шмаков', 'Шолохов', 'Шувалов', 'Шукшин', 'Шульгин', 'Шумилов', 'Шурупов', 'Шустров', 'Шухов',
                    'Щедрин', 'Щеголев', 'Щепкин', 'Щербаков', 'Щербина', 'Эйзенштейн', 'Энтин', 'Эрденко', 'Юмашев', 'Юровский',
                    'Яблоков', 'Ягужинский', 'Якимов', 'Яковлев', 'Якубов', 'Якунин', 'Якушев', 'Янковский', 'Ярцев', 'Ясюнин',
                    'Яхонтов', 'Яшин', 'Яшвили'
                ],
                cities: [
                    { city: 'Москва', region: 'Московская область', timezone: 'Europe/Moscow', ip_prefix: '95.165' },
                    { city: 'Санкт-Петербург', region: 'Ленинградская область', timezone: 'Europe/Moscow', ip_prefix: '95.167' }
                ],
                email_domains: ['gmail.com', 'yandex.ru', 'mail.ru', 'rambler.ru']
            }),
            websites: () => ({
                categories: {
                    search: [
                        { url: 'https://yandex.ru', title: 'Яндекс', visits_per_month: 150 },
                        { url: 'https://google.com', title: 'Google', visits_per_month: 100 }
                    ],
                    social: [
                        { url: 'https://vk.com', title: 'ВКонтакте', visits_per_month: 200 },
                        { url: 'https://ok.ru', title: 'Одноклассники', visits_per_month: 50 }
                    ],
                    news: [
                        { url: 'https://ria.ru', title: 'РИА Новости', visits_per_month: 80 },
                        { url: 'https://lenta.ru', title: 'Lenta.ru', visits_per_month: 60 }
                    ]
                }
            }),
            behaviors: () => ({
                personality_types: {
                    tech_enthusiast: {
                        session_pattern: { sessions_per_day: 8, sites_per_session: 15 },
                        sites: ['tech', 'news', 'social'],
                        online_time: 'evening',
                        primary_time: 'mixed'
                    },
                    business_professional: {
                        session_pattern: { sessions_per_day: 5, sites_per_session: 8 },
                        sites: ['news', 'professional', 'social'],
                        online_time: 'daytime',
                        primary_time: 'business_hours'
                    }
                },
                time_slots: {
                    morning: [{ start: 6, end: 12, weight: 0.3 }],
                    daytime: [{ start: 12, end: 18, weight: 0.4 }],
                    evening: [{ start: 18, end: 24, weight: 0.3 }]
                }
            })
        };
        return generators[type] ? generators[type]() : {};
    }

    _generateUniqueBrowserFeatures() {
        return {
            flags: {
                "smooth-scrolling": this._randomBool(0.7),
                "parallel-downloading": this._randomBool(0.9),
                "hardware-acceleration": this._randomBool(0.8),
                "experimental-features": this._randomBool(0.3)
            },
            plugins: this._getBrowserPlugins(),
            fonts: this._getInstalledFonts(),
            screen: {
                resolution: `${this.config.viewportSize.width}x${this.config.viewportSize.height}`,
                color_depth: this._randomChoice([24, 30, 32]),
                pixel_ratio: this._randomChoice([1, 1.25, 1.5, 2])
            }
        };
    }

    _generateEnhancedUserProfile() {
        const isMobile = this.config.isMobile;
        const viewportSize = this.config.viewportSize;
        const personalityTypes = this.data.behaviors?.personality_types || this._getDefaultPersonalityTypes();
        const personalityType = this._randomChoice(Object.keys(personalityTypes));
        const personality = personalityTypes[personalityType];

        const first_name = this._randomChoice(this.data.users.first_names);
        const last_name = this._randomChoice(this.data.users.last_names);
        const cityData = this._randomChoice(this.data.users.cities);
        const email_domain = this._randomChoice(this.data.users.email_domains);

        // Уникальные вариации для каждого профиля
        const usernameVariations = [
            `${first_name.toLowerCase()}${last_name.toLowerCase()}${this._randomInt(1000, 9999)}`,
            `${first_name.toLowerCase()}.${last_name.toLowerCase()}`,
            `${last_name.toLowerCase()}${first_name.substring(0, 1).toLowerCase()}${this._randomInt(10, 999)}`,
            `${first_name.toLowerCase()}${this._randomInt(1, 99)}`
        ];

        const emailVariations = [
            `${first_name.toLowerCase()}.${last_name.toLowerCase()}${this._randomInt(1, 100)}@${email_domain}`,
            `${first_name.toLowerCase()}${last_name.substring(0, 3).toLowerCase()}${this._randomInt(100, 999)}@${email_domain}`,
            `${last_name.toLowerCase()}.${first_name.toLowerCase()}@${email_domain}`
        ];

        return {
            name: `${first_name} ${last_name}`,
            first_name: first_name,
            last_name: last_name,
            email: this._randomChoice(emailVariations),
            username: this._randomChoice(usernameVariations),
            personality: personalityType,
            behavior: personality,
            geoData: {
                city: cityData.city,
                region: cityData.region,
                timezone: cityData.timezone,
                ip: `${cityData.ip_prefix}.${this._randomInt(1, 255)}.${this._randomInt(1, 255)}`,
                coordinates: this._generateCoordinates(cityData.city)
            },
            activityPeriod: this._generateActivityPeriod(),
            interests: this._generateInterests(personalityType),
            configReference: {
                isMobile: isMobile,
                viewportSize: viewportSize
            },
            searchPatterns: this._generateSearchPatterns(personalityType),
            browsingHabits: this._generateBrowsingHabits(personality),
            extendedBehavior: this._generateExtendedBehaviorPatterns(personalityType),
            uniqueTraits: {
                scrollSpeed: Math.random() * 3 + 1,
                clickFrequency: Math.random() * 2 + 0.5,
                tabUsage: this._randomInt(3, 20),
                downloadFrequency: this._randomInt(1, 30),
                sessionLength: this._randomInt(10, 180) // минуты
            },
            browserFeatures: this._generateUniqueBrowserFeatures(),
            privacySettings: {
                cookies: this._randomChoice(['allow', 'block_third_party', 'block_all']),
                location: this._randomBool(0.6),
                notifications: this._randomBool(0.4),
                camera: this._randomBool(0.2),
                microphone: this._randomBool(0.3)
            },
            securitySettings: {
                password_saving: this._randomBool(0.7),
                autofill_forms: this._randomBool(0.8),
                safe_browsing: this._randomBool(0.9),
                do_not_track: this._randomBool(0.2)
            }
        };
    }

    _generateExtendedBehaviorPatterns(personalityType) {
        return {
            interaction_patterns: {
                mouse_movement: {
                    type: this._randomChoice(['precise', 'random', 'direct']),
                    speed: Math.random() * 2 + 0.5,
                    accuracy: Math.random() * 0.8 + 0.2
                },
                scroll_behavior: {
                    type: this._randomChoice(['smooth', 'jumpy', 'consistent']),
                    speed: Math.random() * 3 + 1
                },
                navigation_style: {
                    primary_style: this._randomChoice(['keyboard_heavy', 'mouse_driven', 'mixed']),
                    tab_usage: { average_tabs: this._randomInt(3, 15) }
                }
            },
            time_patterns: {
                daily_rhythm: {
                    type: this._randomChoice(['morning_person', 'night_owl', 'balanced']),
                    peak_hours: [9, 13, 20]
                }
            },
            social_patterns: {
                network_usage: {
                    vk: { daily_minutes: this._randomInt(30, 180) },
                    youtube: { daily_minutes: this._randomInt(60, 240) }
                }
            }
        };
    }

    async _generateLargeHistoryDatabase() {
        const historyPath = path.join(this.profilePath, 'History');

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(historyPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    // Расширенные таблицы как в исходном коде
                    db.run(`CREATE TABLE urls(
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url LONGVARCHAR NOT NULL,
                        title LONGVARCHAR NOT NULL,
                        visit_count INTEGER DEFAULT 0 NOT NULL,
                        typed_count INTEGER DEFAULT 0 NOT NULL,
                        last_visit_time INTEGER NOT NULL,
                        hidden INTEGER DEFAULT 0 NOT NULL
                    )`);

                    db.run(`CREATE TABLE visits(
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url INTEGER NOT NULL,
                        visit_time INTEGER NOT NULL,
                        from_visit INTEGER,
                        transition INTEGER DEFAULT 0 NOT NULL,
                        segment_id INTEGER,
                        visit_duration INTEGER DEFAULT 0 NOT NULL,
                        incremented_omnibox_typed_score BOOLEAN DEFAULT FALSE NOT NULL
                    )`);

                    db.run(`CREATE TABLE keyword_search_terms(
                        keyword_id INTEGER NOT NULL,
                        url_id INTEGER NOT NULL,
                        term LONGVARCHAR NOT NULL,
                        normalized_term LONGVARCHAR NOT NULL
                    )`);

                    db.run(`CREATE TABLE segment_usage(
                        id INTEGER PRIMARY KEY,
                        segment_id INTEGER NOT NULL,
                        time_slot INTEGER NOT NULL,
                        type INTEGER NOT NULL,
                        visit_count INTEGER DEFAULT 0 NOT NULL
                    )`);

                    db.run(`CREATE TABLE clusters(
                        cluster_id INTEGER PRIMARY KEY,
                        score REAL NOT NULL,
                        'keywords' VARCHAR NOT NULL
                    )`);

                    db.run(`CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)`);

                    // Индексы для производительности
                    db.run(`CREATE INDEX urls_url_index ON urls (url)`);
                    db.run(`CREATE INDEX urls_last_visit_time_index ON urls (last_visit_time)`);
                    db.run(`CREATE INDEX visits_url_index ON visits (url)`);
                    db.run(`CREATE INDEX visits_visit_time_index ON visits (visit_time)`);

                    this._fillLargeHistoryData(db).then(() => {
                        db.close((err) => {
                            if (err) reject(err);
                            else resolve('History database created successfully');
                        });
                    }).catch(reject);
                });
            });
        });
    }

    async _fillLargeHistoryData(db) {
        // console.log(`[${this.profileId}] Генерация большой истории...`);

        // Генерируем 5000+ URL как в исходном коде
        const allUrls = this._generateAllUrls();
        const urlMap = new Map();

        // Вставляем URL
        for (const urlData of allUrls) {
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO urls(url, title, visit_count, typed_count, last_visit_time) VALUES(?, ?, ?, ?, ?)`,
                    [urlData.url, urlData.title, urlData.visit_count, Math.floor(urlData.visit_count / 3), this._chromeTime(urlData.last_visit)],
                    function (err) {
                        if (err) reject(err);
                        else {
                            urlMap.set(urlData.url, this.lastID);
                            resolve();
                        }
                    }
                );
            });
        }

        // Генерируем 20000+ посещений
        const daysOfHistory = 365;
        const baseDate = Date.now() - (daysOfHistory * 24 * 60 * 60 * 1000);
        let totalVisits = 0;

        for (let day = 0; day < daysOfHistory; day++) {
            const dayDate = baseDate + (day * 24 * 60 * 60 * 1000);
            const visitsThisDay = this._generateRealisticDailyVisits(dayDate, allUrls);

            for (const visit of visitsThisDay) {
                const urlId = urlMap.get(visit.url);
                if (urlId) {
                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO visits(url, visit_time, transition, visit_duration) VALUES(?, ?, ?, ?)`,
                            [urlId, this._chromeTime(visit.visitTime), visit.transition, visit.duration],
                            (err) => {
                                if (err) reject(err);
                                else {
                                    totalVisits++;
                                    resolve();
                                }
                            }
                        );
                    });
                }
            }

            // Прогресс каждые 30 дней
            if (day % 30 === 0) {
                // console.log(`[${this.profileId}] Обработано ${day}/${daysOfHistory} дней истории`);
            }
        }

        // Метаданные
        /*await new Promise((resolve, reject) => {
            db.run(`INSERT INTO meta(key, value) VALUES ('version', '130'), ('last_compatible_version', '130')`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });*/

        await this._generateSearchHistory(db, urlMap);

        // console.log(`[${this.profileId}] Создано ${totalVisits} посещений для ${allUrls.length} URL`);
    }

    _generateRealisticDailyVisits(dayDate, allUrls) {
        const date = new Date(dayDate);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Разное количество посещений в зависимости от дня недели
        let baseVisits;
        if (isWeekend) {
            baseVisits = this._randomInt(30, 80); // Больше на выходных
        } else if (dayOfWeek === 1) { // Понедельник
            baseVisits = this._randomInt(40, 70); // Активный день
        } else {
            baseVisits = this._randomInt(20, 50); // Обычные дни
        }

        const visits = [];
        const dayStart = dayDate;
        const dayEnd = dayDate + (24 * 60 * 60 * 1000);

        // Распределяем посещения по времени суток согласно паттернам
        const timeSlots = this._getTimeSlotsForDay(dayOfWeek);

        for (const slot of timeSlots) {
            const visitsInSlot = Math.floor(baseVisits * slot.weight);

            for (let i = 0; i < visitsInSlot; i++) {
                const visitTime = dayStart + (slot.start * 60 * 60 * 1000) +
                    (Math.random() * (slot.end - slot.start) * 60 * 60 * 1000);

                // Выбираем сайты согласно категории временного слота
                const suitableSites = allUrls.filter(site =>
                    slot.categories.some(cat => site.category === cat)
                );

                if (suitableSites.length > 0) {
                    const site = this._randomChoice(suitableSites);
                    visits.push({
                        url: site.url,
                        visitTime: visitTime,
                        duration: this._randomInt(30000, 600000),
                        transition: this._getRandomTransition()
                    });
                }
            }
        }

        return visits;
    }

    _getTimeSlotsForDay(dayOfWeek) {
        const patterns = {
            // Будние дни
            1: [ // Понедельник
                { start: 7, end: 9, weight: 0.2, categories: ['news', 'email', 'social'] },
                { start: 9, end: 12, weight: 0.3, categories: ['work', 'search', 'tech'] },
                { start: 12, end: 14, weight: 0.1, categories: ['news', 'entertainment'] },
                { start: 14, end: 18, weight: 0.3, categories: ['work', 'search'] },
                { start: 18, end: 23, weight: 0.1, categories: ['social', 'entertainment'] }
            ],
            // Выходные
            0: [ // Воскресенье
                { start: 9, end: 12, weight: 0.2, categories: ['news', 'social'] },
                { start: 12, end: 16, weight: 0.4, categories: ['entertainment', 'shopping'] },
                { start: 16, end: 20, weight: 0.3, categories: ['social', 'entertainment'] },
                { start: 20, end: 24, weight: 0.1, categories: ['entertainment'] }
            ]
        };

        return patterns[dayOfWeek] || patterns[1]; // По умолчанию будний день
    }

    async _generateSearchHistory(db, urlMap) {
        const searchQueries = [
            'погода в ' + this.userProfile.geoData.city,
            'новости сегодня',
            'курс доллара',
            'работа ' + this.userProfile.geoData.city,
            'рецепты приготовления',
            this.userProfile.interests[0] + ' новости',
            'расписание поездов',
            'кинотеатры ' + this.userProfile.geoData.city,
            'магазины электроники',
            'спорт результаты'
        ];

        for (const query of searchQueries) {
            const searchUrl = `https://yandex.ru/search/?text=${encodeURIComponent(query)}`;
            const urlId = urlMap.get(searchUrl) || this._randomInt(1, 1000);

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO keyword_search_terms(keyword_id, url_id, term, normalized_term) VALUES(?, ?, ?, ?)`,
                    [1, urlId, query, query.toLowerCase()],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    }

    _generateAllUrls() {
        const urls = [];
        const categories = this.data.websites.categories;

        // Генерируем URL из всех категорий
        for (const [categoryName, categorySites] of Object.entries(categories)) {
            for (const site of categorySites) {
                const visits = Math.floor(site.visits_per_month * 6 * (0.5 + Math.random())); // 6 месяцев

                urls.push({
                    url: site.url,
                    title: site.title,
                    category: categoryName,
                    visit_count: visits,
                    last_visit: Date.now() - (Math.random() * 365 * 24 * 60 * 60 * 1000)
                });
            }
        }

        // Добавляем случайные URL для увеличения объема
        for (let i = 0; i < 2000; i++) {
            const domain = `https://${this._generateId(10)}.${this._randomChoice(['com', 'ru', 'net'])}`;
            urls.push({
                url: domain,
                title: `Site ${i}`,
                category: 'other',
                visit_count: this._randomInt(1, 20),
                last_visit: Date.now() - (Math.random() * 365 * 24 * 60 * 60 * 1000)
            });
        }

        return urls;
    }

    _generateDailyVisits(dayDate, allUrls) {
        const date = new Date(dayDate);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const baseVisits = isWeekend ? this._randomInt(20, 50) : this._randomInt(10, 30);

        const visits = [];
        const dayStart = dayDate;
        const dayEnd = dayDate + (24 * 60 * 60 * 1000);

        for (let i = 0; i < baseVisits; i++) {
            const visitTime = dayStart + (Math.random() * 24 * 60 * 60 * 1000);
            const site = this._randomChoice(allUrls);

            visits.push({
                url: site.url,
                visitTime: visitTime,
                duration: this._randomInt(30000, 600000), // 30 сек - 10 мин
                transition: this._getRandomTransition()
            });
        }

        return visits;
    }

    _getRandomTransition() {
        const transitions = [805306368, 805306369, 805306370, 805306371, 805306372];
        return this._randomChoice(transitions);
    }

    async _generateLargeCookiesDatabase() {
        const cookiesPath = path.join(this.profilePath, 'Cookies');

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(cookiesPath, (err) => {
                if (err) return reject(err);

                db.serialize(() => {
                    db.run(`CREATE TABLE cookies(
                        creation_utc INTEGER NOT NULL,
                        host_key TEXT NOT NULL,
                        name TEXT NOT NULL,
                        value TEXT NOT NULL,
                        path TEXT NOT NULL,
                        expires_utc INTEGER NOT NULL,
                        is_secure INTEGER NOT NULL,
                        is_httponly INTEGER NOT NULL,
                        last_access_utc INTEGER NOT NULL,
                        has_expires INTEGER NOT NULL DEFAULT 1,
                        is_persistent INTEGER NOT NULL DEFAULT 1,
                        priority INTEGER NOT NULL DEFAULT 1,
                        encrypted_value BLOB DEFAULT '',
                        samesite INTEGER NOT NULL DEFAULT -1,
                        source_scheme INTEGER NOT NULL DEFAULT 0,
                        source_port INTEGER NOT NULL DEFAULT -1,
                        is_same_party INTEGER NOT NULL DEFAULT 0,
                        last_update_utc INTEGER NOT NULL DEFAULT 0,
                        UNIQUE (host_key, name, path)
                    )`);

                    db.run(`CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)`);

                    this._fillLargeCookiesData(db).then(() => {
                        db.close((err) => {
                            if (err) reject(err);
                            else resolve('Cookies database created successfully');
                        });
                    }).catch(reject);
                });
            });
        });
    }

    async _fillLargeCookiesData(db) {
        const cookies = this._getCompleteCookiesTemplate();
        let cookiesCount = 0;

        for (const cookie of cookies) {
            const creationTime = Date.now() - (Math.random() * 90 * 24 * 60 * 60 * 1000);
            const lastAccessTime = Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000);
            const expiresTime = cookie.session ? 0 : Date.now() + (cookie.expiresDays * 24 * 60 * 60 * 1000);

            // Добавляем реальные атрибуты
            const attributes = this._generateRealCookieAttributes(cookie.host_key);

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO cookies(
                    creation_utc, host_key, name, value, path, expires_utc,
                    is_secure, is_httponly, last_access_utc, has_expires, is_persistent,
                    samesite, source_scheme, source_port, last_update_utc
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    this._chromeTime(creationTime),
                    cookie.host_key,
                    cookie.name,
                    cookie.value,
                    attributes.path,
                    this._chromeTime(expiresTime),
                    attributes.secure ? 1 : 0,
                    attributes.httponly ? 1 : 0,
                    this._chromeTime(lastAccessTime),
                    cookie.session ? 0 : 1,
                    cookie.session ? 0 : 1,
                    this._getSamesiteValue(attributes.samesite),
                    attributes.secure ? 2 : 1, // scheme: 1=http, 2=https
                    -1, // port
                    this._chromeTime(lastAccessTime)
                ], (err) => {
                    if (err) reject(err);
                    else {
                        cookiesCount++;
                        resolve();
                    }
                });
            });
        }

        /*await new Promise((resolve, reject) => {
            db.run(`INSERT INTO meta(key, value) VALUES 
                ('version', '130'),
                ('last_compatible_version', '120'),
                ('current_schema_version', '130')`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });*/

        // console.log(`[${this.profileId}] Создано ${cookiesCount} cookies с реальными атрибутами`);
    }

    _getSamesiteValue(samesite) {
        const values = { 'Lax': 1, 'Strict': 2, 'None': 3 };
        return values[samesite] || 0;
    }

    _getCompleteCookiesTemplate() {
        // Возвращаем 500+ cookies как в исходном коде
        const cookies = [];
        const domains = [
            'yandex.ru', 'google.com', 'vk.com', 'youtube.com', 'mail.ru',
            'ok.ru', 'facebook.com', 'github.com', 'stackoverflow.com', 'habr.com'
        ];

        // Базовые cookies для каждого домена
        domains.forEach(domain => {
            // Основные cookies
            cookies.push({
                host_key: `.${domain}`,
                name: 'session_id',
                value: this._generateHex(32),
                path: '/',
                expiresDays: 30,
                secure: true,
                httponly: true
            });

            // Analytics cookies
            cookies.push({
                host_key: `.${domain}`,
                name: '_ga',
                value: `GA1.1.${this._generateHex(10)}.${Math.floor(Date.now() / 1000)}`,
                path: '/',
                expiresDays: 730,
                secure: true,
                httponly: false
            });

            // Preference cookies
            cookies.push({
                host_key: `.${domain}`,
                name: 'preferences',
                value: JSON.stringify({ theme: 'light', language: 'ru' }),
                path: '/',
                expiresDays: 365,
                secure: true,
                httponly: false
            });
        });

        // Трекеры и рекламные cookies
        const trackers = ['doubleclick.net', 'googleadservices.com', 'facebook.com', 'analytics.google.com'];
        trackers.forEach(tracker => {
            cookies.push({
                host_key: `.${tracker}`,
                name: 'tracking_id',
                value: this._generateHex(16),
                path: '/',
                expiresDays: 90,
                secure: true,
                httponly: false
            });
        });

        // Добавляем много случайных cookies для объема
        for (let i = 0; i < 200; i++) {
            const domain = `${this._generateId(8)}.${this._randomChoice(['com', 'ru', 'net'])}`;
            cookies.push({
                host_key: `.${domain}`,
                name: `cookie_${i}`,
                value: this._generateHex(20),
                path: '/',
                expiresDays: this._randomInt(1, 365),
                secure: this._randomBool(0.7),
                httponly: this._randomBool(0.3)
            });
        }

        return cookies;
    }

    async _createLargeAdditionalFiles() {
        // Большие файлы в разных папках
        const largeFiles = [
            { path: 'GPUCache/data_0', size: 1024 * 1024 * 2 }, // 2MB
            { path: 'ShaderCache/data_0', size: 1024 * 1024 * 1 }, // 1MB
            { path: 'DawnGraphiteCache/data_0', size: 1024 * 512 }, // 512KB
            { path: 'Code Cache/js/large_cache.dat', size: 1024 * 1024 * 1 } // 1MB
        ];

        for (const file of largeFiles) {
            const filePath = path.join(this.profilePath, file.path);
            await mkdir(path.dirname(filePath), { recursive: true });

            const content = Buffer.alloc(file.size);
            for (let i = 0; i < file.size; i++) {
                content[i] = Math.floor(Math.random() * 256);
            }
            await writeFile(filePath, content);
        }
    }

    async _generateLargeLocalStorage() {
        const localStoragePath = path.join(this.profilePath, 'Local Storage', 'leveldb');
        await mkdir(localStoragePath, { recursive: true });

        try {
            // Простая реализация без LevelDB - создаем только структуру файлов
            const leveldbFiles = [
                '000003.log',
                'CURRENT',
                'LOCK',
                'LOG',
                'MANIFEST-000001'
            ];

            for (const file of leveldbFiles) {
                await writeFile(path.join(localStoragePath, file), this._generateLevelDBContent(file));
            }

            // Создаем несколько больших файлов данных для объема
            await this._createLargeLocalStorageFiles(localStoragePath);

        } catch (error) {
            console.warn(`⚠️ Упрощенный Local Storage для профиля ${this.profileId}:`, error.message);
            // Создаем минимальную структуру даже при ошибке
            await this._createBasicLevelDBStructure(localStoragePath);
        }
    }

    async _createLargeLocalStorageFiles(localStoragePath) {
        // Создаем большие файлы данных для увеличения размера
        const dataFiles = [
            { name: 'data_001.ldb', size: 1024 * 500 }, // 500KB
            { name: 'data_002.ldb', size: 1024 * 300 }, // 300KB
            { name: 'data_003.ldb', size: 1024 * 200 }  // 200KB
        ];

        for (const file of dataFiles) {
            const content = Buffer.alloc(file.size);
            // Заполняем случайными данными
            for (let i = 0; i < file.size; i++) {
                content[i] = Math.floor(Math.random() * 256);
            }
            await writeFile(path.join(localStoragePath, file.name), content);
        }
    }

    async _createBasicLevelDBStructure(localStoragePath) {
        // Минимальная структура LevelDB
        const files = {
            'CURRENT': 'MANIFEST-000001',
            'LOCK': '',
            'LOG': 'LevelDB log file\n',
            'MANIFEST-000001': Buffer.from([0x4D, 0x41, 0x4E, 0x49, 0x46, 0x45, 0x53, 0x54]), // "MANIFEST"
            '000003.log': 'LevelDB log content'
        };

        for (const [filename, content] of Object.entries(files)) {
            try {
                await writeFile(path.join(localStoragePath, filename), content);
            } catch (error) {
                // Игнорируем ошибки создания файлов
            }
        }
    }

    async _generateLargeCacheFiles() {
        const cachePath = path.join(this.profilePath, 'Cache', 'Cache_Data');
        await mkdir(cachePath, { recursive: true });

        // Создаем 100+ больших cache файлов (10-100KB каждый)
        for (let i = 0; i < 100; i++) {
            const filename = this._generateHex(16) + '_0';
            const fileSize = this._randomInt(10240, 102400); // 10-100KB
            const content = Buffer.alloc(fileSize);

            // Заполняем случайными данными
            for (let j = 0; j < fileSize; j++) {
                content[j] = Math.floor(Math.random() * 256);
            }

            await writeFile(path.join(cachePath, filename), content);
        }

        // Системные файлы cache большего размера
        const systemFiles = {
            'index': Buffer.alloc(8192), // 8KB
            'data_0': Buffer.alloc(16384), // 16KB
            'data_1': Buffer.alloc(32768), // 32KB
            'data_2': Buffer.alloc(65536), // 64KB
            'data_3': Buffer.alloc(131072) // 128KB
        };

        for (const [filename, content] of Object.entries(systemFiles)) {
            await writeFile(path.join(cachePath, filename), content);
        }
    }

    async _generateLargeMediaFiles() {
        const mediaCachePath = path.join(this.profilePath, 'Media Cache');
        await mkdir(mediaCachePath, { recursive: true });

        // Создаем несколько ОЧЕНЬ больших файлов
        const mediaFiles = [
            { name: 'video_cache.dat', size: 1024 * 1024 * 5 }, // 5MB
            { name: 'audio_cache.dat', size: 1024 * 1024 * 2 }, // 2MB
            { name: 'image_cache.dat', size: 1024 * 1024 * 3 }, // 3MB
            { name: 'font_cache.dat', size: 1024 * 1024 * 1 }   // 1MB
        ];

        for (const file of mediaFiles) {
            const content = Buffer.alloc(file.size);
            for (let i = 0; i < file.size; i++) {
                content[i] = Math.floor(Math.random() * 256);
            }
            await writeFile(path.join(mediaCachePath, file.name), content);
        }
    }

    async createCompleteStructure() {
        try {
            if (fs.existsSync(this.userDataPath)) {
                fs.rmSync(this.userDataPath, { recursive: true, force: true });
            }

            // 1. Создаем корневую структуру с новыми данными
            await this._createUserDataRoot();

            await this._saveConfigToFile();

            // 2. Создаем папку Default с РЕАЛИСТИЧНЫМИ данными
            await this._createDefaultFolderStructure();

            // 3. Создаем дополнительные папки с улучшениями
            await this._createAdditionalRootFolders();

            // 4. Создаем реальные сессии и расширения
            await this._generateRealBrowserSessions();
            await this._generateRealExtensionsWithData();
            await this._generateErrorLogs();

            // 5. Проверяем размер
            const stats = await this._getProfileSize();
            // console.log(`✅ Профиль ${this.profileId}: ${this.userProfile.name} - ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

            return this.userDataPath;

        } catch (error) {
            console.error(`❌ Ошибка создания профиля ${this.profileId}:`, error.message);
            throw error;
        }
    }

    async _generateRealBrowserSessions() {
        const sessionsPath = path.join(this.profilePath, 'Sessions');
        await mkdir(sessionsPath, { recursive: true });

        // Текущая сессия
        const currentSession = {
            windows: [{
                tabs: this._generateRealTabs(3, 8),
                selected_tab_index: this._randomInt(0, 2),
                window_bounds: {
                    x: this._randomInt(0, 500),
                    y: this._randomInt(0, 300),
                    width: this._randomInt(1024, 1920),
                    height: this._randomInt(768, 1080)
                }
            }],
            session_restore: {
                last_modified: Date.now(),
                version: 1
            }
        };

        await writeFile(path.join(sessionsPath, 'Session_1'), JSON.stringify(currentSession));

        // Предыдущие сессии (для восстановления)
        for (let i = 2; i <= 5; i++) {
            const oldSession = {
                windows: [{
                    tabs: this._generateRealTabs(1, 5),
                    selected_tab_index: 0
                }],
                session_restore: {
                    last_modified: Date.now() - (i * 86400000),
                    version: 1
                }
            };
            await writeFile(path.join(sessionsPath, `Session_${i}`), JSON.stringify(oldSession));
        }
    }

    _generateRealTabs(min, max) {
        const tabCount = this._randomInt(min, max);
        const tabs = [];
        const commonSites = [
            'https://yandex.ru',
            'https://google.com',
            'https://vk.com',
            'https://youtube.com',
            'https://github.com'
        ];

        for (let i = 0; i < tabCount; i++) {
            const site = i < commonSites.length ? commonSites[i] :
                `https://${this._generateId(8)}.${this._randomChoice(['com', 'ru', 'net'])}`;

            tabs.push({
                url: site,
                title: this._getSiteTitle(site),
                last_visited: Date.now() - this._randomInt(0, 3600000),
                pinned: i === 0 && this._randomBool(0.3)
            });
        }

        return tabs;
    }

    _getSiteTitle(url) {
        const titles = {
            'yandex.ru': 'Яндекс',
            'google.com': 'Google',
            'vk.com': 'ВКонтакте',
            'youtube.com': 'YouTube',
            'github.com': 'GitHub'
        };

        const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
        return titles[domain] || `Сайт ${domain}`;
    }

    async _generateRealExtensionsWithData() {
        const extensionsPath = path.join(this.profilePath, 'Extensions');
        await mkdir(extensionsPath, { recursive: true });

        const extensions = [
            /*{
                id: "cfhdojbkjhnklbpkdaibdccddilifddb",
                name: "AdBlock",
                version: "5.15.0",
                settings: {
                    enabled: true,
                    filters: ["easylist", "ruadlist", "adguard"],
                    whitelist: ["yandex.ru", "vk.com"],
                    stats: {
                        ads_blocked_today: this._randomInt(50, 500),
                        ads_blocked_total: this._randomInt(1000, 50000)
                    }
                }
            },*/
            {
                id: "nmmhkkegccagdldgiimedpiccmgmieda",
                name: "Google Translate",
                version: "3.0.10",
                settings: {
                    enabled: true,
                    source_lang: "auto",
                    target_lang: "ru",
                    translate_automatically: false
                }
            }
        ];

        for (const ext of extensions) {
            const extPath = path.join(extensionsPath, ext.id, '1.0_0');
            await mkdir(extPath, { recursive: true });

            await this._createExtensionFiles(extPath, ext);
            await this._createExtensionLocalStorage(extPath, ext);
        }
    }

    async _createExtensionFiles(extPath, extension) {
        const manifest = {
            "manifest_version": 3,
            "name": extension.name,
            "version": extension.version,
            "description": `${extension.name} - Browser extension`,
            "permissions": ["activeTab", "storage"],
            "content_scripts": [{
                "matches": ["<all_urls>"],
                "js": ["content.js"]
            }]
        };

        await writeFile(path.join(extPath, 'manifest.json'), JSON.stringify(manifest, null, 2));

        const files = {
            'content.js': this._generateExtensionContentJS(extension.name),
            'background.js': this._generateExtensionBackgroundJS(extension.name),
            'popup.html': this._generateExtensionPopupHTML(extension.name)
        };

        for (const [filename, content] of Object.entries(files)) {
            await writeFile(path.join(extPath, filename), content);
        }
    }

    _generateExtensionContentJS(name) {
        return `// ${name} Content Script
    console.log('${name} loaded');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'block') {
            console.log('${name}: Blocking content');
        }
    });`;
    }

    _generateExtensionBackgroundJS(name) {
        return `// ${name} Background Script
    chrome.runtime.onInstalled.addListener(() => {
        console.log('${name} installed');
    });`;
    }

    _generateExtensionPopupHTML(name) {
        return `<html>
    <head><title>${name}</title></head>
    <body>
        <h3>${name}</h3>
        <p>Extension is active</p>
    </body>
    </html>`;
    }

    async _createExtensionLocalStorage(extPath, extension) {
        const localStoragePath = path.join(extPath, 'Local Storage');
        await mkdir(localStoragePath, { recursive: true });

        const leveldbPath = path.join(localStoragePath, 'leveldb');
        await mkdir(leveldbPath, { recursive: true });

        // Создаем базовые файлы LevelDB для расширения
        const leveldbFiles = {
            'CURRENT': 'MANIFEST-000001',
            'LOCK': '',
            'LOG': `Extension ${extension.name} Local Storage`,
            'MANIFEST-000001': Buffer.from([0x4D, 0x41, 0x4E, 0x49, 0x46, 0x45, 0x53, 0x54])
        };

        for (const [filename, content] of Object.entries(leveldbFiles)) {
            await writeFile(path.join(leveldbPath, filename), content);
        }
    }

    async _generateErrorLogs() {
        const logsPath = path.join(this.userDataPath, 'ErrorLogs');
        await mkdir(logsPath, { recursive: true });

        const errors = [
            {
                timestamp: Date.now() - 86400000,
                type: "renderer",
                message: "Error loading resource: net::ERR_CONNECTION_TIMED_OUT",
                url: "https://tracking.adnetwork.com/track.js"
            }/*,
            {
                timestamp: Date.now() - 172800000, 
                type: "extension",
                message: "Extension AdBlock caused unexpected error",
                extension: "AdBlock"
            }*/
        ];

        for (const error of errors) {
            const logEntry = `[${new Date(error.timestamp).toISOString()}] [${error.type}] ${error.message}\n`;
            await writeFile(path.join(logsPath, `error_${error.timestamp}.log`), logEntry);
        }
    }

    _generateRealCookieAttributes(domain) {
        const attributes = {
            secure: domain.startsWith('https://'),
            httponly: this._randomBool(0.3),
            samesite: this._randomChoice(['Lax', 'Strict', 'None']),
            path: this._randomChoice(['/', '/account', '/api', '/static']),
            priority: this._randomChoice(['Low', 'Medium', 'High'])
        };

        if (domain.includes('google.com')) {
            attributes.secure = true;
            attributes.samesite = 'None';
        }

        if (domain.includes('yandex.ru')) {
            attributes.httponly = true;
        }

        return attributes;
    }

    async _getProfileSize() {
        let totalSize = 0;

        const calculateSize = async (dir) => {
            const items = await readdir(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stats = await stat(itemPath);
                if (stats.isDirectory()) {
                    await calculateSize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            }
        };

        await calculateSize(this.userDataPath);
        return { size: totalSize };
    }
}

class MassProfileGenerator {
    constructor(options = {}) {
        this.options = {
            batchSize: options.batchSize || 50,
            parallelProfiles: options.parallelProfiles || 5,
            totalProfiles: options.totalProfiles || 1000,
            ...options
        };

        this.cache = new ProfileDataCache();
        this.profilesGenerated = 0;
        this.startTime = Date.now();
    }

    async generateAllProfiles() {
        // console.log(`🎯 Начало массовой генерации ${this.options.totalProfiles} профилей...`);

        try {
            await this.cache.init();
        } catch (error) {
            console.error('❌ Ошибка инициализации кэша:', error);
            return;
        }

        const batches = Math.ceil(this.options.totalProfiles / this.options.batchSize);

        for (let batch = 0; batch < batches; batch++) {
            const batchStart = batch * this.options.batchSize + 1;
            const batchEnd = Math.min((batch + 1) * this.options.batchSize, this.options.totalProfiles);

            await this._generateBatch(batchStart, batchEnd, batch + 1, batches);

            if (global.gc) {
                global.gc();
            }
        }

        this._printFinalStats();
    }

    async _generateBatch(startId, endId, batchNum, totalBatches) {
        const batchStartTime = Date.now();
        // console.log(`\n🔄 Пакет ${batchNum}/${totalBatches}: профили ${startId}-${endId}`);

        const promises = [];

        for (let profileId = startId; profileId <= endId; profileId++) {
            const promise = this._generateSingleProfile(profileId);
            promises.push(promise);

            if (promises.length >= this.options.parallelProfiles) {
                await Promise.all(promises);
                promises.length = 0;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }

        const batchTime = Date.now() - batchStartTime;
        // console.log(`✅ Пакет ${batchNum} завершен за ${batchTime}ms`);
    }

    async _generateSingleProfile(profileId) {
        try {
            // Уникальное время создания для каждого профиля
            const creationTime = this._generateRealisticCreationTime(profileId, this.options.totalProfiles);

            const profileGen = new CompleteChromeProfileGenerator(profileId, this.cache, {
                ...this.options,
                creationTime: creationTime
            });

            await profileGen.createCompleteStructure();

            this.profilesGenerated++;

            if (profileId % 50 === 0) {
                this._printProgress(profileId);
            }

        } catch (error) {
            console.error(`💥 Ошибка профиля ${profileId}:`, error.message);
            console.error('Полная ошибка:', error);
        }
    }

    _generateRealisticCreationTime(profileId, totalProfiles) {
        const sixMonthsAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        const timeStep = (365 * 24 * 60 * 60 * 1000) / totalProfiles;

        return sixMonthsAgo + (profileId * timeStep);
    }

    _printProgress(currentId) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const rate = elapsed > 0 ? Math.floor((currentId / elapsed) * 60) : 0;
        const percent = ((currentId / this.options.totalProfiles) * 100).toFixed(1);

        // console.log(`📊 Прогресс: ${currentId}/${this.options.totalProfiles} (${percent}%) - ${rate} профилей/мин`);
    }

    _printFinalStats() {
        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const rate = totalTime > 0 ? Math.floor((this.profilesGenerated / totalTime) * 60) : 0;

        // console.log(`\n🎉 МАССОВАЯ ГЕНЕРАЦИЯ ЗАВЕРШЕНА!`);
        // console.log(`📈 Статистика:`);
        // console.log(`   • Создано профилей: ${this.profilesGenerated}`);
        // console.log(`   • Общее время: ${totalTime} секунд`);
        // console.log(`   • Скорость: ${rate} профилей/мин`);
        // console.log(`   • Папка: ./chrome_profiles_${WORKER_PROCESS_ID}/`);
    }
}

Object.assign(CompleteChromeProfileGenerator.prototype, {

    async _createUserDataRoot() {
        await mkdir(this.userDataPath, { recursive: true });

        // 1. Создаем основные корневые файлы с новыми данными
        const rootFiles = {
            'Local State': JSON.stringify({
                "browser": {
                    "last_redirect_origin": "",
                    "user_data_dir": this.userDataPath,
                    "fingerprint": this.browserFingerprint,
                    "sync_data": this.syncData
                },
                "chrome": {
                    "channel": "stable"
                },
                "extensions": {
                    "install_time": this._chromeTime(this.userProfile.activityPeriod.creation)
                },
                "hardware_acceleration": {
                    "enabled": true
                },
                "profile": {
                    "info_cache": {
                        "Default": {
                            "active_time": Date.now(),
                            "name": this.userProfile.name,
                            "user_name": this.userProfile.username,
                            "autofill_data": this.autofillData
                        }
                    }
                },
                "sync": {
                    "remaining_rollback_tries": 0,
                    ...this.syncData
                }
            }, null, 2),
            'Last Browser': 'chrome',
            'DevToolsActivePort': '1337',
            'BrowserMetrics-spare.pma': this._generateRealBrowserMetrics(),
            'Variations': this._generateVariations()
        };

        for (const [filename, content] of Object.entries(rootFiles)) {
            await writeFile(path.join(this.userDataPath, filename), content);
        }

        // 2. Создаем улучшенные базы данных и кэши
        await this._createFirstPartySetsDB();
        await this._createRealBrowserMetricsFiles();
        await this._createRealComponentCache();
        await this._createCrashpadFiles();
        await this._createSafeBrowsingFiles();
        await this._createExtensionsCache();
        await this._createRealShaderCache();
        await this._createOriginTrials();
        await this._createPKIMetadata();
    },

    async _createFirstPartySetsDB() {
        const dbPath = path.join(this.userDataPath, 'first_party_sets.db');
        const db = new sqlite3.Database(dbPath);

        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE first_party_sets(primary_site TEXT, associated_sites TEXT)`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Добавляем данные
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO first_party_sets VALUES(?, ?)`,
                ['google.com', 'youtube.com,gmail.com'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        db.close();

        // Создаем journal файл
        await writeFile(path.join(this.userDataPath, 'first_party_sets.db-journal'), '');
    },

    async _createDefaultFolderStructure() {
        await mkdir(this.profilePath, { recursive: true });

        // 1. Основные файлы базы данных
        const defaultFiles = {
            'Preferences': JSON.stringify(this._generatePreferences(), null, 2),
            'Secure Preferences': JSON.stringify(this._generateSecurePreferences(), null, 2),
            'Bookmarks': JSON.stringify(this._generateBookmarks(), null, 2),
            'Top Sites': JSON.stringify(this._generateTopSites(), null, 2),
            'Shortcuts': JSON.stringify(this._generateShortcuts(), null, 2),
            'TransportSecurity': JSON.stringify(this._generateTransportSecurity(), null, 2),
            'MediaDeviceSalts': JSON.stringify(this._generateMediaDeviceSalts(), null, 2),
            'ServerCertificate': JSON.stringify(this._generateServerCertificate(), null, 2),
            'SharedStorage': JSON.stringify(this._generateSharedStorage(), null, 2),
            'InterestGroups': JSON.stringify(this._generateInterestGroups(), null, 2),
            'DIPS': JSON.stringify(this._generateDIPS(), null, 2),
            'PreferredApps': JSON.stringify(this._generatePreferredApps(), null, 2),
            'trusted_vault.pb': this._generateTrustedVault()
        };

        // Сначала создаем простые файлы
        await Promise.allSettled(
            Object.entries(defaultFiles).map(async ([filename, content]) => {
                try {
                    const filePath = path.join(this.profilePath, filename);
                    const bufferContent = Buffer.isBuffer(content) ? content : Buffer.from(content);
                    await writeFile(filePath, bufferContent);
                } catch (error) {
                    console.warn(`Ошибка файла ${filename}:`, error.message);
                }
            })
        );

        // Затем создаем сложные базы данных ОТДЕЛЬНО
        try {
            await this._generateLargeHistoryDatabase();
        } catch (error) {
            console.warn('Ошибка создания History:', error.message);
        }

        try {
            await this._generateFaviconsDatabase();
        } catch (error) {
            console.warn('Ошибка создания Favicons:', error.message);
        }

        try {
            await this._generateWebDataDatabase();
        } catch (error) {
            console.warn('Ошибка создания Web Data:', error.message);
        }

        try {
            await this._generateLoginDataDatabase();
        } catch (error) {
            console.warn('Ошибка создания Login Data:', error.message);
        }

        try {
            await this._generateLargeCookiesDatabase();
        } catch (error) {
            console.warn('Ошибка создания Cookies:', error.message);
        }

        try {
            await this._generateNetworkActionPredictor();
        } catch (error) {
            console.warn('Ошибка создания Network Action Predictor:', error.message);
        }

        // 2. Создаем подпапки и РЕАЛЬНЫЕ данные
        await this._createDefaultSubfolders();
        await this._generateLargeLocalStorage();
        await this._generateRealCacheData();
        await this._generateLargeMediaFiles();
        await this._createLargeAdditionalFiles();
    },

    async _createDefaultSubfolders() {
        const subfolders = [
            'AutofillAiModelCache',
            'AutofillStrikeDatabase',
            'BudgetDatabase',
            'chrome_cart_db',
            'ClientCertificates',
            'Code Cache/js',
            'Code Cache/wasm',
            'Collaboration',
            'commerce_subscription_db',
            'DataSharing',
            'DawnGraphiteCache',
            'DawnWebGPUCache',
            'discounts_db',
            'Extension Rules',
            'Extension Scripts',
            'Extension State',
            'Feature Engagement Tracker/AvailabilityDB',
            'Feature Engagement Tracker/EventDB',
            'File System/000/t/Paths',
            'File System/Origins',
            'GCM Store',
            'GPUCache',
            'Local Storage/leveldb',
            'Network',
            'parcel_tracking_db',
            'PersistentOriginTrials',
            'power_bookmarks',
            'Safe Browsing Network',
            'Segmentation Platform/SegmentInfoDB',
            'Segmentation Platform/SignalDB',
            'Segmentation Platform/SignalStorageConfigDB',
            'Session Storage',
            'Sessions',
            'Shared Dictionary/cache',
            'shared_proto_db/metadata',
            'Site Characteristics Database',
            'Sync Data/LevelDB',
            'WebStorage',
            'blob_storage/92d7cd4e-8a2c-441c-aa61-c2cf03f24bcb',
            'Cache/Cache_Data/index-dir'
        ];

        for (const folder of subfolders) {
            await mkdir(path.join(this.profilePath, folder), { recursive: true });
        }

        // Создаем базовые файлы в подпапках
        await this._createSubfolderFiles();
    },

    async _createAdditionalRootFolders() {
        const rootFolders = [
            'AmountExtractionHeuristicRegexes',
            'AutofillStates',
            'BrowserMetrics',
            'CertificateRevocation',
            'component_crx_cache',
            'CookieReadinessList',
            'Crashpad/attachments',
            'Crashpad/reports',
            'Crowd Deny',
            'extensions_crx_cache',
            'FileTypePolicies',
            'Fingerprinting Protection Filter/Unindexed Rules',
            'FirstPartySetsPreloaded',
            'GraphiteDawnCache',
            'GrShaderCache',
            'HistorySearch',
            'hyphen-data',
            'MaskedDomainListPreloaded',
            'MEIPreload',
            'OnDeviceHeadSuggestModel',
            'OpenCookieDatabase',
            'OriginTrials',
            'PKIMetadata',
            'PlusAddressBlocklist',
            'PrivacySandboxAttestationsPreloaded',
            'ProbabilisticRevealTokenRegistry',
            'Safe Browsing',
            'SafetyTips',
            'segmentation_platform',
            'ShaderCache',
            'SSLErrorAssistant',
            'Subresource Filter/Unindexed Rules',
            'TpcdMetadata',
            'TrustTokenKeyCommitments',
            'WasmTtsEngine',
            'WidevineCdm',
            'ZxcvbnData'
        ];

        for (const folder of rootFolders) {
            await mkdir(path.join(this.userDataPath, folder), { recursive: true });
        }

        await this._createRootFolderFiles();
    },

    _generateLocalState() {
        return JSON.stringify({
            "browser": {
                "last_redirect_origin": "",
                "user_data_dir": this.userDataPath
            },
            "chrome": {
                "channel": "stable"
            },
            "hardware_acceleration": {
                "enabled": true
            },
            "sync": {
                "remaining_rollback_tries": 0
            }
        }, null, 2);
    },

    _generatePreferences() {
        return {
            "profile": {
                "name": `Profile ${this.profileId}`
            },
            "browser": {
                "has_seen_welcome_page": true,
                "window_placement": this._generateWindowPlacement(),
                "first_run_time": this._chromeTime(this.userProfile.activityPeriod.creation),
                "last_run_time": this._chromeTime(this.userProfile.activityPeriod.lastUse)
            },
            "intl": {
                "accept_languages": "ru-RU,ru;q=0.9,en;q=0.8",
                "selected_languages": "ru,en"
            },
            "download": {
                "default_directory": this._getDownloadPath(),
                "download_restrictions": 0
            },
            "sync": this.syncData,
            "autofill": {
                "profile_enabled": true,
                "credit_card_enabled": this._randomBool(0.3)
            },
            "password_manager": {
                "enabled": true,
                "password_generation_enabled": this._randomBool(0.7)
            },
            "safe_browsing": {
                "enabled": true,
                "enhanced": this._randomBool(0.5)
            },
            "search": {
                "suggest_enabled": true,
                "default_search_provider": this._randomChoice(['google', 'yandex'])
            },
            "extensions": {
                "ui": {
                    "developer_mode": this._randomBool(0.2)
                }
            },
            "hardware_acceleration": {
                "enabled": this._randomBool(0.8)
            },
            "user_experience_metrics": {
                "reporting_enabled": this._randomBool(0.4)
            },
            "privacy_sandbox": {
                "ad_measurement_enabled": this._randomBool(0.3),
                "floc_enabled": this._randomBool(0.2),
                "topics_enabled": this._randomBool(0.3)
            },
            "user_experience_metrics": {
                "reporting_enabled": this._randomBool(0.4)
            }
        };
    },

    _generateSecurePreferences() {
        const prefs = this._generatePreferences();
        prefs.security = {
            "tls1_enabled": false,
            "tls1_1_enabled": false,
            "tls1_2_enabled": true,
            "tls1_3_enabled": true
        };
        return prefs;
    },

    _generateBookmarks() {
        const bookmarkBar = {
            children: [
                {
                    name: "Часто посещаемые",
                    type: "folder",
                    children: [
                        {
                            name: "Яндекс",
                            url: "https://yandex.ru",
                            type: "url",
                            date_added: this._chromeTime(Date.now() - 86400000),
                            date_last_used: this._chromeTime(Date.now() - 3600000)
                        },
                        {
                            name: "ВКонтакте",
                            url: "https://vk.com",
                            type: "url",
                            date_added: this._chromeTime(Date.now() - 172800000),
                            date_last_used: this._chromeTime(Date.now() - 7200000)
                        }
                    ]
                },
                {
                    name: "Работа",
                    type: "folder",
                    children: [
                        {
                            name: "GitHub",
                            url: "https://github.com",
                            type: "url",
                            date_added: this._chromeTime(Date.now() - 259200000)
                        },
                        {
                            name: "Google Docs",
                            url: "https://docs.google.com",
                            type: "url",
                            date_added: this._chromeTime(Date.now() - 86400000)
                        }
                    ]
                }
            ]
        };

        const otherBookmarks = {
            children: [
                {
                    name: "Избранное",
                    type: "folder",
                    children: this._generateRandomBookmarks(10)
                }
            ]
        };

        return {
            "checksum": this._generateHex(32),
            "version": 1,
            "roots": {
                "bookmark_bar": bookmarkBar,
                "other": otherBookmarks,
                "synced": {
                    "children": []
                }
            }
        };
    },

    _generateRandomBookmarks(count) {
        const sites = [
            { name: "YouTube", url: "https://youtube.com", category: "entertainment" },
            { name: "Habr", url: "https://habr.com", category: "tech" },
            { name: "Stack Overflow", url: "https://stackoverflow.com", category: "tech" },
            { name: "Wildberries", url: "https://wildberries.ru", category: "shopping" },
            { name: "OZON", url: "https://ozon.ru", category: "shopping" }
        ];

        const bookmarks = [];
        for (let i = 0; i < count; i++) {
            const site = this._randomChoice(sites);
            bookmarks.push({
                name: site.name,
                url: site.url,
                type: "url",
                date_added: this._chromeTime(Date.now() - this._randomInt(1, 365) * 86400000),
                date_last_used: this._chromeTime(Date.now() - this._randomInt(0, 30) * 86400000)
            });
        }
        return bookmarks;
    },

    _generateTopSites() {
        return {
            "top_sites": [
                { "url": "https://yandex.ru", "title": "Яндекс", "url_rank": 0 },
                { "url": "https://google.com", "title": "Google", "url_rank": 1 },
                { "url": "https://vk.com", "title": "ВКонтакте", "url_rank": 2 },
                { "url": "https://youtube.com", "title": "YouTube", "url_rank": 3 }
            ]
        };
    },

    _generateMediaDeviceSalts() {
        return JSON.stringify({
            "salts": {
                "audio": this._generateHex(32),
                "video": this._generateHex(32)
            }
        });
    },

    _generateServerCertificate() {
        return JSON.stringify({
            "certificates": []
        });
    },

    _generateSharedStorage() {
        return JSON.stringify({
            "origins": {}
        });
    },

    _generateInterestGroups() {
        return JSON.stringify({
            "groups": []
        });
    },

    _generateDIPS() {
        return JSON.stringify({
            "sites": []
        });
    },

    _generatePreferredApps() {
        return {
            "apps": []
        };
    },

    _generateTrustedVault() {
        return Buffer.alloc(256); // 256 байт
    },

    _generateRealBrowserMetrics() {
        // Реальный формат BrowserMetrics - протокольные буферы
        // Вместо JSON используем бинарную структуру как в Chrome
        const buffer = Buffer.alloc(4096); // 4KB реальных данных

        // Заголовок Chrome Metrics (упрощенная версия реального формата)
        const header = Buffer.from([
            0x08, 0x01, // version = 1
            0x12, 0x20, // client_id (32 байта)
            ...Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
            0x1A, 0x10, // session_id (16 байт)
            ...Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)),
            0x22, 0x30  // system_profile section
        ]);

        header.copy(buffer);

        // Заполняем системный профиль
        let offset = header.length;
        const systemProfile = [
            0x0A, 0x14, // brand = "Google Chrome"
            0x47, 0x6F, 0x6F, 0x67, 0x6C, 0x65, 0x20, 0x43, 0x68, 0x72, 0x6F, 0x6D, 0x65,
            0x12, 0x0F, // version = "130.0.6723.118" (15 символов)
            0x31, 0x33, 0x30, 0x2E, 0x30, 0x2E, 0x36, 0x37, 0x32, 0x33, 0x2E, 0x31, 0x31, 0x38,
            0x18, 0x02, // channel = STABLE (2)
            0x20, 0x01  // is_extended_stable = false
        ];

        Buffer.from(systemProfile).copy(buffer, offset);
        offset += systemProfile.length;

        // Заполняем остаток реальными метриками использования
        const startDate = Math.floor(this.userProfile.activityPeriod.creation / 1000);
        const endDate = Math.floor(this.userProfile.activityPeriod.lastUse / 1000);

        for (let i = 0; i < 50 && offset < buffer.length - 10; i++) {
            const metric = [
                0x32, 0x08, // user_action_event
                0x09, // timestamp (varint)
                ...this._encodeVarint(startDate + i * 86400),
                0x10, 0x01  // action_type = ACTION_TAB_CREATED
            ];

            if (offset + metric.length < buffer.length) {
                Buffer.from(metric).copy(buffer, offset);
                offset += metric.length;
            }
        }

        return buffer.slice(0, offset);
    },

    _encodeVarint(value) {
        const bytes = [];
        while (value > 127) {
            bytes.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        bytes.push(value);
        return bytes;
    },

    async _createRealComponentCache() {
        const componentPath = path.join(this.userDataPath, 'component_crx_cache');
        await mkdir(componentPath, { recursive: true });

        // Реальные компоненты Chrome (упрощенные версии)
        const components = [
            {
                name: "WidevineCdm",
                version: "4.10.2710.0",
                file: await this._generateRealWidevineCRX()
            },
            {
                name: "FlashPlayer",
                version: "32.0.0.445",
                file: await this._generateRealFlashCRX()
            }
        ];

        const metadata = {
            "protocol_version": 1,
            "components": components.map(comp => ({
                "name": comp.name,
                "version": comp.version,
                "installer": {
                    "local_path": `${comp.name}.crx`
                }
            }))
        };

        await writeFile(path.join(componentPath, 'manifest.json'), JSON.stringify(metadata, null, 2));

        // Сохраняем реальные CRX файлы
        for (const component of components) {
            await writeFile(path.join(componentPath, `${component.name}.crx`), component.file);
        }
    },

    async _generateRealWidevineCRX() {
        // Упрощенная структура реального CRX файла
        const crxHeader = Buffer.from([
            0x43, 0x72, 0x32, 0x34, // "Cr24" - CRX magic number
            0x03, 0x00, 0x00, 0x00, // Version 3
            0x00, 0x02, 0x00, 0x00  // Public key length (512)
        ]);

        // Генерируем "публичный ключ" (случайные данные)
        const publicKey = Buffer.alloc(512);
        for (let i = 0; i < 512; i++) {
            publicKey[i] = Math.floor(Math.random() * 256);
        }

        // Подпись (случайные данные)
        const signature = Buffer.alloc(256);
        for (let i = 0; i < 256; i++) {
            signature[i] = Math.floor(Math.random() * 256);
        }

        // ZIP архив с манифестом (упрощенный)
        const manifest = {
            "manifest_version": 2,
            "name": "Widevine Content Decryption Module",
            "version": "4.10.2710.0",
            "description": "Widevine Content Decryption Module"
        };

        const zipContent = this._createSimpleZip([
            { name: "manifest.json", content: Buffer.from(JSON.stringify(manifest)) }, // ← ИСПРАВЛЕНО: Buffer.from()
            { name: "widevine.dll", content: Buffer.alloc(1024 * 1024) } // 1MB DLL
        ]);

        // Собираем CRX
        return Buffer.concat([crxHeader, publicKey, signature, zipContent]);
    },

    _createSimpleZip(files) {
        // Упрощенная ZIP структура
        let zipData = Buffer.alloc(0);

        files.forEach(file => {
            // Убедимся, что content - это Buffer
            const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);

            const header = Buffer.from([
                0x50, 0x4B, 0x03, 0x04, // Local file header signature
                0x14, 0x00, // Version needed to extract
                0x00, 0x00, // General purpose bit flag
                0x00, 0x00, // Compression method (store)
                0x00, 0x00, 0x00, 0x00, // Last mod time/date
                0x00, 0x00, 0x00, 0x00, // CRC-32
                ...this._toLittleEndian(content.length, 4), // Compressed size
                ...this._toLittleEndian(content.length, 4), // Uncompressed size
                ...this._toLittleEndian(Buffer.from(file.name).length, 2), // File name length
                0x00, 0x00 // Extra field length
            ]);

            const fileName = Buffer.from(file.name);
            zipData = Buffer.concat([zipData, header, fileName, content]);
        });

        return zipData;
    },

    _toLittleEndian(value, bytes) {
        const result = [];
        for (let i = 0; i < bytes; i++) {
            result.push((value >> (i * 8)) & 0xFF);
        }
        return result;
    },

    async _createRealShaderCache() {
        const shaderCachePath = path.join(this.userDataPath, 'ShaderCache');
        await mkdir(shaderCachePath, { recursive: true });

        // Реальный формат шейдерного кэша Chrome (упрощенный)
        const cacheHeader = Buffer.from([
            0x53, 0x43, 0x48, 0x44, // "SCHD" - Shader Cache magic
            0x01, 0x00, 0x00, 0x00, // Version 1
            0x78, 0x56, 0x34, 0x12, // CRC32 checksum
            0x00, 0x10, 0x00, 0x00  // Data size (4KB)
        ]);

        // Генерируем реальные шейдерные данные
        const shaderData = await this._generateRealShaderData(1024 * 16); // 16KB шейдеров

        const fullCache = Buffer.concat([cacheHeader, shaderData]);
        await writeFile(path.join(shaderCachePath, 'data_0'), fullCache);

        // Индексный файл
        const indexData = this._generateShaderIndex(shaderData);
        await writeFile(path.join(shaderCachePath, 'index'), indexData);
    },

    async _generateRealShaderData(size) {
        const buffer = Buffer.alloc(size);

        // Заголовок шейдерного блока
        const blockHeader = Buffer.from([
            0x47, 0x50, 0x55, 0x20, // "GPU " magic
            0x01, 0x00, 0x00, 0x00, // Format version
            0x00, 0x04, 0x00, 0x00  // Shader count (1024)
        ]);

        blockHeader.copy(buffer);

        // Генерируем реальные шейдерные программы (упрощенные)
        let offset = blockHeader.length;
        const shaderTypes = ['vertex', 'fragment', 'compute'];

        for (let i = 0; i < 1024 && offset < size - 100; i++) {
            const shaderType = shaderTypes[i % shaderTypes.length];
            const shaderSize = this._randomInt(64, 512);

            if (offset + shaderSize + 20 < size) {
                // Заголовок шейдера
                const shaderHeader = Buffer.from([
                    ...this._toLittleEndian(i, 4), // Shader ID
                    ...this._toLittleEndian(shaderSize, 4), // Size
                    ...Buffer.from(shaderType.padEnd(8, '\0')) // Type
                ]);

                shaderHeader.copy(buffer, offset);
                offset += shaderHeader.length;

                // Тело шейдера (GLSL-like код)
                const shaderCode = `
#version 450
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texCoord;
out vec2 vTexCoord;
void main() {
    gl_Position = vec4(position, 1.0);
    vTexCoord = texCoord;
}`.substring(0, shaderSize);

                Buffer.from(shaderCode).copy(buffer, offset);
                offset += shaderCode.length;
            }
        }

        return buffer.slice(0, offset);
    },

    async _createRealExtensionsData() {
        const extensionsPath = path.join(this.profilePath, 'Extensions');
        await mkdir(extensionsPath, { recursive: true });

        // Реальные данные расширений
        const extensions = [
            /*{
                id: "ahfgeienlihckogmohjhadlkjgocpleb",
                name: "AdBlock",
                version: "5.15.0",
                files: await this._generateRealExtensionFiles("AdBlock")
            },*/
            {
                id: "nmmhkkegccagdldgiimedpiccmgmieda",
                name: "Google Translate",
                version: "3.0.10",
                files: await this._generateRealExtensionFiles("Google Translate")
            }
        ];

        for (const extension of extensions) {
            const extPath = path.join(extensionsPath, extension.id);
            await mkdir(extPath, { recursive: true });

            // Манифест расширения
            const manifest = {
                "manifest_version": 3,
                "name": extension.name,
                "version": extension.version,
                "description": `${extension.name} - Browser extension`,
                "permissions": ["activeTab", "storage"],
                "content_scripts": [{
                    "matches": ["<all_urls>"],
                    "js": ["content.js"]
                }]
            };

            await writeFile(path.join(extPath, 'manifest.json'), JSON.stringify(manifest, null, 2));

            // Файлы расширения
            for (const [filename, content] of Object.entries(extension.files)) {
                await writeFile(path.join(extPath, filename), content);
            }
        }
    },

    async _generateRealExtensionFiles(name) {
        return {
            'content.js': `// ${name} Content Script
console.log('${name} loaded');
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'block') {
        // Blocking logic here
    }
});`,
            'background.js': `// ${name} Background Script
chrome.runtime.onInstalled.addListener(() => {
    console.log('${name} installed');
});`,
            'popup.html': `<html>
<head><title>${name}</title></head>
<body>
    <h3>${name}</h3>
    <p>Extension is active</p>
</body>
</html>`
        };
    },

    async _generateRealCacheData() {
        const cachePath = path.join(this.profilePath, 'Cache', 'Cache_Data');
        await mkdir(cachePath, { recursive: true });

        // Реальные HTTP кэш файлы
        const urlEntries = [
            { url: 'https://yandex.ru/', size: 1024 * 50 },
            { url: 'https://google.com/', size: 1024 * 40 },
            { url: 'https://vk.com/', size: 1024 * 60 }
        ];

        for (const entry of urlEntries) {
            const hash = this._generateCacheHash(entry.url);
            const filename = `${hash}_0`;

            // HTTP кэш запись
            const httpHeader = `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: max-age=3600
Date: ${new Date().toGMTString()}
Content-Length: ${entry.size}

`;

            const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>${new URL(entry.url).hostname}</title></head>
<body>
    <h1>${new URL(entry.url).hostname}</h1>
    <p>Cached page content</p>
</body>
</html>`;

            const fullContent = httpHeader + htmlContent;
            await writeFile(path.join(cachePath, filename), fullContent);
        }

        // Индексный файл кэша
        //await this._generateCacheIndex(cachePath, urlEntries);
    },

    _generateCacheHash(url) {
        // Упрощенная хэш-функция как в Chrome
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) - hash) + url.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    },

    _generateBrowserMetricsSpare() {
        // BrowserMetrics - это бинарный файл с метриками браузера
        const metrics = {
            profile: {
                profile_id: this.profileId,
                creation_date: this.userProfile.activityPeriod.creation,
                session_count: this._randomInt(50, 500),
                total_usage_hours: this._randomInt(100, 2000)
            },
            performance: {
                avg_page_load_time: this._randomInt(500, 3000),
                crash_count: this._randomInt(0, 10),
                memory_usage: this._randomInt(100, 500) * 1024 * 1024 // 100-500 MB
            },
            features: {
                extensions_count: this._randomInt(0, 15),
                themes_used: this._randomInt(0, 5),
                sync_enabled: this._randomBool(0.3)
            },
            network: {
                total_download_mb: this._randomInt(1000, 10000),
                total_upload_mb: this._randomInt(100, 1000),
                avg_bandwidth: this._randomInt(10, 100) * 1024 // 10-100 KB/s
            }
        };

        // Преобразуем в бинарный формат (упрощенная версия)
        const jsonStr = JSON.stringify(metrics);
        const buffer = Buffer.alloc(2048); // 2KB файл
        Buffer.from(jsonStr).copy(buffer);

        return buffer;
    },

    async _createRealBrowserMetricsFiles() {
        const metricsPath = path.join(this.userDataPath, 'BrowserMetrics');
        await mkdir(metricsPath, { recursive: true });

        // Создаем несколько файлов метрик с РЕАЛЬНЫМИ данными
        const metricsFiles = [
            {
                name: `BrowserMetrics-${this._generateHex(8).toUpperCase()}-${this._generateHex(4).toUpperCase()}.pma`,
                content: this._generateRealBrowserMetrics()
            },
            {
                name: `BrowserMetrics-${this._generateHex(8).toUpperCase()}-${this._generateHex(4).toUpperCase()}.pma`,
                content: this._generateRealSessionMetrics()
            }
        ];

        for (const file of metricsFiles) {
            await writeFile(path.join(metricsPath, file.name), file.content);
        }
    },

    _generateRealSessionMetrics() {
        // Метрики текущей сессии
        const buffer = Buffer.alloc(2048);

        // Структура сессионных метрик
        const sessionData = {
            session_start: Date.now() - 3600000, // 1 час назад
            pages_visited: this._randomInt(5, 50),
            tabs_opened: this._randomInt(1, 10),
            extensions_used: this._randomInt(0, 5)
        };

        const jsonStr = JSON.stringify(sessionData);
        Buffer.from(jsonStr).copy(buffer);

        return buffer;
    },

    async _createRealComponentCache() {
        const componentPath = path.join(this.userDataPath, 'component_crx_cache');
        await mkdir(componentPath, { recursive: true });

        // Реальные компоненты Chrome
        const components = [
            {
                name: "WidevineCdm",
                version: "4.10.2710.0",
                file: await this._generateRealWidevineCRX()
            },
            {
                name: "FlashPlayer",
                version: "32.0.0.445",
                file: await this._generateRealFlashCRX()
            }
        ];

        const metadata = {
            "protocol_version": 1,
            "components": components.map(comp => ({
                "name": comp.name,
                "version": comp.version,
                "installer": {
                    "local_path": `${comp.name}.crx`
                }
            }))
        };

        await writeFile(path.join(componentPath, 'manifest.json'), JSON.stringify(metadata, null, 2));

        // Сохраняем реальные CRX файлы
        for (const component of components) {
            await writeFile(path.join(componentPath, `${component.name}.crx`), component.file);
        }
    },

    async _generateRealFlashCRX() {
        // Структура CRX файла для Flash Player
        const crxHeader = Buffer.from([
            0x43, 0x72, 0x32, 0x34, // "Cr24"
            0x03, 0x00, 0x00, 0x00, // Version 3
            0x00, 0x02, 0x00, 0x00  // Public key length
        ]);

        const publicKey = Buffer.alloc(512);
        for (let i = 0; i < 512; i++) {
            publicKey[i] = Math.floor(Math.random() * 256);
        }

        const signature = Buffer.alloc(256);
        for (let i = 0; i < 256; i++) {
            signature[i] = Math.floor(Math.random() * 256);
        }

        const manifest = {
            "manifest_version": 2,
            "name": "Adobe Flash Player",
            "version": "32.0.0.445",
            "description": "Adobe Flash Player support"
        };

        const zipContent = this._createSimpleZip([
            { name: "manifest.json", content: JSON.stringify(manifest) },
            { name: "pepflashplayer.dll", content: Buffer.alloc(1024 * 512) } // 512KB DLL
        ]);

        return Buffer.concat([crxHeader, publicKey, signature, zipContent]);
    },

    async _createRealShaderCache() {
        const shaderCachePath = path.join(this.userDataPath, 'ShaderCache');
        await mkdir(shaderCachePath, { recursive: true });

        // Реальный шейдерный кэш
        const cacheHeader = Buffer.from([
            0x53, 0x43, 0x48, 0x44, // "SCHD"
            0x01, 0x00, 0x00, 0x00, // Version 1
            0x78, 0x56, 0x34, 0x12, // CRC32
            0x00, 0x10, 0x00, 0x00  // Data size
        ]);

        const shaderData = await this._generateRealShaderData(1024 * 16);
        const fullCache = Buffer.concat([cacheHeader, shaderData]);

        await writeFile(path.join(shaderCachePath, 'data_0'), fullCache);
        await writeFile(path.join(shaderCachePath, 'data_1'), this._generateAdditionalShaderData());
        await writeFile(path.join(shaderCachePath, 'index'), this._generateShaderIndex(shaderData));
    },

    _generateAdditionalShaderData() {
        // Дополнительные шейдерные данные
        const buffer = Buffer.alloc(1024 * 8); // 8KB
        const shaders = [
            'uniform mat4 uMVP; attribute vec3 aPos; void main() { gl_Position = uMVP * vec4(aPos, 1.0); }',
            'uniform sampler2D uTexture; varying vec2 vTexCoord; void main() { gl_FragColor = texture2D(uTexture, vTexCoord); }',
            'layout(local_size_x = 64) in; void main() { // Compute shader code }'
        ];

        let offset = 0;
        shaders.forEach((shader, index) => {
            const header = Buffer.from([
                ...this._toLittleEndian(index, 4),
                ...this._toLittleEndian(shader.length, 4),
                ...Buffer.from('shader\0\0')
            ]);

            if (offset + header.length + shader.length < buffer.length) {
                header.copy(buffer, offset);
                offset += header.length;
                Buffer.from(shader).copy(buffer, offset);
                offset += shader.length;
            }
        });

        return buffer.slice(0, offset);
    },

    _generateShaderIndex(shaderData) {
        // Индексный файл для шейдерного кэша
        const buffer = Buffer.alloc(1024);
        const header = Buffer.from('SHIDXv1\0'); // Shader Index version 1

        header.copy(buffer);

        // Добавляем записи индекса
        let offset = header.length;
        for (let i = 0; i < 10 && offset < buffer.length - 12; i++) {
            const entry = Buffer.from([
                ...this._toLittleEndian(i, 4),        // Shader ID
                ...this._toLittleEndian(i * 100, 4),  // Offset
                ...this._toLittleEndian(50 + i * 10, 4) // Size
            ]);

            entry.copy(buffer, offset);
            offset += entry.length;
        }

        return buffer.slice(0, offset);
    },

    async _createRealExtensionsData() {
        const extensionsPath = path.join(this.profilePath, 'Extensions');
        await mkdir(extensionsPath, { recursive: true });

        // Реальные расширения
        const extensions = [
            /*{
                id: "ahfgeienlihckogmohjhadlkjgocpleb",
                name: "AdBlock",
                version: "5.15.0"
            },*/
            {
                id: "nmmhkkegccagdldgiimedpiccmgmieda",
                name: "Google Translate",
                version: "3.0.10"
            }/*,
            {
                id: "gighmmpiobklfepjocnamgkkbiglidom",
                name: "AdBlock Plus",
                version: "3.14"
            }*/
        ];

        for (const extension of extensions) {
            const extPath = path.join(extensionsPath, extension.id);
            await mkdir(extPath, { recursive: true });

            // Полный манифест расширения
            const manifest = {
                "manifest_version": 3,
                "name": extension.name,
                "version": extension.version,
                "description": `${extension.name} extension for Chrome`,
                "permissions": ["activeTab", "storage", "webRequest"],
                "background": {
                    "service_worker": "background.js"
                },
                "content_scripts": [{
                    "matches": ["<all_urls>"],
                    "js": ["content.js"],
                    "run_at": "document_start"
                }],
                "action": {
                    "default_popup": "popup.html",
                    "default_title": extension.name
                }
            };

            await writeFile(path.join(extPath, 'manifest.json'), JSON.stringify(manifest, null, 2));

            // Реальные файлы расширения
            const files = {
                'background.js': this._generateExtensionBackgroundJS(extension.name),
                'content.js': this._generateExtensionContentJS(extension.name),
                'popup.html': this._generateExtensionPopupHTML(extension.name),
                'styles.css': this._generateExtensionCSS()
            };

            for (const [filename, content] of Object.entries(files)) {
                await writeFile(path.join(extPath, filename), content);
            }

            // Иконки
            const iconsDir = path.join(extPath, 'icons');
            await mkdir(iconsDir, { recursive: true });

            const iconSizes = [16, 48, 128];
            for (const size of iconSizes) {
                await writeFile(path.join(iconsDir, `icon${size}.png`), this._generateIconPlaceholder(size));
            }
        }
    },

    _generateExtensionBackgroundJS(name) {
        return `// ${name} Background Script
chrome.runtime.onInstalled.addListener((details) => {
    console.log('${name} installed:', details.reason);
});

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // ${name} blocking logic
        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);`;
    },

    _generateExtensionContentJS(name) {
        return `// ${name} Content Script
(function() {
    'use strict';
    
    console.log('${name} content script loaded');
    
    // ${name} functionality
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Handle DOM changes
        });
    });
    
    observer.observe(document, { childList: true, subtree: true });
})();`;
    },

    _generateExtensionPopupHTML(name) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { width: 300px; padding: 10px; font-family: Arial, sans-serif; }
        .header { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        .status { color: green; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">${name}</div>
    <div class="status">Active and running</div>
    <button id="settings">Settings</button>
    <script src="popup.js"></script>
</body>
</html>`;
    },

    _generateExtensionCSS() {
        return `/* Extension Styles */
body {
    margin: 0;
    padding: 10px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.button {
    background-color: #4CAF50;
    border: none;
    color: white;
    padding: 8px 16px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 4px;
}`;
    },

    _generateIconPlaceholder(size) {
        // Заглушка для иконки (в реальности это был бы PNG)
        return Buffer.alloc(size * size * 4); // RGBA данные
    },

    async _generateRealCacheData() {
        const cachePath = path.join(this.profilePath, 'Cache', 'Cache_Data');
        await mkdir(cachePath, { recursive: true });

        // Реальные кэшированные страницы
        const cachedPages = [
            {
                url: 'https://yandex.ru/',
                title: 'Яндекс',
                content: this._generateCachedPage('Яндекс', 'Поисковая система')
            },
            {
                url: 'https://google.com/',
                title: 'Google',
                content: this._generateCachedPage('Google', 'Search engine')
            },
            {
                url: 'https://vk.com/',
                title: 'ВКонтакте',
                content: this._generateCachedPage('ВКонтакте', 'Социальная сеть')
            }
        ];

        for (const page of cachedPages) {
            const hash = this._generateCacheHash(page.url);
            const filename = `${hash}_0`;

            const httpResponse = this._generateHTTPResponse(page);
            await writeFile(path.join(cachePath, filename), httpResponse);
        }

        // Индекс кэша
        await this._generateRealCacheIndex(cachePath, cachedPages);
    },

    _generateCachedPage(title, description) {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <header>
        <h1>${title}</h1>
        <nav>
            <a href="/">Home</a> | 
            <a href="/about">About</a> | 
            <a href="/contact">Contact</a>
        </nav>
    </header>
    <main>
        <article>
            <h2>Welcome to ${title}</h2>
            <p>${description}. This is a cached version of the page.</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
        </article>
    </main>
    <footer>
        <p>&copy; 2024 ${title}. All rights reserved.</p>
    </footer>
</body>
</html>`;
    },

    _generateHTTPResponse(page) {
        const content = page.content;
        return `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: max-age=3600
Content-Length: ${Buffer.byteLength(content, 'utf8')}
Date: ${new Date().toGMTString()}
Last-Modified: ${new Date(Date.now() - 86400000).toGMTString()}
ETag: "abc123${this._generateHex(8)}"
Server: nginx/1.18.0

${content}`;
    },

    async _generateRealCacheIndex(cachePath, pages) {
        const indexData = {
            version: 1,
            last_updated: Date.now(),
            entries: pages.map(page => ({
                hash: this._generateCacheHash(page.url),
                url: page.url,
                size: Buffer.byteLength(page.content, 'utf8'),
                last_accessed: Date.now() - this._randomInt(0, 86400000)
            }))
        };

        await writeFile(path.join(cachePath, 'index'), JSON.stringify(indexData, null, 2));
    },

    _generateBrowserMetricsContent(size) {
        // Генерируем реалистичные метрики браузера
        const startTime = this.userProfile.activityPeriod.creation;
        const endTime = this.userProfile.activityPeriod.lastUse;

        const metrics = {
            version: 1,
            client_id: this._generateHex(32),
            session_id: this._generateHex(16),
            metrics: []
        };

        // Добавляем временные метрики
        const daysOfUsage = Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000));
        for (let i = 0; i < Math.min(daysOfUsage, 30); i++) { // Максимум 30 дней
            const date = startTime + (i * 24 * 60 * 60 * 1000);
            metrics.metrics.push({
                date: new Date(date).toISOString().split('T')[0],
                sessions: this._randomInt(1, 10),
                pages_visited: this._randomInt(10, 200),
                usage_minutes: this._randomInt(30, 480)
            });
        }

        const jsonStr = JSON.stringify(metrics);
        const buffer = Buffer.alloc(size);
        Buffer.from(jsonStr, 'utf8').copy(buffer);

        // Заполняем остаток случайными данными
        for (let i = jsonStr.length; i < size; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
        }

        return buffer;
    },

    _generateWindowPlacement() {
        return {
            "width": this._randomInt(1024, 1920),
            "height": this._randomInt(768, 1080),
            "left": this._randomInt(0, 100),
            "top": this._randomInt(0, 100)
        };
    },

    _getDownloadPath() {
        if (process.platform === 'win32') {
            return `C:\\\\Users\\\\${this.userProfile.username}\\\\Downloads`;
        } else {
            return `/home/${this.userProfile.username}/Downloads`;
        }
    },

    /*async _getProfileSize() {
        let totalSize = 0;
        
        const calculateSize = async (dir) => {
            try {
                const items = await readdir(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    const stats = await stat(itemPath);
                    if (stats.isDirectory()) {
                        await calculateSize(itemPath);
                    } else {
                        totalSize += stats.size;
                    }
                }
            } catch (error) {
                // Игнорируем ошибки доступа
            }
        };
        
        await calculateSize(this.userDataPath);
        return { size: totalSize };
    },*/

    _generateTransportSecurity() {
        return JSON.stringify({
            "hosts": {
                "yandex.ru": {
                    "include_subdomains": true,
                    "created": this._chromeTime(Date.now() - 86400000)
                },
                "google.com": {
                    "include_subdomains": true,
                    "created": this._chromeTime(Date.now() - 172800000)
                }
            }
        }, null, 2);
    },

    async _createFirstPartySetsDB() {
        const dbPath = path.join(this.userDataPath, 'first_party_sets.db');
        const db = new sqlite3.Database(dbPath);

        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE first_party_sets(primary_site TEXT, associated_sites TEXT)`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        db.close();

        // Создаем journal файл
        await writeFile(path.join(this.userDataPath, 'first_party_sets.db-journal'), '');
    },

    async _createSubfolderFiles() {
        // Local Storage LevelDB
        const localStoragePath = path.join(this.profilePath, 'Local Storage', 'leveldb');
        const leveldbFiles = ['000003.log', 'CURRENT', 'LOCK', 'LOG', 'MANIFEST-000001'];
        for (const file of leveldbFiles) {
            await writeFile(path.join(localStoragePath, file), this._generateLevelDBContent(file));
        }

        // Cache файлы
        const cachePath = path.join(this.profilePath, 'Cache', 'Cache_Data');
        const cacheFiles = ['index', 'data_0', 'data_1', 'data_2', 'data_3'];
        for (let i = 0; i < 50; i++) {
            const filename = this._generateHex(16) + '_0';
            await writeFile(path.join(cachePath, filename), Buffer.alloc(this._randomInt(1000, 10000)));
        }
        for (const file of cacheFiles) {
            await writeFile(path.join(cachePath, file), '');
        }

        // Session files
        const sessionsPath = path.join(this.profilePath, 'Sessions');
        const sessionFiles = [
            'Session_' + this._generateHex(16),
            'Session_' + this._generateHex(16),
            'Tabs_' + this._generateHex(16),
            'Tabs_' + this._generateHex(16)
        ];
        for (const file of sessionFiles) {
            await writeFile(path.join(sessionsPath, file), this._generateSessionContent());
        }

        // Extension files
        const extensionPaths = [
            'Extension Rules',
            'Extension Scripts',
            'Extension State'
        ];
        for (const extPath of extensionPaths) {
            const fullPath = path.join(this.profilePath, extPath);
            const leveldbFiles = ['000003.log', 'CURRENT', 'LOCK', 'LOG', 'MANIFEST-000001'];
            for (const file of leveldbFiles) {
                await writeFile(path.join(fullPath, file), '');
            }
        }
    },

    async _createRootFolderFiles() {
        // BrowserMetrics
        const metricsPath = path.join(this.userDataPath, 'BrowserMetrics');
        await writeFile(path.join(metricsPath, 'BrowserMetrics-' + this._generateHex(8).toUpperCase() + '-' + this._generateHex(4).toUpperCase() + '.pma'), '');

        // component_crx_cache
        const componentPath = path.join(this.userDataPath, 'component_crx_cache');
        await writeFile(path.join(componentPath, 'metadata.json'), JSON.stringify({
            "version": "1.0",
            "components": []
        }, null, 2));

        // Crashpad
        const crashpadPath = path.join(this.userDataPath, 'Crashpad');
        await writeFile(path.join(crashpadPath, 'settings.dat'), '');

        // Создаем дополнительные файлы в других папках
        const additionalFiles = {
            'Safe Browsing': 'safebrowsing.dat',
            'OriginTrials': 'trials.json',
            'ShaderCache': 'shader_cache.bin'
        };

        for (const [folder, filename] of Object.entries(additionalFiles)) {
            const filePath = path.join(this.userDataPath, folder, filename);
            await writeFile(filePath, '');
        }
    },

    _generateLevelDBContent(filename) {
        const contents = {
            '000003.log': 'LevelDB log file content',
            'CURRENT': 'MANIFEST-000001',
            'LOCK': '',
            'LOG': 'LevelDB version 1.2.0',
            'MANIFEST-000001': 'LevelDB manifest file'
        };
        return contents[filename] || '';
    },

    _generateSessionContent() {
        return JSON.stringify({
            "windows": [{
                "tabs": [{
                    "entries": [{
                        "url": "https://yandex.ru",
                        "title": "Яндекс"
                    }],
                    "tab_index": 0
                }],
                "window_id": 1
            }]
        }, null, 2);
    },



    _generateVariations() {
        // Variations - конфигурация A/B тестов Google
        return JSON.stringify({
            "variations": [
                {
                    "name": "EnableNewFeatureX",
                    "group": this._randomChoice(["Enabled", "Control"]),
                    "status": "ACTIVE",
                    "parameters": {
                        "probability": Math.random().toFixed(3)
                    }
                },
                {
                    "name": "UIExperiment2024",
                    "group": this._randomChoice(["A", "B", "C"]),
                    "status": "ACTIVE",
                    "parameters": {
                        "variant": this._randomInt(1, 5)
                    }
                },
                {
                    "name": "PerformanceImprovements",
                    "group": "Enabled",
                    "status": "COMPLETED",
                    "parameters": {
                        "version": "2.3.1"
                    }
                }
            ],
            "serial_number": this._generateHex(16)
        }, null, 2);
    },

    async _createComponentCache() {
        const componentPath = path.join(this.userDataPath, 'component_crx_cache');
        await mkdir(componentPath, { recursive: true });

        const metadata = {
            "version": "1.0",
            "last_update": new Date().toISOString(),
            "components": [
                {
                    "name": "WidevineCDM",
                    "version": "1.0.0.0",
                    "size": 1024 * 1024 * 15, // 15MB
                    "last_used": this.userProfile.activityPeriod.lastUse
                },
                {
                    "name": "FlashPlayer",
                    "version": "32.0.0.0",
                    "size": 1024 * 1024 * 8, // 8MB
                    "last_used": this.userProfile.activityPeriod.lastUse - 86400000
                }
            ]
        };

        await writeFile(path.join(componentPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

        // Создаем файлы компонентов
        for (const component of metadata.components) {
            const fileName = `${component.name}_${component.version}.crx`;
            const content = Buffer.alloc(component.size);
            for (let i = 0; i < component.size; i++) {
                content[i] = Math.floor(Math.random() * 256);
            }
            await writeFile(path.join(componentPath, fileName), content);
        }
    },

    async _createCrashpadFiles() {
        const crashpadPath = path.join(this.userDataPath, 'Crashpad');
        await mkdir(crashpadPath, { recursive: true });

        // Settings.dat - бинарный файл настроек
        const settings = {
            database_path: crashpadPath,
            upload_enabled: this._randomBool(0.7),
            max_reports: this._randomInt(10, 50),
            last_upload: this.userProfile.activityPeriod.lastUse
        };

        const settingsBuffer = Buffer.from(JSON.stringify(settings));
        await writeFile(path.join(crashpadPath, 'settings.dat'), settingsBuffer);

        // Создаем несколько отчетов об ошибках
        const crashCount = this._randomInt(0, 5);
        for (let i = 0; i < crashCount; i++) {
            const crashReport = {
                timestamp: this.userProfile.activityPeriod.lastUse - (i * 86400000),
                version: "130.0.6723.118",
                exception_code: this._randomInt(0, 100),
                process_type: "browser",
                module: this._randomChoice(["chrome.dll", "kernel32.dll", "unknown"])
            };

            const reportName = `crash_report_${i}.dmp`;
            const reportBuffer = Buffer.from(JSON.stringify(crashReport));
            await writeFile(path.join(crashpadPath, reportName), reportBuffer);
        }
    },

    async _createSafeBrowsingFiles() {
        const safeBrowsingPath = path.join(this.userDataPath, 'Safe Browsing');
        await mkdir(safeBrowsingPath, { recursive: true });

        // База данных безопасного просмотра
        const safeBrowsingDB = {
            "version": 4,
            "last_update": this.userProfile.activityPeriod.lastUse,
            "threat_lists": [
                {
                    "threat_type": "MALWARE",
                    "platform_type": "ANY_PLATFORM",
                    "threat_entry_type": "URL",
                    "state": "READY",
                    "update_time": this.userProfile.activityPeriod.lastUse - 86400000
                },
                {
                    "threat_type": "SOCIAL_ENGINEERING",
                    "platform_type": "ANY_PLATFORM",
                    "threat_entry_type": "URL",
                    "state": "READY",
                    "update_time": this.userProfile.activityPeriod.lastUse - 172800000
                }
            ]
        };

        await writeFile(path.join(safeBrowsingPath, 'safe_browsing.db'), JSON.stringify(safeBrowsingDB, null, 2));

        const cacheSize = 1024 * 512; // 512KB
        const cacheBuffer = Buffer.alloc(cacheSize);
        for (let i = 0; i < cacheSize; i++) {
            cacheBuffer[i] = Math.floor(Math.random() * 256);
        }
        await writeFile(path.join(safeBrowsingPath, 'browse_cache.dat'), cacheBuffer);
    },

    async _createExtensionsCache() {
        const extensionsPath = path.join(this.userDataPath, 'extensions_crx_cache');
        await mkdir(extensionsPath, { recursive: true });

        const extensions = [
            /*{
                id: "ahfgeienlihckogmohjhadlkjgocpleb",
                name: "AdBlock",
                version: "5.15.0",
                size: 1024 * 1024 * 2 // 2MB
            },*/
            {
                id: "nmmhkkegccagdldgiimedpiccmgmieda",
                name: "Google Translate",
                version: "3.0.10",
                size: 1024 * 1024 * 1 // 1MB
            }
        ];

        const metadata = {
            "extensions": extensions,
            "last_sync": this.userProfile.activityPeriod.lastUse,
            "cache_size": extensions.reduce((sum, ext) => sum + ext.size, 0)
        };

        await writeFile(path.join(extensionsPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

        // Создаем файлы расширений
        for (const extension of extensions) {
            const fileName = `${extension.id}.crx`;
            const content = Buffer.alloc(extension.size);
            for (let i = 0; i < extension.size; i++) {
                content[i] = Math.floor(Math.random() * 256);
            }
            await writeFile(path.join(extensionsPath, fileName), content);
        }
    },

    async _createShaderCache() {
        const shaderCachePath = path.join(this.userDataPath, 'ShaderCache');
        await mkdir(shaderCachePath, { recursive: true });

        // Шейдерный кэш - бинарные данные
        const cacheFiles = [
            { name: 'data_0', size: 1024 * 1024 * 10 }, // 10MB
            { name: 'data_1', size: 1024 * 1024 * 5 },  // 5MB
            { name: 'data_2', size: 1024 * 1024 * 3 },  // 3MB
            { name: 'index', size: 1024 * 64 }           // 64KB
        ];

        for (const file of cacheFiles) {
            const content = Buffer.alloc(file.size);

            // Заполняем структурированными данными шейдерного кэша
            if (file.name === 'index') {
                // Индексный файл имеет специальную структуру
                const header = Buffer.from([0x53, 0x43, 0x48, 0x44]); // "SCHD"
                header.copy(content);
            }

            // Заполняем случайными данными
            for (let i = 0; i < file.size; i++) {
                if (content[i] === 0) { // Не перезаписываем заголовок
                    content[i] = Math.floor(Math.random() * 256);
                }
            }

            await writeFile(path.join(shaderCachePath, file.name), content);
        }
    },

    async _createOriginTrials() {
        const originTrialsPath = path.join(this.userDataPath, 'OriginTrials');
        await mkdir(originTrialsPath, { recursive: true });

        const trials = {
            "enabled_trials": [
                {
                    "name": "NewAPITrial",
                    "origin": "https://example.com",
                    "expiry": this.userProfile.activityPeriod.lastUse + 86400000
                }
            ],
            "last_updated": this.userProfile.activityPeriod.lastUse
        };

        await writeFile(path.join(originTrialsPath, 'trials.json'), JSON.stringify(trials, null, 2));
    },

    async _createPKIMetadata() {
        const pkiPath = path.join(this.userDataPath, 'PKIMetadata');
        await mkdir(pkiPath, { recursive: true });

        const metadata = {
            "certificates": [
                {
                    "issuer": "CN=Google Trust Services LLC",
                    "serial_number": this._generateHex(20),
                    "expiry": this.userProfile.activityPeriod.lastUse + 365 * 86400000
                }
            ],
            "revocation_lists": []
        };

        await writeFile(path.join(pkiPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
    },
});

async function main() {
    const args = process.argv.slice(2);
    const totalProfiles = parseInt(args[0]) || 50;

    // console.log(`🚀 Запуск генерации ${totalProfiles} профилей...`);

    const generator = new MassProfileGenerator({
        totalProfiles: totalProfiles,
        batchSize: 50,
        parallelProfiles: 10,
        minimalMode: false
    });

    try {
        await generator.generateAllProfiles();
    } catch (error) {
        console.error('💥 Критическая ошибка:', error);
        process.exit(1);
    }
}

// Запуск если файл вызван напрямую
if (require.main === module) {
    main();
}

module.exports = {
    MassProfileGenerator,
    CompleteChromeProfileGenerator,
    ProfileDataCache
};