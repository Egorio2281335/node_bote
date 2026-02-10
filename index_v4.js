const { newInjectedPage } = require("fingerprint-injector");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const GoogleRealBrowser = require('./fgoogle');

puppeteer.use(StealthPlugin());

const logFile = path.resolve(__dirname, 'logs/all.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function timestamp() {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleString();
}

['log', 'warn', 'error'].forEach(method => {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        const message = args
            .map(arg => {
                if (arg instanceof Error) {
                    return `${arg.name}: ${arg.message}\n${arg.stack}`;
                }
                return typeof arg === 'string' ? arg : JSON.stringify(arg);
            })
            .join(' ');

        const logLine =
            `[${timestamp()}] [${method.toUpperCase()}] [Worker ${process.pid}] ${message}\n`;

        logStream.write(logLine);
        original(...args);
    };
});

class UniversalSearchBot {
    constructor(targetQuery, profileId = 1) {
        this.profileId = profileId;
        this.profilePath = path.join(__dirname, `unified_profiles/profile_${profileId}`);
        this.userAgent = 'Mozilla/5.0 (Linux; Android 10; Mi A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36';
        this.viewport = { width: 430, height: 932 };

        this.yandexTarget = targetQuery?.yandexTarget;
        this.googleTarget = targetQuery?.googleTarget;
        this.gisTarget = targetQuery?.gisTarget;
        this.zoonTarget = targetQuery?.zoonTarget;
        this.randomQueryUrl = 'http://65.109.82.14/index_key_pull7.php?password=ololo&ip=65.109.49.112&pid=77777777';

        this.selectors = {
            yandex: {
                searchInput: '#text',
                searchResults: '.serp-item',
                mapBlock: 'li[data-fast-name="companies"]',
                companyCards: '.OrgmnMedicineCard',
                companyTitle: '.OrgmnMedicineCard-Title',
                companyAddress: '.OrgmnMedicineCard-Address',
                showMore: '.OrgsList-More',
                externalLinks: '.serp-item a.Link',
                captcha: '.CheckboxCaptcha, .AdvancedCaptcha, .captcha, .Captcha, .smart-captcha'
            },
            gis: {
                searchInput: 'input[type="search"], input[placeholder*="Поиск"], ._1gvu1zk',
                searchButton: 'button[type="submit"], ._12g6k6f',
                searchResults: '._1rehek, ._15gu4wr, ._8hh56jx',
                companyCards: '._1kf6gff',
                companyTitle: '._lvwrwt span, ._zjunba span',
                companyAddress: '._14quei, ._klarpw, ._sfdp8cg',
                showMore: 'button._1k4w1i2, button[class*="more"], ._5ocwns',
                captcha: [
                    'iframe[src*="captcha"]',
                    '.captcha',
                    '.recaptcha',
                    'div[class*="captcha"]',
                    'form[id*="captcha"]',
                    'img[src*="captcha"]',
                    '#captcha'
                ]
            },
            zoon: {
                searchInput: 'input[name="query"][type="search"]',
                searchForm: 'form[action="/search/"]',
                firstResult: '.js-results-item:first-child .org-minicard--title_text',
                companyCards: '.js-results-item',
                companyTitle: '.org-minicard--title_text',
                companyAddress: '.org-minicard--address',
                rating: '.org-minicard--rating_stars',
                comments: '.org-minicard--rating_comments',
                showMore: '.js-next-page, .js-paging-block .paging__page:not(.active), .paging__control._next',
                showMoreButton: '.js-next-page.button-show-more',
                showMoreContainer: '.js-paging-block',
                captcha: [
                    'iframe[src*="captcha"]',
                    '.captcha',
                    '.recaptcha',
                    'div[class*="captcha"]',
                    'form[id*="captcha"]',
                    'img[src*="captcha"]',
                    '#captcha'
                ]
            }
        };

        this.profileWarmupCount = 0;
        this.completedWarmups = 0;
        this.results = {
            yandex: null,
            google: null,
            gis: null,
            zoon: null
        };
        this.retryConfig = {
            maxAttempts: 3,
            baseDelay: 5000,
            maxDelay: 30000
        };
        this.browser = null;
        this.page = null;
        this.googleBrowser = null;

        this.delays = {
            small: { min: 1000, max: 3000 },
            medium: { min: 3000, max: 8000 },
            large: { min: 8000, max: 15000 },
            xlarge: { min: 15000, max: 30000 },
            xxlarge: { min: 30000, max: 60000 },
            xxxlarge: { min: 60000, max: 120000 }
        };

        const profilesDir = path.join(__dirname, 'unified_profiles');
        if (!fs.existsSync(profilesDir)) {
            fs.mkdirSync(profilesDir, { recursive: true });
        }
    }

    async init() {
        console.log(`🚀 Инициализация браузера (профиль ${this.profileId})...`);
        console.log(`📂 Профиль будет сохранен в: ${this.profilePath}`);

        const profileExists = fs.existsSync(this.profilePath);
        if (profileExists) {
            console.log('📖 Используем существующий профиль');
        } else {
            console.log('📝 Создаем новый профиль');
        }

        this.browser = await puppeteer.launch({
            headless: false,
            userDataDir: this.profilePath,
            defaultViewport: this.viewport,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                `--user-agent=${this.userAgent}`,
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-notifications',
                `--lang=ru-RU,ru`,
                '--enable-viewport',
                `--window-size=${this.viewport.width},${this.viewport.height + 100}`
            ],
            executablePath: "C:/Users/qqwer/.cache/puppeteer/chrome/win64-127.0.6533.88/chrome-win64/chrome.exe",
            ignoreHTTPSErrors: true
        });

