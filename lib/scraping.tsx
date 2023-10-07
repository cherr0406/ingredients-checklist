import puppeteer, { Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { TableProps } from "@/components/table";
const minimal_args = [
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-domain-reliability",
  "--disable-extensions",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-notifications",
  "--disable-offer-store-unmasked-wallet-cards",
  "--disable-popup-blocking",
  "--disable-print-preview",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disable-setuid-sandbox",
  "--disable-speech-api",
  "--disable-sync",
  "--hide-scrollbars",
  "--ignore-gpu-blacklist",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--no-pings",
  "--no-sandbox",
  "--no-zygote",
  "--password-store=basic",
  "--use-gl=swiftshader",
  "--use-mock-keychain",
];

const exePath =
  process.platform === "win32"
    ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "linux"
    ? "/usr/bin/google-chrome"
    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const isProd = process.env.VERCEL;

const getOption = async () => {
  console.log(isProd);
  let option = {};
  if (isProd) {
    option = {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    };
    if (chromium.headless == "new") {
      option = {
        headless: chromium.headless,
      };
    }
  } else {
    option = {
      args: minimal_args,
      executablePath: exePath,
      headless: "new",
    };
  }
  return option;
};

export async function scraping(url: string): Promise<TableProps[]> {
  console.log("url: ", url);

  const option = await getOption();
  const browser = await puppeteer.launch(option);

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
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
    console.log("domain: ", domain);

    let result: TableProps[] = [];
    switch (domain) {
      // リュウジのバズレシピ
      case "bazurecipe.com":
        result = await bazurecipe(page);
        break;

      // つくおき
      case "cookien.com":
        result = await cookien(page);
        break;

      // クックパッド
      // case "cookpad.com":
      // result = await cookpad(page);
      // break;

      default:
        throw new Error("対応していないWebサイトです。");
    }
    console.log("result: ", result);

    if (result.length === 0) {
      throw new Error("材料が取得できませんでした。");
    }

    return result;
  } catch (error) {
    let message = "エラーが発生しました。";
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
  const section = await page.waitForSelector("section.content");
  const parents = await section?.$$("div:not([class])");
  if (!parents) {
    return new Promise((rejects) => rejects([]));
  }
  let ingredientsTexts: string[] = [];
  for (const parent of parents) {
    if ((await parent.$$("xpath/" + ".//b[contains(text(), '材料')]")) !== null) {
      ingredientsTexts = (await page.evaluate((elm) => elm?.textContent ?? "", parent)).split("\n").slice(1);
      break;
    }
  }

  // 文字列操作
  // todo:"＝ソース＝"のような材料上の区切りがある場合に対応（現状はスキップしている）
  const result: TableProps[] = [];
  for (const ingredientsText of ingredientsTexts) {
    if (ingredientsText.indexOf("＝") !== -1) {
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
  // #copyIngredientBtn
  const copyBtn = await page.waitForSelector("#copyIngredientBtn");
  const ingredientsTexts = (await copyBtn?.evaluate((node) => node.getAttribute("data-text")))?.split("\n") ?? [];

  // 文字列操作
  const result: TableProps[] = [];
  for (let ingredientsText of ingredientsTexts) {
    // 全角スペースを半角スペースに変換
    while ((ingredientsText.match(/　/g) || []).length > 1) {
      ingredientsText = ingredientsText.replace("　", " ");
    }
    // ◎や◯を削除
    ingredientsText = ingredientsText.replace(/◎|◯/g, "");

    const [ingredient, amount] = ingredientsText.split("　").map((str) => str.trim());
    result.push({
      checked: false,
      ingredient: ingredient,
      amount: amount,
    });
  }

  return new Promise((resolve) => resolve(result));
}
