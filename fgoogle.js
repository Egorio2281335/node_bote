const { connect } = require('puppeteer-real-browser');
const path = require('path');

const RESIDENTIAL_PROXY = {
    host: "109.237.107.159",
    port: 24837,
    username: "Q6BYZyRCSl",
    password: "7Oi42UJcbe",
};

class GoogleRealBrowser {
    constructor(options = {}) {
        this.profilePath = options.profilePath;
        this.userAgent = options.userAgent;
        this.viewport = options.viewport || { width: 430, height: 932 };
        this.regionId = options.regionId;
        this.query = options.query;
        this.city = options.city;
        this.browser = null;
        this.page = null;

        this.retryConfig = {
            maxAttempts: 3,
            baseDelay: 5000,
            maxDelay: 30000
        };
    }

    async init() {
        console.log('🚀 Инициализация GoogleRealBrowser...');
        console.log(`📂 Профиль: ${this.profilePath}`);

        try {
            const args = [
                /*'--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                `--user-agent=${this.userAgent}`,
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-notifications',
                `--lang=ru-RU,ru`,*/
                `--window-size=${this.viewport.width},${this.viewport.height + 100}`,
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=ru-RU',
                //'--start-maximized',
            ];

            if (this.profilePath) {
                //args.push(`--user-data-dir=${this.profilePath}`);
            }

            const { browser, page } = await connect({
                headless: false,
                args: args,
                turnstile: true,
                proxy: {
                    host: RESIDENTIAL_PROXY.host,
                    port: parseInt(RESIDENTIAL_PROXY.port),
                    username: RESIDENTIAL_PROXY.username,
                    password: RESIDENTIAL_PROXY.password,
                },
                customConfig: {},
            });

            this.browser = browser;
            this.page = page;

            await this.page.setViewport(this.viewport);
            // await this.page.setExtraHTTPHeaders({
            //     'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            //     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            //     'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            //     'sec-ch-ua-mobile': '?0',
            //     'sec-ch-ua-platform': '"Windows"'
            // });
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            });