        this.page = await newInjectedPage(this.browser, {
            fingerprintOptions: {
                devices: ["mobile"],
                operatingSystems: ["android"],
            },
        });

        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });

            window.chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };
        });

        await this.page.setUserAgent(this.userAgent);
        await this.page.setViewport({ width: this.viewport.width, height: this.viewport.height });

        console.log('✅ Браузер готов');
        return true;
    }

    async closeBrowser() {
        if (this.browser) {
            try {
                const pages = await this.browser.pages();
                for (const page of pages) {
                    if (!page.isClosed()) {
                        await page.close().catch(() => { });
                    }
                }
                await this.browser.close();
                console.log('✅ Браузер закрыт (профиль сохранен)');
                this.browser = null;
                this.page = null;
            } catch (error) {
                console.error('❌ Ошибка при закрытии браузера:', error.message);
            }
        }
    }

    async closeGoogleBrowser() {
        if (this.googleBrowser) {
            await this.googleBrowser.close();
            this.googleBrowser = null;
        }
    }

    async addRegionToUrl(searchEngine = 'yandex') {
        try {
            const currentUrl = this.page.url();
            const urlObj = new URL(currentUrl);

            if (searchEngine === 'yandex') {
                const targetRegion = this.yandexTarget.regionId.toString();
                const currentRegion = urlObj.searchParams.get('lr');

                if (currentRegion !== targetRegion) {
                    urlObj.searchParams.set('lr', targetRegion);
                    console.log(`🌍 Устанавливаем регион Яндекс: ${targetRegion}`);

                    await this.page.goto(urlObj.toString(), {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });

                    //await this.delayByType('medium');
                    return true;
                } else {
                    console.log(`✅ Регион Яндекс уже установлен: ${currentRegion}`);
                    return false;
                }
            }
            else if (searchEngine === 'google') {
                const targetRegion = this.googleTarget.regionId.toString();
                const currentRegion = urlObj.searchParams.get('loc');

                if (currentRegion !== targetRegion) {
                    urlObj.searchParams.set('loc', targetRegion);
                    console.log(`🌍 Устанавливаем регион Google: ${targetRegion}`);

                    await this.page.goto(urlObj.toString(), {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });

                    await this.delayByType('medium');
                    return true;
                } else {
                    console.log(`✅ Регион Google уже установлен: ${currentRegion}`);
                    return false;
                }
            }

            return false;
        } catch (error) {
            console.log(`⚠️ Ошибка при установке региона: ${error.message}`);
            return false;
        }
    }

    async getRandomQuery() {
        try {
            const response = await axios.get(this.randomQueryUrl, { timeout: 5000 });
            return response.data.trim();
        } catch (error) {
            const fallbackQueries = [
                'погода сегодня',
                'новости',
                'курс доллара',
                'расписание поездов',
                'рецепты',
                'фильмы онлайн',
                'спорт новости',
                'музыка 2024',
                'технологии',
                'здоровье'
            ];
            return fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
        }
    }

    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Пауза: ${Math.round(delay / 1000)} сек.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    async delayByType(type = 'small') {
        const delayRange = this.delays[type] || this.delays.small;
        return await this.randomDelay(delayRange.min, delayRange.max);
    }

    async randomScroll() {
        const scrollHeight = Math.floor(Math.random() * 800) + 400;
        console.log(`📜 Прокрутка: ${scrollHeight}px`);
        await this.page.evaluate((height) => {
            window.scrollBy(0, height);
        }, scrollHeight);
        await this.delayByType('small');
    }

    async checkForCaptcha(engine = 'yandex') {
        try {
            console.log(`🔍 Проверяем на наличие капчи (${engine})...`);

            const closeBtn = 'DistributionButtonClose';
            const elementbc = await this.page.$(closeBtn);
            if (elementbc) {
                await elementbc.click();
            }

            let selectors;
            if (engine === 'gis' || engine === 'zoon') {
                selectors = [
                    'iframe[src*="captcha"]',
                    '.captcha',
                    '.recaptcha',
                    'div[class*="captcha"]',
                    'form[id*="captcha"]',
                    'img[src*="captcha"]',
                    '#captcha',
                    'input[type="hidden"][name*="captcha"]',
                    'input[name*="captcha"]'
                ];
            } else {
                selectors = this.selectors[engine].captcha;
                selectors = Array.isArray(selectors) ? selectors : [selectors];
            }

            const captchaSelectors = selectors;

            for (const selector of captchaSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        const isVisible = await element.isIntersectingViewport();
                        if (isVisible) {
                            console.log(`🔍 Обнаружена видимая капча по селектору: ${selector}`);
                            return true;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            const pageContent = await this.page.content();
            const captchaTexts = [
                'i\'m not a robot',
                'я не робот',
                'captcha',
                'recaptcha',
                'smartcaptcha',
                'введите текст с картинки',
                'введите символы',
                'подтвердите, что вы не робот'
            ];

            for (const text of captchaTexts) {
                if (pageContent.toLowerCase().includes(text)) {
                    if (pageContent.includes('checkboxcaptcha') ||
                        pageContent.includes('recaptcha-checkbox') ||
                        pageContent.includes('g-recaptcha') ||
                        pageContent.includes('captcha-img') ||
                        pageContent.includes('captcha-input')) {
                        console.log(`🔍 Найден текст капчи на странице: ${text}`);
                        return true;
                    }
                }
            }

            console.log('✅ Капча не обнаружена');
            return false;

        } catch (error) {
            console.log('⚠️ Ошибка при проверке капчи:', error.message);
            return false;
        }
    }

    async handleCaptcha(engine = 'yandex') {
        console.log(`🔄 Обнаружена капча в ${engine}, пытаемся решить...`);

        try {
            console.log('🖱️ Пытаемся кликнуть по чекбоксу капчи...');

            const yandexSelectors = [
                'input#js-button.CheckboxCaptcha-Button',
                '.CheckboxCaptcha-Button',
                '.CheckboxCaptcha-Inner',
                '.CheckboxCaptcha-Anchor',
                '[data-testid="checkbox-captcha"]',
                'input[type="submit"][aria-labelledby="checkbox-label"]',
                'input[aria-label*="robot" i]',
                'input[aria-labelledby*="checkbox" i]'
            ];

            const googleSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.g-recaptcha',
                'iframe[title*="reCAPTCHA" i]',
                'div.recaptcha-checkbox-checkmark',
                'span.recaptcha-checkbox'
            ];

            const gisSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.g-recaptcha',
                'iframe[title*="reCAPTCHA" i]',
                'div.recaptcha-checkbox-checkmark',
                'span.recaptcha-checkbox'
            ];

            const zoonSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.g-recaptcha',
                'iframe[title*="reCAPTCHA" i]',
                'div.recaptcha-checkbox-checkmark',
                'span.recaptcha-checkbox'
            ];

            const selectors = engine === 'yandex' ? yandexSelectors :
                engine === 'google' ? googleSelectors :
                    engine === 'gis' ? gisSelectors :
                        zoonSelectors;
            let captchaClicked = false;

            for (const selector of selectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log(`✅ Найден элемент капчи по селектору: ${selector}`);

                        if (selector.includes('iframe')) {
                            const frame = await this.page.$(selector);
                            if (frame) {
                                const iframe = await frame.contentFrame();
                                if (iframe) {
                                    const checkbox = await iframe.$('#recaptcha-anchor');
                                    if (checkbox) {
                                        await checkbox.click();
                                        console.log('✅ Кликнули по чекбоксу внутри iframe');
                                        captchaClicked = true;
                                        break;
                                    }
                                }
                            }
                        } else {
                            await element.click({ delay: 100 });
                            console.log(`✅ Кликнули по элементу капчи`);
                            captchaClicked = true;
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Не удалось кликнуть по селектору ${selector}: ${error.message}`);
                    continue;
                }
            }

            console.log('⏳ Ждем реакцию капчи');
            await this.delayByType('large');

            const captchaStillPresent = await this.checkForCaptcha(engine);

            if (!captchaStillPresent) {
                console.log(`🎉 Капча решена! Продолжаем работу...`);
                await this.delayByType('small');
                return true;

            } else {
                console.log(`❌ Капча не исчезла после клика, пробуем дополнительные действия...`);

                if (engine === 'yandex') {
                    try {
                        const labelElements = await this.page.$x('//span[contains(text(), "I\'m not a robot") or contains(text(), "я не робот")]');
                        if (labelElements.length > 0) {
                            await labelElements[0].click();
                            console.log('✅ Кликнули по тексту капчи');
                            await this.delayByType('medium');
                        }
                    } catch (error) {
                    }
                }

                const finalCheck = await this.checkForCaptcha(engine);
                if (!finalCheck) {
                    console.log('🎉 Капча решена после дополнительных действий!');
                    await this.delayByType('small');
                    return true;
                }

                console.log('🚫 Не удалось решить капчу...');

                if (engine === 'yandex' || engine === 'google') {
                    console.log('🚪 Закрываем браузер из-за нерешенной капчи');
                    await this.closeBrowser();

                    const waitTime = 60000 + Math.random() * 180000;
                    console.log(`⏸️ Длительная пауза: ${Math.round(waitTime / 60000)} мин. перед перезапуском...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));

                    return false;
                } else {
                    console.log('ℹ️ Для 2GIS и Zoon продолжаем работу даже с нерешенной капчей');
                    return false;
                }
            }

        } catch (error) {
            console.log(`❌ Ошибка при обработке капчи: ${error.message}`);

            if (engine === 'yandex' || engine === 'google') {
                console.log('🚪 Закрываем браузер из-за ошибки обработки капчи');
                await this.closeBrowser();

                const waitTime = 90000 + Math.random() * 180000;
                console.log(`⏸️ Пауза: ${Math.round(waitTime / 60000)} мин. ${Math.round((waitTime % 60000) / 1000)} сек.`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                console.log('ℹ️ Для 2GIS и Zoon продолжаем работу несмотря на ошибку капчи');
            }

            return false;
        }
    }

    // Переход на случайный сайт из выдачи с увеличенными задержками (только Яндекс)
    async visitRandomSiteFromResults() {
        console.log('🌐 Ищем случайный сайт для посещения...');

        try {
            // Ищем все ссылки в результатах поиска
            const resultLinks = await this.page.$$eval('.serp-item a.Link', links =>
                links
                    .filter(link => {
                        const href = link.getAttribute('href');
                        const text = link.textContent || '';
                        // Фильтруем только внешние ссылки (не на Яндекс)
                        return href && text.length > 5;
                    })
                    .map(link => ({
                        href: link.getAttribute('href'),
                        text: link.textContent.trim().substring(0, 50) + '...'
                    }))
            );

            if (resultLinks.length === 0) {
                console.log('⚠️ Не найдено подходящих внешних ссылок');
                return false;
            }

            // Пауза перед выбором ссылки
            await this.delayByType('small');

            // Выбираем случайную ссылку
            const randomLink = resultLinks[Math.floor(Math.random() * resultLinks.length)];
            console.log(`🔗 Переходим на: ${randomLink.text}`);
            console.log(`   URL: ${randomLink.href.substring(0, 80)}...`);

            // Пауза перед переходом
            await this.delayByType('small');

            // Переходим по ссылке
            await this.page.goto(randomLink.href, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // УВЕЛИЧЕННОЕ время на сайте
            const timeOnSite = Math.floor(Math.random() * 15000) + 10000; // 10-25 секунд
            console.log(`⏱️ Проводим на сайте: ${Math.round(timeOnSite / 1000)} сек.`);

            // Случайные действия на сайте
            const actions = [
                async () => {
                    // Прокрутка
                    const scrollHeight = Math.floor(Math.random() * 1200) + 600;
                    console.log(`   📜 Прокрутка сайта: ${scrollHeight}px`);
                    await this.page.evaluate((height) => {
                        window.scrollBy(0, height);
                    }, scrollHeight);
                    await this.delayByType('small');
                },
                async () => {
                    // Клик по случайному элементу (если безопасно)
                    const clickableElements = await this.page.$$('a, button, [onclick]');
                    if (clickableElements.length > 0) {
                        const randomElement = clickableElements[Math.floor(Math.random() * Math.min(5, clickableElements.length))];
                        try {
                            await randomElement.click();
                            console.log('   🖱️ Кликнули на элемент');
                        } catch (e) {
                            // Игнорируем ошибки клика
                        }
                    }
                },
                async () => {
                    // Просто ждем и "читаем"
                    console.log('   👀 Читаем содержимое страницы');
                    await this.delayByType('medium');
                },
                async () => {
                    // Медленная прокрутка
                    console.log('   📜 Медленная прокрутка');
                    const totalScroll = Math.floor(Math.random() * 1000) + 500;
                    const steps = Math.floor(totalScroll / 100);
                    for (let i = 0; i < steps; i++) {
                        await this.page.evaluate(() => {
                            window.scrollBy(0, 100);
                        });
                        await this.randomDelay(300, 800); // Микро-паузы между прокрутками
                    }
                }
            ];

            // Выполняем несколько случайных действий
            const numActions = Math.floor(Math.random() * 3) + 2;
            console.log(`   🎬 Выполняем ${numActions} действий на сайте`);

            for (let i = 0; i < numActions; i++) {
                const action = actions[Math.floor(Math.random() * actions.length)];
                await action();
                // Пауза между действиями
                if (i < numActions - 1) {
                    await this.delayByType('small');
                }
            }

            console.log('✅ Посещение сайта завершено');
            return true;

        } catch (error) {
            console.log(`⚠️ Ошибка при переходе на сайт: ${error.message}`);
            return false;
        }
    }

    // Выполнение одного нагульного запроса с увеличенными задержками (оригинальная логика)
    async executeWarmupQuery(query, iteration) {
        console.log(`📊 [${iteration}/${this.profileWarmupCount}] Выполняем запрос...`);
        console.log(`   Поиск: "${query}"`);

        try {
            // Пауза перед началом
            // await this.delayByType('small');

            // Переходим на Яндекс
            console.log('   🌐 Загружаем Яндекс...');
            await this.page.goto('https://ya.ru/', {
                waitUntil: 'networkidle2',
                timeout: 45000
            });

            // Проверяем на капчу сразу после загрузки
            if (await this.checkForCaptcha('yandex')) {
                console.log(`🚫 Капча при загрузке 'yandex'`);
                const captchaSolved = await this.handleCaptcha('yandex');

                if (!captchaSolved) {
                    // Закрываем браузер только если handleCaptcha вернул false
                    // и не закрыл браузер сам (проверяем, жив ли браузер)
                    if (this.browser && !this.browser.isConnected()) {
                        await this.closeBrowser();
                    }

                    /*if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }*/
                    // continue;
                }
                // Если капча решена, продолжаем
            }

            // Пауза перед поиском
            await this.delayByType('medium');

            // Ждем поисковую строку
            try {
                await this.page.waitForSelector('#text', { timeout: 15000 });
            } catch (error) {
                console.log('   🔄 Перезагружаем страницу...');
                await this.page.reload();
                await this.page.waitForSelector('#text', { timeout: 15000 });
            }

            // Пауза перед вводом
            await this.delayByType('small');

            // Вводим запрос медленно, как человек
            console.log('   ⌨️ Вводим запрос...');
            for (let char of query) {
                await this.page.type('#text', char, { delay: Math.random() * 100 + 50 });
            }

            // Пауза перед отправкой (как будто проверяем написанное)
            await this.delayByType('small');

            // Нажимаем Enter
            await this.page.keyboard.press('Enter');

            // Ждем загрузки результатов
            console.log('   ⏳ Ждем результаты поиска...');
            try {
                await this.page.waitForSelector('.serp-item', { timeout: 20000 });

                // Дополнительная проверка на капчу после поиска
                if (await this.checkForCaptcha('yandex')) {
                    console.log(`🚫 Капча при загрузке 'yandex'`);
                    const captchaSolved = await this.handleCaptcha('yandex');

                    if (!captchaSolved) {
                        // Закрываем браузер только если handleCaptcha вернул false
                        // и не закрыл браузер сам (проверяем, жив ли браузер)
                        if (this.browser && !this.browser.isConnected()) {
                            await this.closeBrowser();
                        }

                        /*if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;*/
                    }
                    // Если капча решена, продолжаем
                }
            } catch (error) {
                console.log('   ⚠️ Результаты не загрузились, проверяем на капчу...');
                if (await this.checkForCaptcha('yandex')) {
                    console.log(`🚫 Капча при загрузке 'yandex'`);
                    const captchaSolved = await this.handleCaptcha('yandex');

                    if (!captchaSolved) {
                        // Закрываем браузер только если handleCaptcha вернул false
                        // и не закрыл браузер сам (проверяем, жив ли браузер)
                        if (this.browser && !this.browser.isConnected()) {
                            await this.closeBrowser();
                        }

                        /*if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;*/
                    }
                    // Если капча решена, продолжаем
                }
            }

            // Пауза перед просмотром результатов
            await this.delayByType('medium');

            // Случайные действия на странице результатов
            console.log('   👀 Просматриваем результаты...');
            await this.randomScroll();

            // ПЕРЕХОД НА СЛУЧАЙНЫЙ САЙТ ИЗ ВЫДАЧИ
            console.log('   🌍 Переходим на случайный сайт из выдачи...');
            const siteVisited = await this.visitRandomSiteFromResults();

            if (!siteVisited) {
                // Если не удалось перейти на сайт, делаем обычные действия
                console.log('   🔄 Не удалось перейти на сайт, изучаем результаты...');

                // Еще прокрутки
                for (let i = 0; i < 2; i++) {
                    await this.randomScroll();
                }

                // Пытаемся кликнуть на случайный результат
                const results = await this.page.$$('.serp-item a');
                if (results.length > 0 && Math.random() > 0.5) {
                    const randomIndex = Math.floor(Math.random() * Math.min(3, results.length));
                    try {
                        await results[randomIndex].click();
                        console.log('   🖱️ Кликнули на случайный результат');
                        await this.delayByType('large');

                        // Проверка на капчу после клика
                        if (await this.checkForCaptcha('yandex')) {
                            console.log(`🚫 Капча при загрузке 'yandex'`);
                            const captchaSolved = await this.handleCaptcha('yandex');

                            if (!captchaSolved) {
                                // Закрываем браузер только если handleCaptcha вернул false
                                // и не закрыл браузер сам (проверяем, жив ли браузер)
                                if (this.browser && !this.browser.isConnected()) {
                                    await this.closeBrowser();
                                }

                                /*if (attempt < this.retryConfig.maxAttempts) {
                                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                                continue;*/
                            }
                            // Если капча решена, продолжаем
                        }
                    } catch (error) {
                        // Игнорируем ошибки клика
                    }
                }
            }

            this.completedWarmups = iteration;
            console.log(`   ✅ Запрос выполнен\n`);

            return true; // Успешное выполнение

        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}`);

            // Проверяем, не связана ли ошибка с капчей
            if (error.message.includes('captcha') || error.message.includes('Captcha')) {
                console.log('   🚫 Ошибка связана с капчей');
                await this.handleCaptcha('yandex');
                return false;
            }

            // При любой другой ошибке просто закрываем браузер
            console.log('   🚪 Закрываем браузер из-за ошибки');
            await this.closeBrowser();

            console.log('   🔄 Продолжаем...\n');
            await this.delayByType('large');
            return true; // Продолжаем несмотря на ошибку
        }
    }

    // Нагул профиля с увеличенными задержками
    async warmUpProfile() {
        console.log(`🔥 Начинаем нагул профиля (${this.profileWarmupCount} запросов)...\n`);

        for (let i = 1; i <= this.profileWarmupCount; i++) {
            let queryExecuted = false;
            let attempts = 0;
            const maxAttempts = 3;

            // Повторяем попытку выполнения запроса, если была капча
            while (!queryExecuted && attempts < maxAttempts) {
                attempts++;

                // Инициализируем браузер если он закрыт
                if (!this.browser || !this.page || this.page.isClosed()) {
                    console.log(`   🔄 Запуск браузера (попытка ${attempts})...`);
                    const initSuccess = await this.init();
                    if (!initSuccess) {
                        console.log('   ❌ Не удалось инициализировать браузер');
                        await this.delayByType('xlarge');
                        continue;
                    }
                }

                // Пауза перед получением запроса
                await this.delayByType('small');

                // Получаем случайный запрос
                const query = await this.getRandomQuery();

                // Выполняем запрос
                const result = await this.executeWarmupQuery(query, i);

                if (result === false) {
                    // Была капча, браузер уже закрыт
                    console.log(`   ⏸️ Капча, пробуем снова...`);
                    await this.delayByType('xlarge');
                } else {
                    queryExecuted = true;

                    // ЗАКРЫВАЕМ БРАУЗЕР ПОСЛЕ КАЖДОГО УСПЕШНОГО НАГУЛА
                    console.log('   🚪 Закрываем браузер после нагула');
                    await this.closeBrowser();
                }
            }

            if (!queryExecuted) {
                console.log(`   ❌ Не удалось выполнить запрос ${i} после ${maxAttempts} попыток`);
                // Ждем подольше перед следующей попыткой
                console.log(`   ⏸️ Длительная пауза перед следующим запросом...`);
                await this.delayByType('xxxlarge');
                continue;
            }

            // УВЕЛИЧЕННАЯ пауза между запросами
            if (i < this.profileWarmupCount) {
                console.log(`   ⏸️ Пауза между запросами...`);
                await this.delayByType('large');
            }

            // Каждые 5 запросов - очень большая пауза
            if (i % 5 === 0 && i < this.profileWarmupCount) {
                console.log(`\n⏰ Большая пауза после ${i} запросов...`);
                await this.delayByType('xxlarge');
            }

            // Каждые 10 запросов - гигантская пауза
            if (i % 10 === 0 && i < this.profileWarmupCount) {
                console.log(`\n🏖️ Отдых после ${i} запросов (длинная пауза)...`);
                await this.delayByType('xxxlarge');
            }
        }

        console.log('🎉 Нагул профиля завершен!\n');

        // Пауза перед финальным этапом
        console.log('🔄 Пауза перед целевым поиском...');
        // await this.delayByType('xxlarge');
    }

    // Поиск целевого запроса в Яндекс с ретраями
    async searchYandex() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ПОИСК В ЯНДЕКС');
        console.log(`📍 Регион ID: ${this.yandexTarget.regionId}`);
        console.log('='.repeat(50));

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                // Инициализируем браузер для целевого поиска
                console.log(`🔄 Запускаем браузер для поиска в Яндекс (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();

                // Идем на Яндекс
                console.log('🌐 Загружаем Яндекс...');
                await this.page.goto('https://ya.ru/', {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                if (await this.checkForCaptcha('yandex')) {
                    console.log(`🚫 Капча при загрузке 'yandex'`);
                    const captchaSolved = await this.handleCaptcha('yandex');

                    if (!captchaSolved) {
                        // Закрываем браузер только если handleCaptcha вернул false
                        // и не закрыл браузер сам (проверяем, жив ли браузер)
                        if (this.browser && !this.browser.isConnected()) {
                            await this.closeBrowser();
                        }

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                    // Если капча решена, продолжаем
                }

                // Пауза перед поиском
                //await this.delayByType('large');

                // Вводим целевой запрос
                console.log('⌨️ Вводим целевой запрос...');
                await this.page.waitForSelector('#text', { timeout: 15000 });
                await this.page.type('#text', this.yandexTarget.query + ' ' + this.yandexTarget.city, { delay: 50 });

                // Пауза перед отправкой
                //await this.delayByType('small');

                await this.page.keyboard.press('Enter');

                // Ждем результаты
                console.log('⏳ Ждем результаты поиска...');
                await this.page.waitForSelector('.serp-item', { timeout: 20000 });

                // Проверка на капчу после поиска
                if (await this.checkForCaptcha('yandex')) {
                    console.log(`🚫 Капча при загрузке 'yandex'`);
                    const captchaSolved = await this.handleCaptcha('yandex');

                    if (!captchaSolved) {
                        // Закрываем браузер только если handleCaptcha вернул false
                        // и не закрыл браузер сам (проверяем, жив ли браузер)
                        //if (this.browser && !this.browser.isConnected()) {
                            await this.closeBrowser();
                        //}

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                    // Если капча решена, продолжаем
                }

                // Добавляем/проверяем параметр региона в URL
                console.log('🌍 Проверяем параметр региона в URL...');
                await this.addRegionToUrl('yandex');

                // Пауза перед анализом результатов
                //await this.delayByType('medium');

                console.log('✅ Целевой поиск в Яндекс выполнен\n');

                // Поиск целевой клиники в Яндекс
                console.log('🔍 Ищем клинику в Яндекс...');
                const result = await this.findTargetClinicYandex();
                this.results.yandex = result;

                // Закрываем браузер после успешного поиска
                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Яндекс (попытка ${attempt}): ${error.message}`);

                if (await this.checkForCaptcha('yandex')) {
                    await this.handleCaptcha('yandex');
                }

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в Яндекс не удался после всех попыток');
        return false;
    }

    // Поиск в Google с ретраями
    async searchGoogle() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ЗАПУСК ПОИСКА В GOOGLE (через Real Browser)');
        console.log(`📍 Регион ID: ${this.googleTarget.regionId}`);
        console.log('='.repeat(50));

        try {
            // Создаем экземпляр GoogleRealBrowser
            this.googleBrowser = new GoogleRealBrowser({
                profilePath: this.profilePath,
                userAgent: this.userAgent,
                viewport: { width: 430, height: 932 },
                regionId: this.googleTarget.regionId,
                query: this.googleTarget.query,
                city: this.googleTarget.city,
                //clinicNames: this.googleTarget.clinicNames
            });

            // Выполняем полный цикл через GoogleRealBrowser
            console.log('🚀 Делегируем весь процесс GoogleRealBrowser...');
            this.results.google = await this.googleBrowser.runFullSearchAndParse();

            console.log('✅ Поиск в Google завершён через Real Browser');
            return true;

        } catch (error) {
            console.log(`❌ Ошибка при поиске в Google: ${error.message}`);
            
            // Закрываем Google браузер при ошибке
            try {
                if (this.googleBrowser) {
                    await this.googleBrowser.close();
                }
            } catch (closeError) {
                // Игнорируем ошибку закрытия
            }
            
            return false;
        }
    }

    // Поиск в 2GIS с ретраями
    async search2GIS() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ПОИСК В 2GIS');
        console.log(`📍 Запрос: ${this.gisTarget.query}`);
        console.log('='.repeat(50));

        if (!this.gisTarget || !this.gisTarget.url) {
            console.log('❌ Не указаны параметры для поиска в 2GIS');
            return false;
        }

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                // Инициализируем браузер для целевого поиска
                console.log(`🔄 Запускаем браузер для поиска в 2GIS (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();

                // Настраиваем заголовки для 2GIS
                await this.page.setExtraHTTPHeaders({
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                });

                console.log('🌐 Загружаем 2GIS...');
                await this.page.goto(this.gisTarget.url, {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                // Проверка на капчу (добавляем для 2GIS)
                /*const hasCaptcha = await this.checkForCaptcha('gis');
                if (hasCaptcha) {
                    console.log(`🚫 Капча при загрузке 2GIS`);
                    const captchaSolved = await this.handleCaptcha('gis');

                    if (!captchaSolved) {
                        // Закрываем браузер между попытками
                        await this.closeBrowser();

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                    // Если капча решена, продолжаем
                }*/

                // Пауза для полной загрузки страницы
                //await this.delayByType('large');

                await this.page.waitForSelector("._xppdink", { timeout: 5000 });
                const gisModal = await this.page.$("._xppdink");
                if (gisModal) {
                    await gisModal.click();
                    console.log(`✅ close modal 2gis`);
                }

                console.log('🔍 Ищем поисковую строку 2GIS...');

                // Ждем поисковую строку (пробуем разные селекторы)
                let searchInput = null;
                const searchInputSelectors = [
                    'input[type="search"]',
                    'input[placeholder*="Поиск"]',
                    'input[placeholder*="поиск"]',
                    '._1gvu1zk', // Класс поисковой строки 2GIS
                    'input[class*="search"]',
                    'input[class*="Search"]'
                ];

                for (const selector of searchInputSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        searchInput = await this.page.$(selector);
                        if (searchInput) {
                            console.log(`✅ Найдена поисковая строка по селектору: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!searchInput) {
                    console.log('❌ Не удалось найти поисковую строку 2GIS');

                    // Делаем скриншот для отладки
                    // await this.page.screenshot({ path: `2gis_no_search_${Date.now()}.png` });

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // Пауза перед вводом
                //await this.delayByType('medium');

                // Вводим запрос в поисковую строку
                console.log(`⌨️ Вводим запрос в 2GIS: "${this.gisTarget.query}"`);

                // Кликаем на поисковую строку
                await searchInput.click({ clickCount: 3 });
                //await this.delayByType('small');

                // Очищаем поле (если там что-то есть)
                /*await searchInput.press('Backspace');
                await this.delayByType('small');*/

                // Вводим запрос
                await searchInput.type(this.gisTarget.query, { delay: 100 });
                //await this.delayByType('small');

                // Нажимаем Enter для поиска
                await searchInput.press('Enter');

                // Ждем загрузки результатов поиска
                console.log('⏳ Ждем результаты поиска в 2GIS...');

                // Ждем появления результатов (карточек организаций)
                try {
                    await this.page.waitForSelector(this.selectors.gis.companyCards, {
                        timeout: 15000
                    });
                    console.log('✅ Результаты поиска загрузились');
                } catch (error) {
                    console.log('⚠️ Не удалось дождаться стандартных результатов, проверяем альтернативные селекторы...');

                    // Пробуем альтернативные селекторы
                    const alternativeSelectors = [
                        '._1hf7139', // Основной селектор карточек
                        'div[data-item-type="organization"]',
                        '.card', // Общий класс карточек
                        'div[class*="card"]',
                        'div[class*="result"]'
                    ];

                    let resultsFound = false;
                    for (const selector of alternativeSelectors) {
                        try {
                            await this.page.waitForSelector(selector, { timeout: 5000 });
                            console.log(`✅ Найдены результаты по селектору: ${selector}`);
                            resultsFound = true;
                            break;
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!resultsFound) {
                        console.log('❌ Не удалось найти результаты поиска');

                        // Делаем скриншот для отладки
                        // await this.page.screenshot({ path: `2gis_no_results_${Date.now()}.png` });

                        // Закрываем браузер между попытками
                        await this.closeBrowser();

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                }

                // Дополнительная проверка на капчу после поиска
                /*const hasCaptchaAfterLoad = await this.checkForCaptcha('gis');
                if (hasCaptchaAfterLoad) {
                    console.log('🚫 Капча после выполнения поиска');
                    const captchaSolved = await this.handleCaptcha('gis');

                    if (!captchaSolved) {
                        // Закрываем браузер между попытками
                        await this.closeBrowser();

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                }*/

                // Пауза для полной загрузки всех карточек
                //await this.delayByType('large');

                // Прокручиваем страницу для загрузки всех карточек
                /*console.log('📜 Прокручиваем страницу для загрузки всех результатов...');
                await this.randomScroll();
                await this.delayByType('medium');*/

                // Пробуем прокрутить еще раз
                /*await this.randomScroll();
                await this.delayByType('medium');*/

                console.log('✅ Целевой поиск в 2GIS выполнен\n');

                // Поиск целевой клиники в 2GIS
                console.log('🔍 Ищем клинику в результатах 2GIS...');
                const result = await this.findTargetClinic2GIS();
                this.results.gis = result;
                console.log('поиск 2гис завершен');

                // Закрываем браузер после успешного поиска
                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в 2GIS (попытка ${attempt}): ${error.message}`);

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в 2GIS не удался после всех попыток');
        return false;
    }

    // Поиск целевой клиники в Яндекс
    async findTargetClinicYandex() {
        console.log(`\n🔍 Ищем клинику в Яндекс:`);
        // this.yandexTarget.clinicNames.forEach((name, i) => {
        //     console.log(`   ${i + 1}. "${name}"`);
        // });

        let foundClinics = []; // Массив для найденных клиник
        let totalChecked = 0;
        let reloadAttempts = 0;
        const maxReloadAttempts = 3;

        try {
            // Проверка на капчу перед началом поиска
            /*if (await this.checkForCaptcha('yandex')) {
                console.log('🚫 Капча перед поиском клиники');
                await this.handleCaptcha('yandex');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }*/

            if (await this.checkForCaptcha('yandex')) {
                console.log(`🚫 Капча при загрузке 'yandex'`);
                const captchaSolved = await this.handleCaptcha('yandex');

                if (!captchaSolved) {
                    // Закрываем браузер только если handleCaptcha вернул false
                    // и не закрыл браузер сам (проверяем, жив ли браузер)
                    if (this.browser && !this.browser.isConnected()) {
                        await this.closeBrowser();
                    }

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                // Если капча решена, продолжаем
            }

            // Пауза перед началом поиска
            //await this.delayByType('medium');

            // Сначала пытаемся найти и нажать кнопку "Показать ещё"
            console.log('🔍 Ищем кнопку "Показать ещё"...');

            // Ждем немного для загрузки страницы
            //await this.delayByType('medium');

            // Исправленная логика: работаем с одним элементом (singular)
            const showMoreXPath = '.OrgsList-More';
            let showMoreElement = await this.page.$(showMoreXPath);
            let showMoreClicked = false;

            if (showMoreElement) {
                console.log('✅ Найдена кнопка "Показать ещё"');

                try {
                    // Получаем текст кнопки для отладки
                    const buttonText = await showMoreElement.evaluate(el => el.textContent?.trim());
                    console.log(`Текст кнопки: "${buttonText}"`);
                } catch (e) {
                    // Игнорируем ошибку получения текста
                }
            } else {
                console.log('❌ Кнопка "Показать ещё" не найдена');
            }

            // Исправленный цикл: работаем с одним элементом
            while (showMoreElement) {
                try {
                    // Скроллим к кнопке
                    console.log('🖱️ Нажимаем кнопку "Показать ещё"...');

                    // Прокручиваем к элементу
                    await showMoreElement.scrollIntoView();

                    // Ждем немного перед кликом
                    //await this.delayByType('small');

                    // Нажимаем кнопку
                    await showMoreElement.click();
                    showMoreClicked = true;

                    // Ждем загрузки дополнительных карточек
                    console.log('⏳ Ждем загрузки дополнительных карточек...');
                    //await this.delayByType('large');

                    // Проверяем, появилась ли кнопка снова (обновляем элемент)
                    showMoreElement = await this.page.$(showMoreXPath);

                    if (showMoreElement) {
                        console.log('✅ Кнопка "Показать ещё" все еще присутствует, продолжаем...');

                        try {
                            const buttonText = await showMoreElement.evaluate(el => el.textContent?.trim());
                            console.log(`Текст кнопки: "${buttonText}"`);
                        } catch (e) {
                            // Игнорируем ошибку
                        }
                    } else {
                        console.log('✅ Больше нет кнопки "Показать ещё"');
                    }

                } catch (error) {
                    console.log(`⚠️ Не удалось нажать кнопку "Показать ещё": ${error.message}`);

                    // Проверяем, возможно кнопка стала недоступной
                    try {
                        const isDisabled = await showMoreElement.evaluate(el =>
                            el.disabled || el.getAttribute('aria-disabled') === 'true'
                        );

                        if (isDisabled) {
                            console.log('ℹ️ Кнопка "Показать ещё" недоступна (disabled)');
                            break;
                        }
                    } catch (e) {
                        // Игнорируем ошибку проверки
                    }

                    // Выходим из цикла при ошибке
                    break;
                }
            }

            if (showMoreClicked) {
                console.log('✅ Нажатие кнопки "Показать ещё" завершено');
            }

            // Теперь ждем загрузки карточек (после нажатия кнопки "Показать ещё")
            console.log('⏳ Ждем загрузки карточек организаций...');

            let cardsLoaded = false;
            let currentCards = [];

            while (reloadAttempts < maxReloadAttempts) {
                try {
                    // Ждем появления карточек
                    await this.page.waitForSelector('.OrgsList-Item', { timeout: 20000 });
                    currentCards = await this.page.$$('.OrgsList-Item');

                    if (currentCards.length > 0) {
                        console.log(`📋 Карточек загружено: ${currentCards.length}`);
                        cardsLoaded = true;
                        break;
                    } else {
                        reloadAttempts++;
                        if (reloadAttempts < maxReloadAttempts) {
                            console.log(`🔄 Перезагружаем страницу (попытка ${reloadAttempts}/${maxReloadAttempts})...`);
                            await this.page.reload();
                            // await this.delayByType('large');

                            // После перезагрузки снова пробуем найти кнопку "Показать ещё"
                            showMoreElement = await this.page.$(showMoreXPath);
                            if (showMoreElement) {
                                try {
                                    console.log('🔄 После перезагрузки снова нажимаем "Показать ещё"...');
                                    await showMoreElement.click();
                                    // await this.delayByType('large');
                                } catch (e) {
                                    console.log('⚠️ Не удалось нажать кнопку после перезагрузки');
                                }
                            }
                        }
                    }
                } catch (error) {
                    reloadAttempts++;
                    if (reloadAttempts < maxReloadAttempts) {
                        console.log(`🔄 Перезагружаем страницу (попытка ${reloadAttempts}/${maxReloadAttempts})...`);
                        await this.page.reload();
                        // await this.delayByType('large');

                        // После перезагрузки снова пробуем найти кнопку "Показать ещё"
                        showMoreElement = await this.page.$(showMoreXPath);
                        if (showMoreElement) {
                            try {
                                console.log('🔄 После перезагрузки снова нажимаем "Показать ещё"...');
                                await showMoreElement.click();
                                // await this.delayByType('large');
                            } catch (e) {
                                console.log('⚠️ Не удалось нажать кнопку после перезагрузки');
                            }
                        }
                    }
                }
            }

            if (!cardsLoaded || currentCards.length === 0) {
                console.log('❌ Не удалось загрузить карточки организаций после перезагрузок');
                return {
                    found: false,
                    foundClinics: [],
                    totalChecked: 0
                };
            }

            // Пауза перед анализом
            //await this.delayByType('medium');

            // Проверяем все карточки БЕЗ ПАУЗ
            console.log('🔍 Проверяем карточки на наличие целевых клиник...');

            for (let i = 0; i < currentCards.length; i++) {
                try {
                    const card = currentCards[i];
                    totalChecked++;

                    // Получаем заголовок
                    const titleElement = await card.$('.OrgMinibadge-TitleText');
                    const title = titleElement ?
                        await this.page.evaluate(el => el.textContent?.trim(), titleElement) : '';

                    const addressElement = await card.$('.OrgMinibadge-Address');
                    const address = addressElement ?
                        await this.page.evaluate(el => el.textContent?.trim(), addressElement) : '';

                    // Проверяем совпадение со ВСЕМИ целевыми названиями
                    /*for (const clinicName of this.yandexTarget.clinicNames) {
                        if (title && title.toLowerCase().includes(clinicName.toLowerCase())) {*/
                    const foundClinic = {
                        //position: i + 1,
                        //clinicName: clinicName,
                        fullTitle: title,
                        address: address,
                        //cardIndex: i
                    };

                    foundClinics.push(foundClinic);
                    console.log(`\n🎯 НАЙДЕНО в Яндекс!`);
                    //console.log(`   Позиция: ${foundClinic.position}`);
                    console.log(`   Клиника: ${foundClinic.fullTitle}`);
                    console.log(`   Адрес: ${foundClinic.address}`);
                    /*}
                }*/

                    // Логируем для отладки (только первые несколько карточек)
                    if (i < 5 && title) {
                        console.log(`   [${i + 1}] ${title.substring(0, 50)}...`);
                    }

                } catch (error) {
                    // Пропускаем ошибки при проверке карточек
                    console.log(`   ⚠️ Ошибка при проверке карточки ${i + 1}: ${error.message}`);
                }
            }

            // Сортируем найденные клиники по позиции
            foundClinics.sort((a, b) => a.position - b.position);

            return {
                found: foundClinics.length > 0,
                foundClinics: foundClinics,
                totalChecked: totalChecked
            };

        } catch (error) {
            console.log(`❌ Ошибка при поиске клиники в Яндекс: ${error.message}`);
            return {
                found: false,
                foundClinics: [],
                totalChecked: totalChecked
            };
        }
    }

    // Поиск целевой клиники в 2GIS 
    async findTargetClinic2GIS() {
        console.log(`\n🔍 Собираем ВСЕ организации из 2GIS (все страницы)...`);

        let allOrganizations = []; // Массив для ВСЕХ организаций
        let currentPage = 1;
        let globalPosition = 1; // Общая позиция во всей выдаче
        let hasMorePages = true;

        try {
            // Основной цикл по страницам
            while (hasMorePages) {
                console.log(`\n📄 Страница ${currentPage}:`);
                console.log('-'.repeat(30));

                // Пауза для загрузки страницы
                await this.delayByType('small');

                console.log('🔍 Ищем карточки организаций...');

                // Ждем загрузки карточек
                try {
                    await this.page.waitForSelector(this.selectors.gis.companyCards, {
                        timeout: currentPage === 1 ? 15000 : 20000
                    });
                } catch (error) {
                    console.log('⚠️ Не удалось найти карточки организаций');

                    // Попытка перезагрузки страницы при проблемах
                    if (currentPage === 1) {
                        console.log('🔄 Перезагружаем страницу...');
                        await this.page.reload();
                        //await this.delayByType('large');
                        continue;
                    } else {
                        console.log('ℹ️ Возможно, это последняя страница');
                        break;
                    }
                }

                // Получаем все карточки организаций на текущей странице
                const cards = await this.page.$$(this.selectors.gis.companyCards);
                console.log(`📋 Найдено карточек: ${cards.length}`);

                if (cards.length === 0) {
                    console.log('ℹ️ На странице нет карточек, завершаем сбор');
                    break;
                }

                // Парсим все карточки на текущей странице БЕЗ ПАУЗ
                for (let i = 0; i < cards.length; i++) {
                    try {
                        const card = cards[i];

                        // Получаем название организации
                        let title = '';
                        const titleElement = await card.$(this.selectors.gis.companyTitle);
                        if (titleElement) {
                            title = await this.page.evaluate(el => {
                                const span = el.querySelector('span');
                                return span ? span.textContent?.trim() : el.textContent?.trim();
                            }, titleElement);
                        }

                        // Альтернативный поиск названия
                        if (!title) {
                            const cardText = await this.page.evaluate(el => el.textContent?.trim(), card);
                            const titleMatch = cardText.match(/[А-Я][А-Яа-яё\s\d-]{2,50}(?=\s|$)/);
                            if (titleMatch) {
                                title = titleMatch[0].trim();
                            } else if (cardText.length > 0) {
                                // Берем первые 50 символов как название
                                title = cardText.substring(0, 50).trim();
                            }
                        }

                        // Получаем адрес
                        let address = '';
                        const addressElement = await card.$(this.selectors.gis.companyAddress);
                        if (addressElement) {
                            address = await this.page.evaluate(el => {
                                const text = el.textContent?.trim();
                                return text;
                            }, addressElement);
                        }

                        // Создаем объект организации
                        const organization = {
                            //globalPosition: globalPosition++, // Уникальный номер во всей выдаче
                            //page: currentPage,
                            //pagePosition: i + 1, // Позиция на странице
                            title: title || 'Не указано',
                            address: address || 'Не указан',
                            //timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
                        };

                        allOrganizations.push(organization);

                        // Логируем каждую организацию
                        console.log(`      ${organization.title}`);
                        if (address) console.log(`      📍 ${organization.address}`);

                    } catch (error) {
                        console.log(`   ⚠️ Ошибка при парсинге карточки ${i + 1}: ${error.message}`);

                        // Добавляем запись об ошибке
                        allOrganizations.push({
                            //globalPosition: globalPosition++,
                            //page: currentPage,
                            //pagePosition: i + 1,
                            title: 'Ошибка парсинга',
                            address: 'Не удалось распарсить',
                            error: error.message,
                            //timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
                        });
                    }
                }

                console.log(`✅ Страница ${currentPage} обработана: ${cards.length} организаций`);

                // ПАУЗА перед переходом на следующую страницу
                //await this.delayByType('medium');

                // Пытаемся найти и нажать кнопку "следующая страница" через пагинацию
                console.log('🔍 Ищем кнопку перехода на следующую страницу...');
                hasMorePages = await this.goToNextPage2GIS(currentPage);

                if (hasMorePages) {
                    currentPage++;

                    // Дополнительная пауза после перехода
                    //await this.delayByType('medium');
                } else {
                    console.log(`🏁 Все страницы обработаны. Всего страниц: ${currentPage}`);
                }

                // Защита от бесконечного цикла
                if (currentPage > 5) {
                    console.log('⚠️ Достигнут лимит в 5 страниц, завершаем сбор');
                    break;
                }
            }

            // Итоговая статистика
            console.log('\n' + '='.repeat(60));
            console.log('📊 СБОР ДАННЫХ ЗАВЕРШЕН');
            console.log('='.repeat(60));
            console.log(`📄 Всего страниц: ${currentPage}`);
            console.log(`🏢 Всего организаций: ${allOrganizations.length}`);
            console.log(`⏱️ Время сбора: ${new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()}`);

            return {
                success: true,
                /*totalPages: currentPage,
                totalOrganizations: allOrganizations.length,*/
                organizations: allOrganizations
            };

        } catch (error) {
            console.log(`❌ Критическая ошибка при сборе данных из 2GIS: ${error.message}`);

            return {
                success: false,
                error: error.message,
                /*totalPages: currentPage,
                totalOrganizations: allOrganizations.length,*/
                organizations: allOrganizations
            };
        }
    }

    // Метод для перехода на следующую страницу в 2GIS через клик
    async goToNextPage2GIS(currentPage) {
        try {
            console.log(`   🔄 Пытаемся перейти на страницу ${currentPage + 1}...`);

            // 1. Ищем блок пагинации
            const paginationSelector = 'div._1x4k6z7';
            const pagination = await this.page.$(paginationSelector);

            if (!pagination) {
                console.log('   ℹ️ Блок пагинации не найден (возможно, это последняя страница)');
                return false;
            }

            // 2. Ищем активную страницу (текущую)
            const activePageSelector = 'div._1wkjy8d5 span._19xy60y'; // Активная страница (div, а не a)
            const activePageElement = await pagination.$(activePageSelector);
            let currentPageNumber = currentPage;

            if (activePageElement) {
                const activePageText = await this.page.evaluate(el => el.textContent?.trim(), activePageElement);
                currentPageNumber = parseInt(activePageText) || currentPage;
            }

            console.log(`   📍 Текущая страница в пагинации: ${currentPageNumber}`);

            // 3. Ищем ВСЕ ссылки/кнопки страниц
            const allPageLinks = await pagination.$$('a._1nk3cti0'); // Все ссылки на страницы
            const allPageButtons = await pagination.$$('div._1wkjy8d5, a._1nk3cti0'); // Все элементы пагинации

            console.log(`   🔗 Найдено ссылок на страницы: ${allPageLinks.length}`);
            console.log(`   🔘 Всего элементов пагинации: ${allPageButtons.length}`);

            // 4. Определяем, какая страница следующая
            let nextPageElement = null;
            let nextPageNumber = currentPageNumber + 1;

            // Вариант 1: Ищем элемент с номером следующей страницы
            for (const element of allPageButtons) {
                const pageText = await this.page.evaluate(el => el.textContent?.trim(), element);
                const pageNum = parseInt(pageText);

                if (pageNum === nextPageNumber) {
                    nextPageElement = element;
                    console.log(`   ✅ Найден элемент страницы ${nextPageNumber}`);
                    break;
                }
            }

            // 5. Кликаем на найденный элемент
            if (nextPageElement) {
                console.log(`   🖱️ Кликаем на элемент перехода...`);

                // Скроллим к элементу
                await nextPageElement.scrollIntoView();
                //await this.delayByType('small');

                // Кликаем
                await nextPageElement.click();

                // Ждем загрузки новой страницы
                console.log(`   ⏳ Ждем загрузки страницы ${nextPageNumber}...`);
                //await this.delayByType('large');

                // Проверяем, что загрузилась новая страница (по изменению URL или контента)
                const newUrl = this.page.url();
                console.log(`   ✅ Перешли на: ${newUrl}`);

                return true;
            } else {
                console.log(`   ❌ Не найдена кнопка для перехода на страницу ${nextPageNumber}`);
                console.log(`   ℹ️ Вероятно, страница ${currentPageNumber} - последняя`);
                return false;
            }

        } catch (error) {
            console.log(`   ⚠️ Ошибка при переходе на следующую страницу: ${error.message}`);
            return false;
        }
    }

    async searchZoon() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 ПОИСК В ZOON');
        console.log(`📍 URL: ${this.zoonTarget.url}`);
        console.log(`🔍 Запрос: ${this.zoonTarget.query}`);
        console.log('='.repeat(50));

        if (!this.zoonTarget || !this.zoonTarget.url) {
            console.log('❌ Не указаны параметры для поиска в Zoon');
            return false;
        }

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                console.log(`🔄 Запускаем браузер для поиска в Zoon (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();
                let result = null;

                console.log('🌐 Загружаем Zoon...');
                await this.page.goto(this.zoonTarget.url, {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                // await this.delayByType('large');

                console.log('🔍 Ищем поисковую строку Zoon...');

                let searchInputs = null;
                let searchInput = null;
                const searchInputSelectors = [
                    'input[name="query"][type="search"]',
                    'input[type="search"]',
                    'input[placeholder*="Поиск"]',
                    //'input[placeholder*="поиск"]',
                    '.js-suggest2__input'
                ];

                for (const selector of searchInputSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        searchInputs = await this.page.$$(selector);
                        searchInput = searchInputs[1];
                        if (searchInput) {
                            console.log(`✅ Найдена поисковая строка по селектору: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!searchInput) {
                    console.log('❌ Не удалось найти поисковую строку Zoon');

                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                // await this.delayByType('medium');

                console.log(`⌨️ Вводим запрос в Zoon: "${this.zoonTarget.query}"`);

                /*await searchInput.click({ clickCount: 3 });
                await this.delayByType('small');

                await searchInput.press('Backspace');
                await this.delayByType('small');*/

                await searchInput.type(this.zoonTarget.query, { delay: 100 });
                // await this.delayByType('medium');

                /*const searchForm = await this.page.$(this.selectors.zoon.searchForm);
                if (searchForm) {
                    await searchForm.evaluate(form => form.submit());
                } else {*/
                    await searchInput.press('Enter');
                //}

                console.log('⏳ Ждем результаты поиска в Zoon...');

                try {
                    await this.page.waitForSelector(this.selectors.zoon.companyCards, {
                        timeout: 15000
                    });
                    console.log('✅ Результаты поиска загрузились');
                } catch (error) {
                    console.log('⚠️ Не удалось дождаться стандартных результатов, проверяем альтернативные селекторы...');

                    const alternativeSelectors = [
                        '.org-minicard',
                        'div[class*="minicard"]',
                        'li[class*="results"]',
                        '.js-results-container'
                    ];

                    let resultsFound = false;
                    for (const selector of alternativeSelectors) {
                        try {
                            await this.page.waitForSelector(selector, { timeout: 5000 });
                            console.log(`✅ Найдены результаты по селектору: ${selector}`);
                            resultsFound = true;
                            break;
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!resultsFound) {
                        console.log('❌ Не удалось найти результаты поиска');

                        await this.closeBrowser();

                        if (attempt < this.retryConfig.maxAttempts) {
                            const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                            console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        continue;
                    }
                }

                /*await this.delayByType('large');

                console.log('📜 Прокручиваем страницу для загрузки всех результатов...');
                await this.randomScroll();
                await this.delayByType('medium');

                await this.randomScroll();
                await this.delayByType('medium');

                console.log('✅ Целевой поиск в Zoon выполнен\n');*/

                console.log('🔍 Ищем клиники в результатах Zoon...');

                const firstResult = await this.page.$(this.selectors.zoon.firstResult);
                if (firstResult) {
                    console.log('🖱️ Кликаем на первый результат...');
                    
                    // Получаем количество вкладок до клика
                    const pagesBefore = await this.browser.pages();
                    console.log(`📑 Вкладок до клика: ${pagesBefore.length}`);
                    
                    // Сохраняем ссылку для резервного варианта
                    const href = await firstResult.evaluate(el => el.getAttribute('href'));
                    console.log(`🔗 Ссылка на результат: ${href}`);
                    
                    try {
                        // Пробуем кликнуть на результат (откроется новая вкладка)
                        await firstResult.click();
                        
                        // Ждем открытия новой вкладки
                        console.log('⏳ Ждем открытия новой вкладки...');
                        await this.delayByType('small');
                        
                        // Получаем все вкладки после клика
                        const pagesAfter = await this.browser.pages();
                        console.log(`📑 Вкладок после клика: ${pagesAfter.length}`);
                        
                        if (pagesAfter.length > pagesBefore.length) {
                            // Найдена новая вкладка
                            console.log('✅ Открыта новая вкладка, переключаемся...');
                            
                            // Закрываем старую вкладку (или оставляем ее)
                            // const newPage = pagesAfter[pagesAfter.length - 1];
                            // this.page = newPage;
                            // await this.page.bringToFront();
                            
                            // Лучше найти новую вкладку и работать с ней
                            const newTab = pagesAfter.find(page => page !== this.page && !pagesBefore.includes(page));
                            if (newTab) {
                                const oldPage = this.page;
                                this.page = newTab;
                                await this.page.bringToFront();
                                
                                // Ждем загрузки новой страницы
                                console.log('⏳ Ждем загрузки новой страницы...');
                                // await this.delayByType('large');
                                
                                // Закрываем старую вкладку если нужно
                                // await oldPage.close();

                                result = await this.findTargetClinicZoon();
                            } else {
                                console.log('⚠️ Не удалось найти новую вкладку, продолжаем на текущей');
                                result = await this.findAllClinicsZoon();
                            }
                        } else {
                            console.log('⚠️ Новая вкладка не открылась, возможно ссылка открывается в этой же вкладке');
                            result = await this.findAllClinicsZoon();
                        }
                        
                    } catch (clickError) {
                        console.log(`⚠️ Ошибка при клике на результат: ${clickError.message}`);
                        console.log('🔄 Пробуем альтернативный вариант...');
                        
                        // Пробуем открыть ссылку в новой вкладке через evaluate
                        if (href) {
                            try {
                                await this.page.evaluate((url) => {
                                    window.open(url, '_blank');
                                }, href);
                                // await this.delayByType('large');
                                
                                const pagesAfter = await this.browser.pages();
                                const newTab = pagesAfter.find(page => page !== this.page);
                                if (newTab) {
                                    this.page = newTab;
                                    await this.page.bringToFront();
                                    //await this.delayByType('large');
                                    result = await this.findTargetClinicZoon();
                                } else {
                                    result = await this.findAllClinicsZoon();
                                }
                            } catch (e) {
                                console.log('❌ Не удалось открыть ссылку, собираем с текущей страницы');
                                result = await this.findAllClinicsZoon();
                            }
                        } else {
                            //result = await this.findAllClinicsZoon();
                        }
                    }
                } else {
                    console.log('⚠️ Первый результат не найден');
                    //result = await this.findAllClinicsZoon();
                }

                this.results.zoon = result;

                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Zoon (попытка ${attempt}): ${error.message}`);

                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в Zoon не удался после всех попыток');
        return false;
    }

    async findAllClinicsZoon() {
        console.log(`\n🔍 Собираем ВСЕ организации из Zoon...`);

        let allOrganizations = [];
        let currentPage = 1;
        let hasMorePages = true;

        try {
            while (hasMorePages) {
                allOrganizations = [];
                console.log(`\n📄 Страница ${currentPage}:`);
                console.log('-'.repeat(30));

                // await this.delayByType('medium');

                console.log('🔍 Ищем карточки организаций...');

                try {
                    await this.page.waitForSelector(this.selectors.zoon.companyCards, {
                        timeout: currentPage === 1 ? 15000 : 10000
                    });
                } catch (error) {
                    console.log('⚠️ Не удалось найти карточки организаций');

                    if (currentPage === 1) {
                        console.log('🔄 Перезагружаем страницу...');
                        await this.page.reload();
                        //await this.delayByType('large');
                        continue;
                    } else {
                        console.log('ℹ️ Возможно, это последняя страница');
                        break;
                    }
                }

                const cards = await this.page.$$(this.selectors.zoon.companyCards);
                console.log(`📋 Найдено карточек: ${cards.length}`);

                if (cards.length === 0) {
                    console.log('ℹ️ На странице нет карточек, завершаем сбор');
                    break;
                }

                for (let i = 0; i < cards.length; i++) {
                    try {
                        const card = cards[i];

                        let title = '';
                        const titleElement = await card.$(this.selectors.zoon.companyTitle);
                        if (titleElement) {
                            title = await this.page.evaluate(el => el.textContent?.trim(), titleElement);
                        }

                        let address = '';
                        const addressElement = await card.$(this.selectors.zoon.companyAddress);
                        if (addressElement) {
                            address = await this.page.evaluate(el => el.textContent?.trim(), addressElement);
                        }

                        /*let rating = '';
                        const ratingElement = await card.$(this.selectors.zoon.rating);
                        if (ratingElement) {
                            rating = await this.page.evaluate(el => {
                                const boldText = el.querySelector('.z-text--bold');
                                return boldText ? boldText.textContent?.trim() : '';
                            }, ratingElement);
                        }

                        let comments = '';
                        const commentsElement = await card.$(this.selectors.zoon.comments);
                        if (commentsElement) {
                            comments = await this.page.evaluate(el => {
                                const spanText = Array.from(el.querySelectorAll('span'))
                                    .map(span => span.textContent?.trim())
                                    .join(' ');
                                return spanText;
                            }, commentsElement);
                        }*/

                        const organization = {
                            /*page: currentPage,
                            position: i + 1,*/
                            title: title || 'Не указано',
                            address: address || 'Не указан',
                            //rating: rating || 'Нет рейтинга',
                            //comments: comments || 'Нет отзывов',
                            //timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
                        };

                        allOrganizations.push(organization);

                        console.log(`   ${organization.position}. ${organization.title}`);
                        if (address) console.log(`      📍 ${organization.address}`);
                        /*if (rating) console.log(`      ⭐ ${organization.rating}`);
                        if (comments && comments !== 'Нет отзывов') console.log(`      💬 ${organization.comments}`);*/

                    } catch (error) {
                        console.log(`   ⚠️ Ошибка при парсинге карточки ${i + 1}: ${error.message}`);

                        allOrganizations.push({
                            /*page: currentPage,
                            position: i + 1,*/
                            title: 'Ошибка парсинга',
                            address: 'Не удалось распарсить',
                            //rating: 'Нет рейтинга',
                            //comments: 'Нет отзывов',
                            error: error.message,
                            //timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
                        });
                    }
                }

                console.log(`✅ Страница ${currentPage} обработана: ${cards.length} организаций`);

                //await this.delayByType('medium');

                console.log('🔍 Проверяем наличие кнопки "Показать еще"...');
                hasMorePages = await this.goToNextPageZoon(currentPage);

                if (hasMorePages) {
                    currentPage++;

                    //await this.delayByType('medium');
                } else {
                    console.log(`🏁 Все страницы обработаны. Всего страниц: ${currentPage}`);
                }

                if (currentPage > 5) {
                    console.log('⚠️ Достигнут лимит в 5 страниц, завершаем сбор');
                    break;
                }
            }

            console.log('\n' + '='.repeat(60));
            console.log('📊 СБОР ДАННЫХ ZOON ЗАВЕРШЕН');
            console.log('='.repeat(60));
            console.log(`📄 Всего страниц: ${currentPage}`);
            console.log(`🏢 Всего организаций: ${allOrganizations.length}`);
            console.log(`⏱️ Время сбора: ${new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()}`);

            return {
                success: true,
                /*totalPages: currentPage,
                totalOrganizations: allOrganizations.length,*/
                organizations: allOrganizations
            };

        } catch (error) {
            console.log(`❌ Критическая ошибка при сборе данных из Zoon: ${error.message}`);

            return {
                success: false,
                error: error.message,
                /*totalPages: currentPage,
                totalOrganizations: allOrganizations.length,*/
                organizations: allOrganizations
            };
        }
    }

    async findTargetClinicZoon() {
        console.log(`\n🔍 Собираем ВСЕ организации с страницы результатов Zoon...`);
        return await this.findAllClinicsZoon();
    }

    async goToNextPageZoon(currentPage) {
        try {
            console.log(`   🔄 Пытаемся перейти на страницу ${currentPage + 1}...`);

            const showMoreButton = await this.page.$(this.selectors.zoon.showMoreButton);
            const nextPageLink = await this.page.$(this.selectors.zoon.showMore);

            if (showMoreButton) {
                console.log('   ✅ Найдена кнопка "Показать еще"...');

                await showMoreButton.scrollIntoView();
                //await this.delayByType('small');

                const currentUrl = this.page.url();
                console.log(`   📍 Текущий URL: ${currentUrl.substring(0, 100)}...`);

                await showMoreButton.click();

                console.log(`   ⏳ Ждем загрузки следующей страницы...`);
                //await this.delayByType('large');

                const newUrl = this.page.url();
                console.log(`   ✅ Перешли на: ${newUrl.substring(0, 100)}...`);

                return true;
            } else if (nextPageLink) {
                console.log('   ✅ Найдена ссылка на следующую страницу...');

                await nextPageLink.scrollIntoView();
                //await this.delayByType('small');

                const href = await this.page.evaluate(el => el.getAttribute('href'), nextPageLink);
                if (href) {
                    const currentUrl = this.page.url();
                    console.log(`   📍 Текущий URL: ${currentUrl.substring(0, 100)}...`);

                    await nextPageLink.click();

                    console.log(`   ⏳ Ждем загрузки следующей страницы...`);
                    //await this.delayByType('large');

                    const newUrl = this.page.url();
                    console.log(`   ✅ Перешли на: ${newUrl.substring(0, 100)}...`);

                    return true;
                }
            } else {
                console.log('   ℹ️ Кнопка "Показать еще" или ссылка на следующую страницу не найдена');
                console.log('   ℹ️ Вероятно, страница последняя');

                const pagingContainer = await this.page.$(this.selectors.zoon.showMoreContainer);
                if (pagingContainer) {
                    const nextPageElements = await pagingContainer.$$('a[href*="page-"]');
                    for (const element of nextPageElements) {
                        const pageText = await this.page.evaluate(el => el.textContent?.trim(), element);
                        const pageNum = parseInt(pageText);
                        if (pageNum === currentPage + 1) {
                            console.log(`   ✅ Найдена ссылка на страницу ${pageNum}`);

                            await element.scrollIntoView();
                            //await this.delayByType('small');

                            await element.click();
                            console.log(`   ⏳ Ждем загрузки страницы ${pageNum}...`);
                            //await this.delayByType('large');

                            return true;
                        }
                    }
                }

                return false;
            }

            return false;

        } catch (error) {
            console.log(`   ⚠️ Ошибка при переходе на следующую страницу: ${error.message}`);
            return false;
        }
    }

    async run() {
        try {
            console.log('='.repeat(60));
            console.log('🤖 УНИВЕРСАЛЬНЫЙ ПОИСКОВЫЙ БОТ');
            console.log(`👤 Профиль: ${this.profileId}`);
            console.log(`🔄 Один профиль для Яндекс, Google, 2GIS и Zoon`);
            console.log(`⏱️ Ускоренный поиск карточек БЕЗ пауз`);
            console.log('='.repeat(60) + '\n');

            console.log('1️⃣ ЭТАП: НАГУЛ ПРОФИЛЯ В ЯНДЕКС');
            console.log('-'.repeat(40));
            await this.warmUpProfile();

            if (this.yandexTarget) {
                console.log('\n2️⃣ ЭТАП: ПОИСК В ЯНДЕКС');
                console.log('-'.repeat(40));
                await this.searchYandex();
            }

            if (this.googleTarget) {
                console.log('\n3️⃣ ЭТАП: ПОИСК В GOOGLE');
                console.log('-'.repeat(40));
                await this.searchGoogle();
            }

            if (this.gisTarget) {
                console.log('\n4️⃣ ЭТАП: ПОИСК В 2GIS');
                console.log('-'.repeat(40));
                await this.search2GIS();
            }

            if (this.zoonTarget) {
                console.log('\n5️⃣ ЭТАП: ПОИСК В ZOON');
                console.log('-'.repeat(40));
                await this.searchZoon();
            }

            await this.printResults();

        } catch (error) {
            console.error(`\n💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
            console.error(error.stack);
        } finally {
            await this.closeBrowser();
            console.log('\n👋 Браузер закрыт');

            console.log('\n⏱️ СТАТИСТИКА РАБОТЫ:');
            console.log(`   Профиль ID: ${this.profileId}`);
            console.log(`   Выполнено нагульных запросов: ${this.completedWarmups}/${this.profileWarmupCount}`);
            console.log(`   Примерное время работы: ${Math.round(this.completedWarmups * 2)}-${Math.round(this.completedWarmups * 4)} минут`);
        }
    }

    async printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ПОИСКА');
        console.log('='.repeat(60));

        console.log(`\n📍 РЕГИОН ПОИСКА:`);
        console.log(`   Яндекс: ID ${this.yandexTarget?.regionId}`);
        console.log(`   Google: ID ${this.googleTarget?.regionId}`);
        if (this.gisTarget) {
            console.log(`   2GIS: ${this.gisTarget.url}`);
        }
        if (this.zoonTarget) {
            console.log(`   Zoon: ${this.zoonTarget.url}`);
        }

        console.log('\n🔵 РЕЗУЛЬТАТЫ ЯНДЕКС:');
        console.log('-'.repeat(30));
        if (this.results.yandex) {
            const r = this.results.yandex;
            if (r.found) {
                console.log(`✅ Клиника найдена!`);
                console.log(`📍 Позиция: ${r.position}`);
                console.log(`🏥 Название: ${r.clinicName}`);
                console.log(`📝 Полный заголовок: ${r.title}`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
            } else {
                console.log(`❌ Клиника не найдена`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
            }
        } else {
            console.log(`⚠️ Поиск в Яндекс не выполнен`);
        }

        console.log('\n🔴 РЕЗУЛЬТАТЫ GOOGLE:');
        console.log('-'.repeat(30));
        if (this.results.google) {
            const r = this.results.google;
            if (r.found) {
                console.log(`✅ Клиника найдена!`);
                console.log(`📍 Позиция: ${r.position}`);
                console.log(`🏥 Название: ${r.clinicName}`);
                console.log(`📝 Заголовок: ${r.title}`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
            } else {
                console.log(`❌ Клиника не найдена`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
            }
        } else {
            console.log(`⚠️ Поиск в Google не выполнен`);
        }

        console.log('\n🟢 РЕЗУЛЬТАТЫ 2GIS:');
        console.log('-'.repeat(30));
        if (this.results.gis) {
            const r = this.results.gis;
            if (r.success) {
                console.log(`✅ Данные собраны!`);
                console.log(`📄 Всего страниц: ${r.totalPages}`);
                console.log(`🏢 Всего организаций: ${r.totalOrganizations}`);
            } else {
                console.log(`❌ Ошибка при сборе данных`);
                console.log(`📄 Проверено страниц: ${r.totalPages}`);
                console.log(`🏢 Собрано организаций: ${r.totalOrganizations}`);
            }
        } else {
            console.log(`⚠️ Поиск в 2GIS не выполнен`);
        }

        console.log('\n🟡 РЕЗУЛЬТАТЫ ZOON:');
        console.log('-'.repeat(30));
        if (this.results.zoon) {
            const r = this.results.zoon;
            if (r.success) {
                console.log(`✅ Данные собраны!`);
                console.log(`📄 Всего страниц: ${r.totalPages}`);
                console.log(`🏢 Всего организаций: ${r.totalOrganizations}`);
                if (r.organizations && r.organizations.length > 0) {
                    console.log(`\n📋 Примеры найденных организаций:`);
                    for (let i = 0; i < Math.min(3, r.organizations.length); i++) {
                        const org = r.organizations[i];
                        console.log(`   ${i + 1}. ${org.title}`);
                        if (org.address) console.log(`      📍 ${org.address}`);
                        if (org.rating !== 'Нет рейтинга') console.log(`      ⭐ ${org.rating}`);
                    }
                }
            } else {
                console.log(`❌ Ошибка при сборе данных`);
                console.log(`📄 Проверено страниц: ${r.totalPages}`);
                console.log(`🏢 Собрано организаций: ${r.totalOrganizations}`);
            }
        } else {
            console.log(`⚠️ Поиск в Zoon не выполнен`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 УНИВЕРСАЛЬНЫЙ БОТ ЗАВЕРШИЛ РАБОТУ');
        console.log('='.repeat(60));

        const resultsFile = `search_results_${Date.now() + 3 * 60 * 60 * 1000}.json`;
        const resultsData = {
            timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            regions: {
                yandex: this?.yandexTarget?.regionId,
                google: this?.googleTarget?.regionId
            },
            query: {
                yandex: this.yandexTarget ? {
                    text: this.yandexTarget?.query,
                    city: this.yandexTarget?.city
                } : null,
                google: this.googleTarget ? {
                    text: this.googleTarget?.query,
                    city: this.googleTarget?.city
                } : null,
                gis: this.gisTarget ? {
                    url: this.gisTarget?.url,
                    query: this.gisTarget?.query
                } : null,
                zoon: this.zoonTarget ? {
                    url: this.zoonTarget?.url,
                    query: this.zoonTarget?.query
                } : null
            },
            results: {
                yandex: this.results?.yandex,
                google: this.results?.google,
                gis: this.results?.gis,
                zoon: this.results?.zoon
            }
        };

        fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
        console.log(`\n💾 Результаты сохранены в файл: ${resultsFile}`);
    }
}

const targetQuery = {
    yandexTarget: {
        query: 'лечение алкоголизма',
        city: 'новосибирск',
        regionId: 65
    },
    googleTarget: {
        query: 'лечение алкоголизма',
        city: 'новосибирск',
        regionId: 1011984
    },
    gisTarget: {
        url: 'https://2gis.ru/novosibirsk/',
        query: 'лечение алкоголизма',
    },
    zoonTarget: {
        url: 'https://zoon.ru/nsk/',
        query: 'лечение алкоголизма',
    },
};

(async () => {
    const bot = new UniversalSearchBot(targetQuery, 1);
    await bot.run();
})();