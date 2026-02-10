const { connect } = require('puppeteer-real-browser');
// import 'dotenv/config';

const RESIDENTIAL_PROXY = {
  host: '109.237.107.159',     
  port: '24837',
  username: 'Q6BYZyRCSl',
  password: '7Oi42UJcbe',
};

(async () => {
  try {
    const { browser, page } = await connect({
      headless: false,             
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=ru-RU',
        '--start-maximized',
      ],
      turnstile: true,     
    //   proxy: {
    //     host: RESIDENTIAL_PROXY.host,
    //     port: parseInt(RESIDENTIAL_PROXY.port),
    //     username: RESIDENTIAL_PROXY.username,
    //     password: RESIDENTIAL_PROXY.password,
    //   },
      customConfig: {},            
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    console.log('Браузер запущен с residential proxy');

    await page.goto('https://accounts.google.com', {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });
  } catch (err) {
    console.error('Ошибка:', err.message);
  }
})();