            console.log('✅ GoogleRealBrowser готов');
            return true;
        } catch (error) {
            console.error(`❌ Ошибка инициализации GoogleRealBrowser: ${error.message}`);
            return false;
        }
    }

    async close() {
        if (this.browser) {
            try {
                if (this.page && !this.page.isClosed()) {
                    try {
                        await this.page.close();
                    } catch (e) {
                        
                    }
                }
                
                await this.browser.close().catch(error => {
                    console.warn('⚠️ Ошибка при закрытии браузера (можно игнорировать):', error.message);
                });
                
                console.log('✅ GoogleRealBrowser закрыт');
                this.browser = null;
                this.page = null;
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.warn('⚠️ Не критичная ошибка при закрытии браузера:', error.message);
                this.browser = null;
                this.page = null;
            }
        }
    }

    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Пауза Google: ${Math.round(delay / 1000)} сек.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return delay;
    }

    async searchGoogle() {
        console.log('\n' + '='.repeat(50));
        console.log('🔎 GOOGLE REAL BROWSER');
        console.log(`📍 Регион ID: ${this.regionId}`);
        console.log(`🔍 Запрос: ${this.query} "${this.city}"`);
        console.log('='.repeat(50));

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                console.log(`🔄 Попытка ${attempt}/${this.retryConfig.maxAttempts}...`);

                const initSuccess = await this.init();
                if (!initSuccess) {
                    throw new Error('Не удалось инициализировать браузер');
                }

                console.log('🌐 Загружаем Google...');
                await this.page.goto('https://www.google.com/', {
                    waitUntil: 'networkidle2',
                    timeout: 90000
                });

                //await this.randomDelay(2000, 4000);

                console.log('⌨️ Вводим целевой запрос в Google...');

                const inputSelectors = ['textarea[name="q"]', 'input[name="q"]', '.gLFyf'];
                let inputFound = false;

                for (const selector of inputSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 10000 });
                        const inputElement = await this.page.$(selector);
                        if (inputElement) {
                            await inputElement.click({ clickCount: 3 });
                            await inputElement.type(this.query + ' loc:"' + this.city + '"', { delay: 100 });
                            inputFound = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!inputFound) {
                    throw new Error('Не удалось найти поле поиска в Google');
                }

                //await this.randomDelay(1000, 2000);

                await this.page.keyboard.press('Enter');

                console.log('⏳ Ждем результаты поиска...');
                await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

                console.log('✅ Поиск в Google выполнен');

                return {
                    success: true,
                    page: this.page,
                    browser: this.browser
                };

            } catch (error) {
                console.log(`❌ Ошибка при поиске в Google (попытка ${attempt}): ${error.message}`);

                await this.close();

                if (attempt < this.retryConfig.maxAttempts) {
                    const delay = Math.min(
                        this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
                        this.retryConfig.maxDelay
                    );
                    console.log(`⏸️ Пауза перед повторной попыткой: ${Math.round(delay / 1000)} сек.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.log('❌ Поиск в Google не удался после всех попыток');
                    return { success: false, error: error.message };
                }
            }
        }

        return { success: false, error: 'Все попытки исчерпаны' };
    }

    async addRegionToUrl() {
        try {
            const currentUrl = this.page.url();
            const urlObj = new URL(currentUrl);
            const targetRegion = this.regionId.toString();
            const currentRegion = urlObj.searchParams.get('loc');

            if (currentRegion !== targetRegion) {
                urlObj.searchParams.set('loc', targetRegion);
                console.log(`🌍 Устанавливаем регион Google: ${targetRegion}`);

                await this.page.goto(urlObj.toString(), {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                //await this.randomDelay(2000, 4000);
                return true;
            } else {
                console.log(`✅ Регион Google уже установлен: ${currentRegion}`);
                return false;
            }
        } catch (error) {
            console.log(`⚠️ Ошибка при установке региона: ${error.message}`);
            return false;
        }
    }

    async goToNextPageGoogle(currentPage) {
        try {
            if (!this.browser || !this.browser.page) {
                return false;
            }

            console.log(`   🔄 Пытаемся перейти на страницу ${currentPage + 1}...`);

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

            const nextButtonSelectors = [
                'a#pnnext',
                'a[aria-label="Следующая"]',
                'a[aria-label*="Next"]',
                'a[aria-label*="Следующая"]',
                'g-fab',
                'g-right-button',
                'span.SJajHc[style*="-96px -112px"]',
            ];

            let nextButton = null;

            for (const selector of nextButtonSelectors) {
                try {
                    const elements = await navigationBlock.$$(selector);
                    if (elements.length > 0) {
                        for (const element of elements) {
                            try {
                                const href = await this.page.evaluate(
                                    el => el.getAttribute('href'), 
                                    element
                                );
                                const ariaLabel = await this.page.evaluate(
                                    el => el.getAttribute('aria-label') || '', 
                                    element
                                );
                                const text = await this.page.evaluate(
                                    el => el.textContent?.trim() || '', 
                                    element
                                );

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

            if (nextButton) {
                console.log(`   🖱️ Кликаем на кнопку перехода...`);

                await this.page.scrollIntoView(nextButton);

                const currentUrl = this.page.url();
                console.log(`   📍 Текущий URL: ${currentUrl.substring(0, 100)}...`);

                await nextButton.click();

                console.log(`   ⏳ Ждем загрузки страницы ${currentPage + 1}...`);
                //await this.delayByType('small');

                const newUrl = this.page.url();
                console.log(`   ✅ Перешли на: ${newUrl.substring(0, 100)}...`);

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

    async collectAllOrganizations() {
        console.log(`\n🔍 Ищем клинику в Google:`);

        let allOrganizations = [];
        let totalCards = 0;
        let currentPage = 1;
        let hasMorePages = true;
        let globalPosition = 1;

        try {
            if (!this.browser || !this.page) {
                throw new Error('Google браузер не инициализирован');
            }

            console.log('🔍 Ищем блок с картой/организациями...');

            console.log('\n🔄 Ищем и нажимаем кнопку "Ещё места"...');

            const morePlacesSelectors = [
                '.iNTie a',
                '.ZFiwCf',
                '.LGwnxb'
            ];

            let moreButtonClicked = false;

            for (const selector of morePlacesSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        console.log(`✅ Найдена кнопка "Ещё места" по селектору: ${selector}`);

                        await button.click();
                        moreButtonClicked = true;

                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!moreButtonClicked) {
                console.log('⚠️ Кнопка "Ещё места" не найдена или не нажата');
            }

            while (hasMorePages) {
                console.log(`\n📄 Страница ${currentPage}:`);
                console.log('-'.repeat(30));

                console.log('\n🔍 Ищем карточки организаций...');

                const cardSelectors = [
                    '.w7Dbne',
                    '.VkpGBb',
                    '.rllt__details',
                    '.OSrXXb',
                    '.dbg0pd',
                    '[jscontroller="AtSb"]',
                    '.cXedhc'
                ];

                let allCards = [];

                for (const selector of cardSelectors) {
                    try {
                        await this.page.waitForSelector(selector, {
                            timeout: 10000
                        });
                        const cards = await this.page.$$(selector);
                        if (cards.length > 0) {
                            for (let i = 0; i < cards.length; i++) {
                                try {
                                    const card = cards[i];
                                    const cardText = await this.page.evaluate(el => el.textContent || '', card);

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
                                } catch (e) {
                                    
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
                            //globalPosition: globalPosition++,
                            //page: currentPage,
                            //pagePosition: card.pagePosition,
                            title: title || card.text.substring(0, 100).trim(),
                            address: address || 'Не указан',
                            //timestamp: new Date().toISOString()
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
                    // await this.delayByType('large');
                } else {
                    console.log(`🏁 Все страницы обработаны. Всего страниц: ${currentPage}`);
                }
            }

            // Сортируем найденные клиники по позиции
            //foundClinics.sort((a, b) => a.globalPosition - b.globalPosition);

            return {
                found: allOrganizations.length > 0,
                // foundClinics: foundClinics,
                //totalChecked: totalCards, // Сохраняем оригинальное поле
                //totalOrganizations: allOrganizations.length, // Новое поле
                //totalPages: currentPage, // Новое поле
                allOrganizations: allOrganizations // Новое поле
            };

        } catch (error) {
            console.log(`❌ Ошибка при поиске клиники в Google: ${error.message}`);

            return {
                found: false,
                // foundClinics: [],
                //totalChecked: totalCards,
                //totalOrganizations: allOrganizations.length,
                //totalPages: currentPage,
                allOrganizations: allOrganizations
            };
        }
    }

    // Метод для перехода на следующую страницу
    async goToNextPage(currentPage) {
        try {
            if (!this.browser || !this.browser.page) {
                return false;
            }

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
                                // const href = await element.evaluate(el => el.getAttribute('href'));
                                // const ariaLabel = await element.evaluate(el => el.getAttribute('aria-label') || '');
                                // const text = await element.evaluate(el => el.textContent?.trim() || '');
                                const href = await this.page.evaluate(
                                    el => el.getAttribute('href'), 
                                    element
                                );
                                const ariaLabel = await this.page.evaluate(
                                    el => el.getAttribute('aria-label') || '', 
                                    element
                                );
                                const text = await this.page.evaluate(
                                    el => el.textContent?.trim() || '', 
                                    element
                                );

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
                //await nextButton.scrollIntoView();
                await this.page.scrollIntoView(nextButton);
                // await this.delayByType('small');

                // Получаем текущий URL для отладки
                const currentUrl = this.page.url();
                console.log(`   📍 Текущий URL: ${currentUrl.substring(0, 100)}...`);

                // Кликаем
                await nextButton.click();

                // Ждем загрузки новой страницы
                console.log(`   ⏳ Ждем загрузки страницы ${currentPage + 1}...`);
                // await this.delayByType('small');

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

    async runFullSearchAndParse() {
        console.log('\n' + '='.repeat(50));
        console.log('🚀 ЗАПУСК ПОЛНОГО ЦИКЛА GOOGLE REAL BROWSER');
        console.log('='.repeat(50));

        try {
            // Шаг 1: Выполняем поиск
            const searchResult = await this.searchGoogle();
            
            if (!searchResult.success) {
                throw new Error('Поиск не удался: ' + (searchResult.error || 'неизвестная ошибка'));
            }

            // Шаг 2: Собираем данные
            console.log('\n📊 Начинаем сбор данных с результатов поиска...');
            const parsedData = await this.collectAllOrganizations();

            // Шаг 3: Закрываем браузер
            await this.close();

            console.log('\n✅ Полный цикл Google Real Browser завершён успешно!');
            return parsedData;

        } catch (error) {
            console.error('\n❌ Ошибка в runFullSearchAndParse:', error.message);
            
            // В любом случае пытаемся закрыть браузер
            try {
                await this.close();
            } catch (closeError) {
                // Игнорируем ошибку закрытия
            }
            
            throw error;
        }
    }

    async getPageContent() {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.content();
    }

    async url() {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.url();
    }

    async click(selector) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.click(selector);
    }

    async $(selector) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.$(selector);
    }

    async $$(selector) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.$$(selector);
    }

    async $x(selector) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.$x(selector);
    }

    async evaluate(pageFunction, ...args) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.evaluate(pageFunction, ...args);
    }

    async scrollIntoView(element) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.evaluate((el) => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, element);
    }

    async evaluateOnElement(element, pageFunction, ...args) {
        if (!this.page || !element) {
            throw new Error('Страница или элемент не инициализированы');
        }
        return await this.page.evaluate((el, fn, ...params) => {
            return eval(`(${fn})(el, ...params)`);
        }, element, pageFunction.toString(), ...args);
    }

    async getElementText(element) {
        if (!element) return '';
        return await this.evaluate(el => el.textContent?.trim() || '', element);
    }

    async getElementAttribute(element, attribute) {
        if (!element) return null;
        return await this.evaluate((el, attr) => el.getAttribute(attr), element, attribute);
    }

    async waitForSelector(selector, options = {}) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.waitForSelector(selector, options);
    }

    async waitForNavigation(options = {}) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.waitForNavigation(options);
    }

    async type(selector, text, options = {}) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        const element = await this.$(selector);
        if (element) {
            await element.type(text, options);
        }
    }

    async press(key, options = {}) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        await this.page.keyboard.press(key, options);
    }

    async goto(url, options = {}) {
        if (!this.page) {
            throw new Error('Страница не инициализирована');
        }
        return await this.page.goto(url, options);
    }
}

module.exports = GoogleRealBrowser;