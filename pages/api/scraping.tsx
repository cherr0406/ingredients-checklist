import chromium from '@sparticuz/chromium';
import puppeteer, { Page } from 'puppeteer-core';
import { TableProps } from '@/components/table';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const props = await scraping(url.toString());
    return res.status(200).json(props);
  } catch (error) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    return res.status(500).json({ error: message });
  }
}

export async function scraping(url: string): Promise<TableProps[]> {
  const minimal_args = [
    '--autoplay-policy=user-gesture-required',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-popup-blocking',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-setuid-sandbox',
    '--disable-speech-api',
    '--disable-sync',
    '--hide-scrollbars',
    '--ignore-gpu-blacklist',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--no-pings',
    '--no-sandbox',
    '--no-zygote',
    '--password-store=basic',
    '--use-gl=swiftshader',
    '--use-mock-keychain',
  ];

  const exePath =
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'linux'
      ? '/usr/bin/google-chrome'
      : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const isProd = process.env.NEXT_PUBLIC_VERCEL;

  const getOption = async () => {
    let option = {};
    if (isProd) {
      option = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
      if (chromium.headless == 'new') {
        option = {
          ...option,
          headless: chromium.headless,
        };
      }
    } else {
      option = {
        args: minimal_args,
        executablePath: exePath,
        headless: 'new',
      };
    }
    return option;
  };

  const option = await getOption();
  const browser = await puppeteer.launch(option);

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (url === request.url()) {
        request.continue().catch((err) => console.error(err));
      } else {
        request.abort().catch((err) => console.error(err));
      }
    });
    page.setDefaultNavigationTimeout(0);
    await page.goto(url);

    // ドメインからレシピサイトを判定
    const domain = new URL(url).hostname;
    console.log('domain: ', domain);

    let result: TableProps[] = [];
    switch (domain) {
      // リュウジのバズレシピ
      case 'bazurecipe.com':
        result = await bazurecipe(page);
        break;

      // つくおき
      case 'cookien.com':
        result = await cookien(page);
        break;

      // DELISH KITCHEN
      case 'delishkitchen.tv':
        result = await delishkitchen(page);
        break;

      // クックパッド
      // case "cookpad.com":
      // result = await cookpad(page);
      // break;

      default:
        throw new Error('対応していないWebサイトです。');
    }

    if (result.length === 0) {
      throw new Error('材料が取得できませんでした。');
    }

    return result;
  } catch (error) {
    let message = 'エラーが発生しました。';
    if (error instanceof Error) {
      message = error.message;
    }
    console.log(error);
    throw new Error(message);
  } finally {
    await browser.close();
  }
}

// リュウジのバズレシピ
async function bazurecipe(page: Page): Promise<TableProps[]> {
  // #top > div.l-wrapper > main > div > div.postContents > section > div:nth-child(5)
  const section = await page.waitForSelector('section.content');
  const parents = await section?.$$('div:not([class])');
  if (!parents) {
    return new Promise((rejects) => rejects([]));
  }
  let ingredientsTexts: string[] = [];
  for (const parent of parents) {
    // Error: Query set to use "xpath", but no query handler of that name was found が発生する
    if ((await parent.$$('xpath/' + ".//b[contains(text(), '材料')]")) !== null) {
      ingredientsTexts = (await page.evaluate((elm) => elm?.textContent ?? '', parent))
        .split('\n')
        .slice(1);
      break;
    }
  }

  // 文字列操作
  // todo:"＝ソース＝"のような材料上の区切りがある場合に対応（現状はスキップしている）
  const result: TableProps[] = [];
  for (const ingredientsText of ingredientsTexts) {
    if (ingredientsText.indexOf('＝') !== -1) {
      continue;
    }
    const [ingredient, amount] = ingredientsText.split(/…+/).map((str) => str.trim());
    result.push({
      checked: false,
      ingredient: ingredient,
      amount: amount,
    });
  }

  return new Promise((resolve) => resolve(result));
}

// つくおき
async function cookien(page: Page): Promise<TableProps[]> {
  // #r_contents > p, #r_contents > p > span
  // <p>豚もも薄切り肉<span>約２００ｇ（８～１０枚）</span></p>
  // -> 豚もも薄切り肉 と 約２００ｇ（８～１０枚） をそれぞれ取得
  const rContents = await page.waitForSelector('#r_contents');
  const ingredientsElems = await rContents?.$$('p');
  if (!ingredientsElems) {
    return new Promise((rejects) => rejects([]));
  }
  const result: TableProps[] = [];
  for (const ingredientsElem of ingredientsElems) {
    const text: string =
      (await (await ingredientsElem.getProperty('textContent'))?.jsonValue()) ?? '';
    const amount: string =
      (await (await (await ingredientsElem.$('span'))?.getProperty('textContent'))?.jsonValue()) ??
      '';
    // text - amount で材料名を取得
    // ◯,◎を消去
    // （メモ1）,（メモ2）,...を消去
    const ingredient = text
      .replace(new RegExp('(.*)' + amount), '$1')
      .replace(new RegExp('◯|◎', 'g'), '')
      .replace(/（メモ.*）/g, '');
    result.push({
      checked: false,
      ingredient: ingredient,
      amount: amount,
    });
  }

  return new Promise((resolve) => resolve(result));
}

// DELISH KITCHEN
async function delishkitchen(page: Page): Promise<TableProps[]> {
  // ul.ingredient-list > li
  // <li class="ingredient" data-v-ae6b758c="">
  //  <a href="..." class="ingredient-name" data-v-ae6b758c=""> ピーマン </a>
  //  <span class="ingredient-serving" data-v-ae6b758c="">2個</span>
  // </li>
  const ingredientList = await page.waitForSelector('ul.ingredient-list');
  const ingredientsElems = await ingredientList?.$$('li');
  if (!ingredientsElems) {
    return new Promise((rejects) => rejects([]));
  }
  const result: TableProps[] = [];
  for (const ingredientsElem of ingredientsElems) {
    const ingredient: string =
      (await (
        await (await ingredientsElem.$('.ingredient-name'))?.getProperty('textContent')
      )?.jsonValue()) ?? '';
    const amount: string =
      (await (
        await (await ingredientsElem.$('.ingredient-serving'))?.getProperty('textContent')
      )?.jsonValue()) ?? '';
    if (ingredient && amount) {
      result.push({
        checked: false,
        ingredient: ingredient,
        amount: amount,
      });
    }
  }

  return new Promise((resolve) => resolve(result));
}
