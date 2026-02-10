const { newInjectedPage } = require("fingerprint-injector");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const logFile = path.resolve(__dirname, 'logs/all.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function timestamp() {
    return new Date().toLocaleString();
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
        this.userAgent = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0';
        this.viewport = { width: 1366, height: 768 };

        this.yandexTarget = targetQuery.yandexTarget;

        this.googleTarget = targetQuery.googleTarget;

        this.gisTarget = targetQuery.gisTarget;

        this.randomQueryUrl = 'http://65.109.82.14/index_key_pull7.php?password=ololo&ip=65.109.49.112&pid=77777777';

        this.selectors = {
            yandex: {
                searchInput: '#text',
                searchResults: '.serp-item',
                mapBlock: 'li[data-fast-name="companies"]',
                companyCards: '.OrgmnMedicineCard',
                companyTitle: '.OrgmnMedicineCard-Title',
                companyAddress: '.OrgmnMedicineCard-Address',
                showMore: '.OrgmnMedicine-ListMore, button:has-text("Показать ещё")',
                externalLinks: '.serp-item a.Link',
                captcha: '.CheckboxCaptcha, .AdvancedCaptcha, .captcha, .Captcha, .smart-captcha'
            },
            google: {
                searchInput: 'textarea[name="q"], input[name="q"]',
                searchButton: 'button[type="submit"], input[type="submit"], .gNO89b',
                searchResults: '.g, .tF2Cxc, .MjjYud, .kvH3mc',
                placesBlock: '.QjCH7c, .VkpGBb, .Lv2Cle',
                placesTitle: '.OSrXXb, .dbg0pd',
                placesAddress: 'div:nth-child(3), .rllt__details > div:nth-child(3), .VkpGBb div:nth-child(3)',
                companyCards: '.VkpGBb, .w7Dbne, .rllt__details',
                companyTitle: '.OSrXXb, .dbg0pd',
                companyAddress: 'div:nth-of-type(3), .rllt__details > div:nth-child(3)',
                morePlacesButton: '.jRKCUd, .U48fD a',
                morePlacesCards: '.X3FFBc .w7Dbne, .VkpGBb',
                captcha: '#captcha-form, .g-recaptcha, iframe[src*="recaptcha"], .rc-anchor'
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
            }
        };

        this.profileWarmupCount = 1;
        this.completedWarmups = 0;

        this.results = {
            yandex: null,
            google: null
        };

        this.retryConfig = {
            maxAttempts: 3,
            baseDelay: 5000,
            maxDelay: 30000
        };

        this.browser = null;
        this.page = null;

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
            console.log(`📁 Создана директория для профилей: ${profilesDir}`);
        }
    }

    // Инициализация браузера
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
                `--window-size=1366,868`
            ],
            // executablePath: "C:/Users/qqwer/.cache/puppeteer/chrome/win64-127.0.6533.88/chrome-win64/chrome.exe",
            executablePath: "C:/Users/Egorio/.cache/puppeteer/chrome/win64-140.0.7339.207/chrome-win64/chrome.exe",
            ignoreHTTPSErrors: true
        });

        this.page = await newInjectedPage(this.browser, {
            fingerprintOptions: {
                devices: ["desktop"],
                operatingSystems: ["windows"],
            },
        });
        // this.page = await this.browser.newPage();

        // Скрываем WebDriver
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

        console.log('✅ Браузер готов');
        return true;
    }

    // Закрытие браузера
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

    // Функция для добавления/обновления параметра региона в URL
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

                    await this.delayByType('medium');
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

    // Получение случайного запроса
    async getRandomQuery() {
        try {
            const response = await axios.get(this.randomQueryUrl, { timeout: 5000 });
            return response.data.trim();
        } catch (error) {
            console.log('⚠️ Используем запасной запрос');
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

    // УВЕЛИЧЕННАЯ случайная задержка
    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Пауза: ${Math.round(delay / 1000)} сек.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    // Задержка по типу
    async delayByType(type = 'small') {
        const delayRange = this.delays[type] || this.delays.small;
        return await this.randomDelay(delayRange.min, delayRange.max);
    }

    // УВЕЛИЧЕННАЯ случайная прокрутка с паузой
    async randomScroll() {
        const scrollHeight = Math.floor(Math.random() * 800) + 400;
        console.log(`📜 Прокрутка: ${scrollHeight}px`);
        await this.page.evaluate((height) => {
            window.scrollBy(0, height);
        }, scrollHeight);

        // Пауза после прокрутки
        await this.delayByType('small');
    }

    // Проверка на капчу
    async checkForCaptcha(engine = 'yandex') {
        try {
            console.log(`🔍 Проверяем на наличие капчи (${engine})...`);

            const closeBtn = 'DistributionButtonClose';
            const elementbc = await this.page.$(closeBtn);
            if (elementbc) {
                await elementbc.click();
            }

            let selectors;
            if (engine === 'gis') {
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

            // Проверяем селекторы
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

            // Проверка по URL
            // const url = this.page.url().toLowerCase();
            // const captchaUrlPatterns = [
            //     'showcaptcha', 'checkcaptcha', 'recaptcha',
            //     'captcha', 'smartcaptcha', 'yandex.cloud/captcha',
            //     'captcha.yandex.net'
            // ];

            // for (const pattern of captchaUrlPatterns) {
            //     if (url.includes(pattern)) {
            //         console.log(`🔍 URL указывает на капчу: ${url.substring(0, 80)}...`);
            //         return true;
            //     }
            // }

            // Проверка по тексту на странице
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
                    // Проверяем, что это действительно капча, а не просто текст
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

    // Обработка капчи с попыткой клика по чекбоксу
    async handleCaptcha(engine = 'yandex') {
        console.log(`🔄 Обнаружена капча в ${engine}, пытаемся решить...`);

        try {
            // Пытаемся найти и кликнуть по чекбоксу капчи
            console.log('🖱️ Пытаемся кликнуть по чекбоксу капчи...');

            // СЕЛЕКТОРЫ ДЛЯ ЯНДЕКС ЧЕКБОКС-КАПЧИ
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

            // СЕЛЕКТОРЫ ДЛЯ GOOGLE RECAPTCHA
            const googleSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.g-recaptcha',
                'iframe[title*="reCAPTCHA" i]',
                'div.recaptcha-checkbox-checkmark',
                'span.recaptcha-checkbox'
            ];

            // СЕЛЕКТОРЫ ДЛЯ 2GIS
            const gisSelectors = [
                '#recaptcha-anchor',
                '.recaptcha-checkbox-border',
                '.g-recaptcha',
                'iframe[title*="reCAPTCHA" i]',
                'div.recaptcha-checkbox-checkmark',
                'span.recaptcha-checkbox'
            ];

            const selectors = engine === 'yandex' ? yandexSelectors :
                engine === 'google' ? googleSelectors :
                    gisSelectors;
            let captchaClicked = false;

            // Пробуем разные селекторы
            for (const selector of selectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log(`✅ Найден элемент капчи по селектору: ${selector}`);

                        // Для iframe в Google/2GIS
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
                            // Обычный клик
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

            // ПАУЗА после клика (ждем реакции капчи)
            console.log('⏳ Ждем реакцию капчи');
            await this.delayByType('large');

            // Проверяем, исчезла ли капча
            const captchaStillPresent = await this.checkForCaptcha(engine);

            if (!captchaStillPresent) {
                console.log(`🎉 Капча решена! Продолжаем работу...`);

                // Дополнительная пауза после успешного решения
                await this.delayByType('small');

                // ВАЖНОЕ ИЗМЕНЕНИЕ: Возвращаем true, но НЕ закрываем браузер
                // После успешного решения капчи вызывающий метод должен продолжить выполнение
                return true; // Капча решена, продолжаем

            } else {
                console.log(`❌ Капча не исчезла после клика, пробуем дополнительные действия...`);

                // Дополнительные попытки для Яндекс
                if (engine === 'yandex') {
                    // Пробуем кликнуть по лейблу "I'm not a robot"
                    try {
                        const labelElements = await this.page.$x('//span[contains(text(), "I\'m not a robot") or contains(text(), "я не робот")]');
                        if (labelElements.length > 0) {
                            await labelElements[0].click();
                            console.log('✅ Кликнули по тексту капчи');
                            await this.delayByType('medium');
                        }
                    } catch (error) {
                        // Игнорируем
                    }
                }

                // Снова проверяем
                const finalCheck = await this.checkForCaptcha(engine);
                if (!finalCheck) {
                    console.log('🎉 Капча решена после дополнительных действий!');
                    await this.delayByType('small');
                    return true; // Капча решена, продолжаем
                }

                console.log('🚫 Не удалось решить капчу...');

                // ВАЖНОЕ ИЗМЕНЕНИЕ: Решаем что делать в зависимости от движка
                if (engine === 'yandex' || engine === 'google') {
                    // Для Яндекс и Google: закрываем браузер и ждем перезапуска
                    console.log('🚪 Закрываем браузер из-за нерешенной капчи');
                    await this.closeBrowser();

                    // Длинная пауза перед перезапуском
                    const waitTime = 60000 + Math.random() * 180000; // 1-4 минуты
                    console.log(`⏸️ Длительная пауза: ${Math.round(waitTime / 60000)} мин. перед перезапуском...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));

                    return false; // Капча не решена, нужен перезапуск
                } else {
                    // Для 2GIS: просто возвращаем false, но не закрываем браузер
                    console.log('ℹ️ Для 2GIS продолжаем работу даже с нерешенной капчей');
                    return false; // Капча не решена, но продолжаем выполнение
                }
            }

        } catch (error) {
            console.log(`❌ Ошибка при обработке капчи: ${error.message}`);

            // ВАЖНОЕ ИЗМЕНЕНИЕ: Закрываем браузер только для Яндекс/Google
            if (engine === 'yandex' || engine === 'google') {
                console.log('🚪 Закрываем браузер из-за ошибки обработки капчи');
                await this.closeBrowser();

                const waitTime = 90000 + Math.random() * 180000; // 1.5-4.5 минуты
                console.log(`⏸️ Пауза: ${Math.round(waitTime / 60000)} мин. ${Math.round((waitTime % 60000) / 1000)} сек.`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                // Для 2GIS: просто логируем ошибку
                console.log('ℹ️ Для 2GIS продолжаем работу несмотря на ошибку капчи');
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
        await this.delayByType('xxlarge');
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
                await this.delayByType('large');

                // Вводим целевой запрос
                console.log('⌨️ Вводим целевой запрос...');
                await this.page.waitForSelector('#text', { timeout: 15000 });
                await this.page.type('#text', this.yandexTarget.query + ' ' + this.yandexTarget.city, { delay: 50 });

                // Пауза перед отправкой
                await this.delayByType('small');

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

                // Добавляем/проверяем параметр региона в URL
                console.log('🌍 Проверяем параметр региона в URL...');
                await this.addRegionToUrl('yandex');

                // Пауза перед анализом результатов
                await this.delayByType('medium');

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
        console.log('🔎 ПОИСК В GOOGLE');
        console.log(`📍 Регион ID: ${this.googleTarget.regionId}`);
        console.log('='.repeat(50));

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                // Инициализируем браузер для целевого поиска
                console.log(`🔄 Запускаем браузер для поиска в Google (попытка ${attempt}/${this.retryConfig.maxAttempts})...`);
                await this.init();

                console.log('🌐 Загружаем Google...');
                await this.page.goto('http://www.google.com/', {
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                if (await this.checkForCaptcha('google')) {
                    console.log(`🚫 Капча при загрузке 'google'`);
                    const captchaSolved = await this.handleCaptcha('google');

                    if (!captchaSolved) {
                        // Проверяем, не закрыл ли уже браузер handleCaptcha
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

                // Настраиваем заголовки для Google
                await this.page.setExtraHTTPHeaders({
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                });

                await this.delayByType('large');

                console.log('⌨️ Вводим целевой запрос в Google...');

                // Ждем и вводим запрос - несколько вариантов селекторов
                const inputSelectors = ['textarea[name="q"]', 'input[name="q"]', '.gLFyf'];
                let inputFound = false;

                for (const selector of inputSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        const inputElement = await this.page.$(selector);
                        if (inputElement) {
                            await inputElement.click({ clickCount: 3 });
                            await inputElement.type(this.googleTarget.query + ' loc:"' + this.googleTarget.city + '"', { delay: 50 });
                            inputFound = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!inputFound) {
                    console.log('❌ Не удалось найти поле поиска в Google');

                    // Закрываем браузер между попытками
                    await this.closeBrowser();

                    if (attempt < this.retryConfig.maxAttempts) {
                        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                        console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    continue;
                }

                await this.delayByType('small');

                // Нажимаем Enter для поиска
                await this.page.keyboard.press('Enter');

                console.log('⏳ Ждем результаты поиска в Google...');

                // Ждем загрузки результатов - несколько вариантов селекторов
                const resultsSelectors = [
                    '#search', // Основной блок поиска
                    '.g', // Классические результаты
                    '.tF2Cxc', // Современные результаты
                    '.MjjYud', // Другой вариант
                    'div[data-sokoban-container]' // Контейнер результатов
                ];

                let resultsLoaded = false;
                for (const selector of resultsSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 10000 });
                        console.log(`✅ Результаты загружены (селектор: ${selector})`);
                        resultsLoaded = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }

                if (!resultsLoaded) {
                    console.log('⚠️ Не удалось дождаться стандартных результатов, проверяем наличие контента...');
                    // Проверяем, есть ли хоть какой-то контент
                    const pageContent = await this.page.content();
                    if (!pageContent.includes('search') && !pageContent.includes('Search')) {
                        console.log('❌ Страница поиска не загрузилась');

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

                if (await this.checkForCaptcha('google')) {
                    console.log(`🚫 Капча при загрузке 'google'`);
                    const captchaSolved = await this.handleCaptcha('google');

                    if (!captchaSolved) {
                        // Проверяем, не закрыл ли уже браузер handleCaptcha
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

                // Добавляем/проверяем параметр региона в URL
                console.log('🌍 Проверяем параметр региона в URL...');
                await this.addRegionToUrl('google');

                await this.delayByType('large');

                console.log('✅ Целевой поиск в Google выполнен\n');

                // Поиск целевой клиники в Google
                console.log('🔍 Ищем клинику в Google...');
                const result = await this.findTargetClinicGoogle();
                this.results.google = result;

                // Закрываем браузер после успешного поиска
                await this.closeBrowser();

                return true;

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Google (попытка ${attempt}): ${error.message}`);

                // Закрываем браузер при ошибке
                await this.closeBrowser();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.log('❌ Поиск в Google не удался после всех попыток');
        return false;
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
                await this.delayByType('large');

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
                await this.delayByType('medium');

                // Вводим запрос в поисковую строку
                console.log(`⌨️ Вводим запрос в 2GIS: "${this.gisTarget.query}"`);

                // Кликаем на поисковую строку
                await searchInput.click({ clickCount: 3 });
                await this.delayByType('small');

                // Очищаем поле (если там что-то есть)
                await searchInput.press('Backspace');
                await this.delayByType('small');

                // Вводим запрос
                await searchInput.type(this.gisTarget.query, { delay: 50 });
                await this.delayByType('small');

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
                await this.delayByType('large');

                // Прокручиваем страницу для загрузки всех карточек
                console.log('📜 Прокручиваем страницу для загрузки всех результатов...');
                await this.randomScroll();
                await this.delayByType('medium');

                // Пробуем прокрутить еще раз
                await this.randomScroll();
                await this.delayByType('medium');

                console.log('✅ Целевой поиск в 2GIS выполнен\n');

                // Поиск целевой клиники в 2GIS
                console.log('🔍 Ищем клинику в результатах 2GIS...');
                const result = await this.findTargetClinic2GIS();
                this.results.gis = result;

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
        this.yandexTarget.clinicNames.forEach((name, i) => {
            console.log(`   ${i + 1}. "${name}"`);
        });

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
            await this.delayByType('medium');

            // Сначала пытаемся найти и нажать кнопку "Показать ещё"
            console.log('🔍 Ищем кнопку "Показать ещё"...');

            // Ждем немного для загрузки страницы
            await this.delayByType('medium');

            // Исправленная логика: работаем с одним элементом (singular)
            const showMoreXPath = '.OrgmnMedicine-ListMore';
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
                    await this.delayByType('small');

                    // Нажимаем кнопку
                    await showMoreElement.click();
                    showMoreClicked = true;

                    // Ждем загрузки дополнительных карточек
                    console.log('⏳ Ждем загрузки дополнительных карточек...');
                    await this.delayByType('large');

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
                    await this.page.waitForSelector('.OrgmnMedicineCard', { timeout: 20000 });
                    currentCards = await this.page.$$('.OrgmnMedicineCard');

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
            await this.delayByType('medium');

            // Проверяем все карточки БЕЗ ПАУЗ
            console.log('🔍 Проверяем карточки на наличие целевых клиник...');

            for (let i = 0; i < currentCards.length; i++) {
                try {
                    const card = currentCards[i];
                    totalChecked++;

                    // Получаем заголовок
                    const titleElement = await card.$('.OrgmnMedicineCard-Title');
                    const title = titleElement ?
                        await this.page.evaluate(el => el.textContent?.trim(), titleElement) : '';

                    const addressElement = await card.$('.OrgmnMedicineCard-Address');
                    const address = addressElement ?
                        await this.page.evaluate(el => el.textContent?.trim(), addressElement) : '';

                    // Проверяем совпадение со ВСЕМИ целевыми названиями
                    /*for (const clinicName of this.yandexTarget.clinicNames) {
                        if (title && title.toLowerCase().includes(clinicName.toLowerCase())) {*/
                    const foundClinic = {
                        position: i + 1,
                        //clinicName: clinicName,
                        fullTitle: title,
                        address: address,
                        cardIndex: i
                    };

                    foundClinics.push(foundClinic);
                    console.log(`\n🎯 НАЙДЕНО в Яндекс!`);
                    console.log(`   Позиция: ${foundClinic.position}`);
                    console.log(`   Клиника: ${foundClinic.clinicName}`);
                    console.log(`   Полный заголовок: ${foundClinic.fullTitle}`);
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

    // Поиск целевой клиники в Google
    async findTargetClinicGoogle() {
        console.log(`\n🔍 Ищем клинику в Google:`);
        this.googleTarget.clinicNames.forEach((name, i) => {
            console.log(`   ${i + 1}. "${name}"`);
        });

        let foundClinics = []; // Массив для найденных клиник
        let allOrganizations = []; // Массив для ВСЕХ организаций
        let totalCards = 0;
        let currentPage = 1;
        let hasMorePages = true;
        let globalPosition = 1;

        try {
            if (await this.checkForCaptcha('google')) {
                console.log('🚫 Капча перед поиском клиники');
                await this.handleCaptcha('google');
                return {
                    found: false,
                    //foundClinics: [],
                    totalChecked: 0
                };
            }

            await this.delayByType('medium');

            console.log('🔍 Ищем блок с картой/организациями...');

            // Пауза для загрузки контента
            //await this.delayByType('large');

            // 1. Пытаемся нажать кнопку "Ещё места" - СОХРАНЯЕМ ОРИГИНАЛЬНУЮ ЛОГИКУ
            console.log('\n🔄 Ищем и нажимаем кнопку "Ещё места"...');

            const morePlacesSelectors = [
                '.jRKCUd', // Кнопка в блоке мест
                '.U48fD a', // Контейнер с ссылкой
                '.ZFiwCf', // Внутренний контейнер кнопки
                '.LGwnxb' // Текст "Ещё места"
            ];

            const morePlacesXPaths = [
                '//a[contains(text(), "Ещё места")]',
                '//a[contains(text(), "Еще места")]'
            ];

            let moreButtonClicked = false;

            // Сначала пробуем стандартные селекторы
            for (const selector of morePlacesSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        console.log(`✅ Найдена кнопка "Ещё места" по селектору: ${selector}`);

                        // Нажимаем кнопку
                        await button.click();
                        moreButtonClicked = true;

                        // Ждем загрузки
                        await this.delayByType('large');
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Если не нашли стандартными селекторами, пробуем XPath
            if (!moreButtonClicked) {
                for (const xpath of morePlacesXPaths) {
                    try {
                        const buttons = await this.page.$x(xpath);
                        if (buttons.length > 0) {
                            console.log(`✅ Найдена кнопка "Ещё места" по XPath: ${xpath}`);

                            // Нажимаем кнопку
                            await buttons[0].click();
                            moreButtonClicked = true;

                            // Ждем загрузки
                            await this.delayByType('small');
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            if (!moreButtonClicked) {
                console.log('⚠️ Кнопка "Ещё места" не найдена или не нажата');
            }

            // Основной цикл по страницам
            while (hasMorePages) {
                console.log(`\n📄 Страница ${currentPage}:`);
                console.log('-'.repeat(30));

                // 2. Ищем карточки организаций - СОХРАНЯЕМ ОРИГИНАЛЬНУЮ ЛОГИКУ
                console.log('\n🔍 Ищем карточки организаций...');

                const cardSelectors = [
                    '.w7Dbne', // Основные карточки организаций
                    '.VkpGBb', // Контейнер карточек
                    '.rllt__details', // Детали карточки
                    '.OSrXXb', // Заголовки
                    '.dbg0pd', // Заголовки организаций
                    '[jscontroller="AtSb"]', // Контроллер карточки
                    '.cXedhc' // Контейнер карточки
                ];

                let allCards = [];

                // Собираем все карточки - СОХРАНЯЕМ ОРИГИНАЛЬНУЮ ЛОГИКУ
                for (const selector of cardSelectors) {
                    try {
                        const cards = await this.page.$$(selector);
                        if (cards.length > 0) {
                            for (let i = 0; i < cards.length; i++) {
                                try {
                                    const card = cards[i];
                                    const cardText = await this.page.evaluate(el => el.textContent || '', card);

                                    // Проверяем, похоже ли это на карточку организации
                                    //if (cardText.length > 50) {
                                    // Проверяем, не добавляли ли уже эту карточку
                                    const cardId = await this.page.evaluate(el => el.id || '', card);
                                    if (!allCards.some(c => c.id === cardId)) {
                                        allCards.push({
                                            element: card,
                                            id: cardId,
                                            text: cardText,
                                            page: currentPage,
                                            pagePosition: allCards.length + 1
                                        });
                                    }
                                    //}
                                } catch (e) {
                                    // Пропускаем ошибки
                                }
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                totalCards = allCards.length;
                console.log(`📋 Всего найдено карточек организаций на стр. ${currentPage}: ${totalCards}`);

                if (totalCards === 0) {
                    console.log('❌ Не найдено карточек организаций');
                    // Пробуем перейти на следующую страницу
                    hasMorePages = await this.goToNextPageGoogle(currentPage);
                    if (hasMorePages) {
                        currentPage++;
                        // await this.delayByType('large');
                        continue;
                    } else {
                        break;
                    }
                }

                // 3. Проверяем каждую карточку на наличие ВСЕХ целевых клиник БЕЗ ПАУЗ - СОХРАНЯЕМ ОРИГИНАЛЬНУЮ ЛОГИКУ
                console.log('\n🔍 Проверяем карточки на наличие целевых клиник...');

                for (let i = 0; i < totalCards; i++) {
                    try {
                        const card = allCards[i];

                        // Извлекаем заголовок для сохранения в allOrganizations
                        let title = '';
                        try {
                            // Пробуем получить название через селектор
                            const titleElement = await card.element.$('.dbg0pd .OSrXXb');
                            if (titleElement) {
                                title = await this.page.evaluate(el => el.textContent?.trim() || '', titleElement);
                            }
                        } catch (e) {
                            // Если не удалось через селектор, пробуем другой подход
                        }

                        // Если не нашли через селектор, пытаемся извлечь из текста карточки
                        if (!title) {
                            // Ищем текст до первого "·" или перевода строки
                            const titleMatch = card.text.match(/^[^·\n]+/);
                            if (titleMatch) {
                                title = titleMatch[0].trim();
                            } else {
                                // Берем первые 50 символов
                                title = card.text.substring(0, 50).trim();
                            }
                        }

                        // Извлекаем АДРЕС - он находится в строке с номером телефона
                        let address = '';
                        try {
                            // Адрес обычно находится в третьем div карточки
                            const divs = await card.element.$$('.rllt__details div');
                            if (divs.length >= 3) {
                                const possibleAddressDiv = divs[2];
                                const divText = await this.page.evaluate(el => el.textContent?.trim() || '', possibleAddressDiv);
                                console.log(divText);

                                // Разделяем адрес и телефон
                                const parts = divText.split('·');
                                if (parts.length >= 1) {
                                    address = parts[0].trim();
                                }
                            }
                        } catch (e) {
                            // Игнорируем ошибки
                        }

                        // Сохраняем все организации
                        const organization = {
                            globalPosition: globalPosition++,
                            page: currentPage,
                            pagePosition: card.pagePosition,
                            title: title || card.text.substring(0, 100).trim(),
                            address: address || 'Не указан',
                            timestamp: new Date().toISOString()
                        };

                        allOrganizations.push(organization);

                        // Логируем организацию
                        if (i < 5) {
                            console.log(`   [${i + 1}] ${organization.title.substring(0, 60)}...`);
                            console.log(`       Адрес: ${organization.address}`);
                        }

                    } catch (error) {
                        console.log(`   ⚠️ Ошибка при проверке карточки ${i + 1}: ${error.message}`);
                    }
                }

                console.log(`✅ Страница ${currentPage} обработана: ${totalCards} организаций`);

                // Пауза перед переходом на следующую страницу
                // await this.delayByType('medium');

                // 4. Пытаемся перейти на следующую страницу (НОВАЯ ФУНКЦИОНАЛЬНОСТЬ)
                console.log('🔍 Ищем кнопку перехода на следующую страницу...');
                hasMorePages = await this.goToNextPageGoogle(currentPage);

                if (hasMorePages) {
                    currentPage++;

                    // Защита от бесконечного цикла
                    if (currentPage > 20) {
                        console.log('⚠️ Достигнут лимит в 20 страниц, завершаем сбор');
                        break;
                    }

                    // Пауза после перехода
                    await this.delayByType('large');
                } else {
                    console.log(`🏁 Все страницы обработаны. Всего страниц: ${currentPage}`);
                }
            }

            // Сортируем найденные клиники по позиции
            //foundClinics.sort((a, b) => a.globalPosition - b.globalPosition);

            return {
                found: allOrganizations.length > 0,
                // foundClinics: foundClinics,
                totalChecked: totalCards, // Сохраняем оригинальное поле
                totalOrganizations: allOrganizations.length, // Новое поле
                totalPages: currentPage, // Новое поле
                allOrganizations: allOrganizations // Новое поле
            };

        } catch (error) {
            console.log(`❌ Ошибка при поиске клиники в Google: ${error.message}`);

            return {
                found: false,
                // foundClinics: [],
                totalChecked: totalCards,
                totalOrganizations: allOrganizations.length,
                totalPages: currentPage,
                allOrganizations: allOrganizations
            };
        }
    }

    // Метод для перехода на следующую страницу в Google
    async goToNextPageGoogle(currentPage) {
        try {
            console.log(`   🔄 Пытаемся перейти на страницу ${currentPage + 1}...`);

            // 1. Ищем блок навигации
            const navSelectors = [
                'div[role="navigation"]',
                'table.AaVjTc',
                'div#botstuff',
                'div#foot',
                'a#pnnext'
            ];

            let navigationBlock = null;

            for (const selector of navSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        navigationBlock = element;
                        console.log(`   ✅ Найден блок навигации: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!navigationBlock) {
                console.log('   ℹ️ Блок навигации не найден (возможно, последняя страница)');
                return false;
            }

            // 2. Ищем кнопку "Следующая" или стрелку
            const nextButtonSelectors = [
                'a#pnnext', // Основная кнопка "Следующая"
                'a[aria-label="Следующая"]',
                'a[aria-label*="Next"]',
                'a[aria-label*="Следующая"]',
                'g-fab', // Кнопка с иконкой
                'g-right-button', // Кнопка вправо
                'span.SJajHc[style*="-96px -112px"]', // Иконка стрелки
                //'td a', // Любая ссылка в таблице навигации
                //'a[href*="start="]' // Ссылка с параметром start (пагинация)
            ];

            let nextButton = null;

            for (const selector of nextButtonSelectors) {
                try {
                    const elements = await navigationBlock.$$(selector);
                    if (elements.length > 0) {
                        // Проверяем каждый элемент
                        for (const element of elements) {
                            try {
                                const href = await element.evaluate(el => el.getAttribute('href'));
                                const ariaLabel = await element.evaluate(el => el.getAttribute('aria-label') || '');
                                const text = await element.evaluate(el => el.textContent?.trim() || '');

                                // Проверяем, что это действительно кнопка "Следующая"
                                if ((href && href.includes('start=')) ||
                                    ariaLabel.includes('Следующая') ||
                                    ariaLabel.includes('Next') ||
                                    text.includes('>') ||
                                    selector === 'a#pnnext') {

                                    nextButton = element;
                                    console.log(`   ✅ Найдена кнопка перехода: ${selector}`);
                                    console.log(`      Href: ${href ? href.substring(0, 80) + '...' : 'нет'}`);
                                    console.log(`      Aria-label: ${ariaLabel}`);
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        if (nextButton) break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // 4. Кликаем на найденную кнопку
            if (nextButton) {
                console.log(`   🖱️ Кликаем на кнопку перехода...`);

                // Скроллим к элементу
                await nextButton.scrollIntoView();
                // await this.delayByType('small');

                // Получаем текущий URL для отладки
                const currentUrl = this.page.url();
                console.log(`   📍 Текущий URL: ${currentUrl.substring(0, 100)}...`);

                // Кликаем
                await nextButton.click();

                // Ждем загрузки новой страницы
                console.log(`   ⏳ Ждем загрузки страницы ${currentPage + 1}...`);
                await this.delayByType('small');

                // Проверяем, что URL изменился
                const newUrl = this.page.url();
                console.log(`   ✅ Перешли на: ${newUrl.substring(0, 100)}...`);

                // Сравниваем URL (должен быть другой параметр start=)
                if (currentUrl !== newUrl) {
                    console.log(`   🔄 URL изменился, переход успешен`);
                    return true;
                } else {
                    console.log(`   ⚠️ URL не изменился, возможно переход не сработал`);
                    return false;
                }
            } else {
                console.log(`   ❌ Не найдена кнопка для перехода на страницу ${currentPage + 1}`);
                console.log(`   ℹ️ Вероятно, страница ${currentPage} - последняя`);
                return false;
            }

        } catch (error) {
            console.log(`   ⚠️ Ошибка при переходе на следующую страницу: ${error.message}`);
            return false;
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
                await this.delayByType('medium');

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
                        await this.delayByType('large');
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
                            globalPosition: globalPosition++, // Уникальный номер во всей выдаче
                            page: currentPage,
                            pagePosition: i + 1, // Позиция на странице
                            title: title || 'Не указано',
                            address: address || 'Не указан',
                            timestamp: new Date().toISOString()
                        };

                        allOrganizations.push(organization);

                        // Логируем каждую организацию
                        console.log(`   ${organization.globalPosition}. ${organization.title}`);
                        if (address) console.log(`      📍 ${organization.address}`);

                    } catch (error) {
                        console.log(`   ⚠️ Ошибка при парсинге карточки ${i + 1}: ${error.message}`);

                        // Добавляем запись об ошибке
                        allOrganizations.push({
                            globalPosition: globalPosition++,
                            page: currentPage,
                            pagePosition: i + 1,
                            title: 'Ошибка парсинга',
                            address: 'Не удалось распарсить',
                            error: error.message,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                console.log(`✅ Страница ${currentPage} обработана: ${cards.length} организаций`);

                // ПАУЗА перед переходом на следующую страницу
                await this.delayByType('medium');

                // Пытаемся найти и нажать кнопку "следующая страница" через пагинацию
                console.log('🔍 Ищем кнопку перехода на следующую страницу...');
                hasMorePages = await this.goToNextPage2GIS(currentPage);

                if (hasMorePages) {
                    currentPage++;

                    // Дополнительная пауза после перехода
                    await this.delayByType('medium');
                } else {
                    console.log(`🏁 Все страницы обработаны. Всего страниц: ${currentPage}`);
                }

                // Защита от бесконечного цикла
                if (currentPage > 50) {
                    console.log('⚠️ Достигнут лимит в 50 страниц, завершаем сбор');
                    break;
                }
            }

            // Итоговая статистика
            console.log('\n' + '='.repeat(60));
            console.log('📊 СБОР ДАННЫХ ЗАВЕРШЕН');
            console.log('='.repeat(60));
            console.log(`📄 Всего страниц: ${currentPage}`);
            console.log(`🏢 Всего организаций: ${allOrganizations.length}`);
            console.log(`⏱️ Время сбора: ${new Date().toISOString()}`);

            return {
                success: true,
                totalPages: currentPage,
                totalOrganizations: allOrganizations.length,
                organizations: allOrganizations
            };

        } catch (error) {
            console.log(`❌ Критическая ошибка при сборе данных из 2GIS: ${error.message}`);

            return {
                success: false,
                error: error.message,
                totalPages: currentPage,
                totalOrganizations: allOrganizations.length,
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
            const activePageSelector = 'div._l934xo5 span._19xy60y'; // Активная страница (div, а не a)
            const activePageElement = await pagination.$(activePageSelector);
            let currentPageNumber = currentPage;

            if (activePageElement) {
                const activePageText = await this.page.evaluate(el => el.textContent?.trim(), activePageElement);
                currentPageNumber = parseInt(activePageText) || currentPage;
            }

            console.log(`   📍 Текущая страница в пагинации: ${currentPageNumber}`);

            // 3. Ищем ВСЕ ссылки/кнопки страниц
            const allPageLinks = await pagination.$$('a._12164l30'); // Все ссылки на страницы
            const allPageButtons = await pagination.$$('div._l934xo5, a._12164l30'); // Все элементы пагинации

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
                await this.delayByType('small');

                // Кликаем
                await nextPageElement.click();

                // Ждем загрузки новой страницы
                console.log(`   ⏳ Ждем загрузки страницы ${nextPageNumber}...`);
                await this.delayByType('large');

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

    // Вывод итоговых результатов
    async printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ПОИСКА');
        console.log('='.repeat(60));

        console.log(`\n📍 РЕГИОН ПОИСКА:`);
        console.log(`   Яндекс: ID ${this.yandexTarget.regionId}`);
        console.log(`   Google: ID ${this.googleTarget.regionId}`);
        if (this.gisTarget) {
            console.log(`   2GIS: ${this.gisTarget.url}`);
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
                console.log(`🔎 Искали клиники:`);
                this.yandexTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
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
                console.log(`🔎 Искали клиники:`);
                this.googleTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
            }
        } else {
            console.log(`⚠️ Поиск в Google не выполнен`);
        }

        console.log('\n🟢 РЕЗУЛЬТАТЫ 2GIS:');
        console.log('-'.repeat(30));
        if (this.results.gis) {
            const r = this.results.gis;
            if (r.found) {
                console.log(`✅ Найдено клиник: ${r.foundClinics.length}/${this.gisTarget.clinicNames.length}`);
                console.log(`📄 Проверено страниц: ${r.pagesChecked}`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);

                // Группируем по клиникам
                const clinicMap = {};
                r.foundClinics.forEach(clinic => {
                    if (!clinicMap[clinic.clinicName]) {
                        clinicMap[clinic.clinicName] = [];
                    }
                    clinicMap[clinic.clinicName].push(clinic);
                });

                // Выводим позиции для каждой клиники
                Object.keys(clinicMap).forEach(clinicName => {
                    console.log(`\n   🏥 ${clinicName}:`);
                    clinicMap[clinicName].forEach((clinic, index) => {
                        console.log(`      ${index + 1}. Позиция: ${clinic.position}`);
                        console.log(`         Название: ${clinic.fullTitle}`);
                        if (clinic.address) console.log(`         Адрес: ${clinic.address}`);
                    });
                });

                // Выводим ненайденные клиники
                if (r.notFound && r.notFound.length > 0) {
                    console.log(`\n   ⚠️ Не найдены:`);
                    r.notFound.forEach((clinicName, index) => {
                        console.log(`      ${index + 1}. "${clinicName}"`);
                    });
                }
            } else {
                console.log(`❌ Клиники не найдены`);
                console.log(`📄 Проверено страниц: ${r.pagesChecked}`);
                console.log(`🔍 Проверено карточек: ${r.totalChecked}`);
                console.log(`🔎 Искали клиники:`);
                this.gisTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
            }
        } else {
            console.log(`⚠️ Поиск в 2GIS не выполнен`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 УНИВЕРСАЛЬНЫЙ БОТ ЗАВЕРШИЛ РАБОТУ');
        console.log('='.repeat(60));

        // Сохраняем результаты в файл
        const resultsFile = `search_results_${Date.now()}.json`;
        const resultsData = {
            timestamp: new Date().toISOString(),
            profileId: this.profileId,
            warmupQueries: this.completedWarmups,
            regions: {
                yandex: this.yandexTarget.regionId,
                google: this.googleTarget.regionId
            },
            query: {
                yandex: {
                    text: this.yandexTarget.query,
                    city: this.yandexTarget.city
                },
                google: {
                    text: this.googleTarget.query,
                    city: this.googleTarget.city
                },
                gis: this.gisTarget ? {
                    url: this.gisTarget.url,
                    query: this.gisTarget.query
                } : null
            },
            // targetClinics: {
            //     yandex: this.yandexTarget.clinicNames,
            //     google: this.googleTarget.clinicNames,
            //     gis: this.gisTarget ? this.gisTarget.clinicNames : null
            // },
            results: {
                yandex: this.results.yandex,
                google: this.results.google,
                gis: this.results.gis
            }
        };

        fs.writeFileSync(resultsFile, JSON.stringify(resultsData, null, 2));
        console.log(`\n💾 Результаты сохранены в файл: ${resultsFile}`);
    }

    // Основной процесс
    async run() {
        try {
            console.log('='.repeat(60));
            console.log('🤖 УНИВЕРСАЛЬНЫЙ ПОИСКОВЫЙ БОТ');
            console.log(`👤 Профиль: ${this.profileId}`);
            console.log(`🔄 Один профиль для Яндекс, Google и 2GIS`);
            console.log(`⏱️ Ускоренный поиск карточек БЕЗ пауз`);
            console.log(`📋 Ищем позиции каждой карточки из clinicNames (только первая страница для 2GIS)`);
            console.log('='.repeat(60) + '\n');

            // Показываем информацию о целевых клиниках
            console.log('🎯 ЦЕЛЕВЫЕ КЛИНИКИ ДЛЯ ПОИСКА:');
            console.log('🔵 Яндекс:');
            this.yandexTarget.clinicNames.forEach((name, i) => {
                console.log(`   ${i + 1}. "${name}"`);
            });
            console.log('🔴 Google:');
            this.googleTarget.clinicNames.forEach((name, i) => {
                console.log(`   ${i + 1}. "${name}"`);
            });
            if (this.gisTarget) {
                console.log('🟢 2GIS:');
                this.gisTarget.clinicNames.forEach((name, i) => {
                    console.log(`   ${i + 1}. "${name}"`);
                });
            }
            console.log('');

            // Этап 1: Нагул профиля в Яндекс
            // console.log('1️⃣ ЭТАП: НАГУЛ ПРОФИЛЯ В ЯНДЕКС');
            // console.log('-'.repeat(40));
            // await this.warmUpProfile();

            // Этап 2: Поиск в Яндекс с ретраями (браузер закрывается между попытками)
            console.log('\n2️⃣ ЭТАП: ПОИСК В ЯНДЕКС');
            console.log('-'.repeat(40));
            await this.searchYandex();

            // Этап 3: Поиск в Google с ретраями (браузер закрывается между попытками)
            console.log('\n3️⃣ ЭТАП: ПОИСК В GOOGLE');
            console.log('-'.repeat(40));
            await this.searchGoogle();

            // Этап 4: Поиск в 2GIS с ретраями (браузер закрывается между попытками)
            if (this.gisTarget) {
                console.log('\n4️⃣ ЭТАП: ПОИСК В 2GIS');
                console.log('-'.repeat(40));
                await this.search2GIS();
            }

            // Вывод результатов
            await this.printResults();

        } catch (error) {
            console.error(`\n💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
            console.error(error.stack);
        } finally {
            // Убедимся, что браузер закрыт
            await this.closeBrowser();
            console.log('\n👋 Браузер закрыт');

            console.log('\n⏱️ СТАТИСТИКА РАБОТЫ:');
            console.log(`   Профиль ID: ${this.profileId}`);
            console.log(`   Выполнено нагульных запросов: ${this.completedWarmups}/${this.profileWarmupCount}`);
            console.log(`   Примерное время работы: ${Math.round(this.completedWarmups * 2)}-${Math.round(this.completedWarmups * 4)} минут`);
        }
    }
}

const targetQuery = {
    yandexTarget: {
        query: 'кодирование',
        city: 'ростов',
        clinicNames: [
            'Клиника Доктора Калюжной',
            'Частная скорая помощь № 1'
        ],
        regionId: 39
    },
    googleTarget: {
        query: 'кодирование',
        city: 'ростов',
        clinicNames: [
            'Клиника доктора Калюжной',
            'Частная скорая помощь № 1'
        ],
        regionId: 1012013
    },
    gisTarget: {
        url: 'https://2gis.ru/rostov-on-don/',
        query: 'кодирование',
        clinicNames: [
            'Клиника доктора Калюжной',
            'Частная скорая помощь № 1'
        ]
    }
};

(async () => {
    const bot = new UniversalSearchBot(targetQuery, 1);
    await bot.run();
})();