// lib/scraping.ts
import axios from 'axios';
import { load, CheerioAPI } from 'cheerio';
import { TableProps } from '@/components/table';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.google.com/',
  DNT: '1',
  Connection: 'keep-alive',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * HTTPリクエストを送信してレスポンスデータを取得
 */
async function getResponseData(url: string): Promise<any> {
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    return Array.isArray(response.data) ? response.data[0] : response.data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw new Error('データの取得に失敗しました');
  }
}

async function scrapeBazurecipe(html: string): Promise<TableProps[]> {
  const $ = load(html);
  const result: TableProps[] = [];
  const ingredientsText = $('div').text();

  if (!ingredientsText.includes('材料')) {
    return [];
  }

  const lines = ingredientsText.split('\n').slice(1);
  for (const line of lines) {
    if (line.includes('＝')) continue;
    const [ingredient, amount] = line.split(/…+/).map((str) => str.trim().replace(/[◯◎]/g, ''));
    if (ingredient && amount) {
      result.push({ checked: false, ingredient, amount });
    }
  }

  return result;
}

function scrapeCookien($: CheerioAPI): TableProps[] {
  const result: TableProps[] = [];
  $('#r_contents > p').each((_, elem) => {
    const text = $(elem).text();
    const amount = $(elem).find('span').text();
    const ingredient = text
      .replace(amount, '')
      .replace(/[◯◎]/g, '')
      .replace(/（メモ.*）/g, '')
      .trim();
    if (ingredient && amount) {
      result.push({ checked: false, ingredient, amount });
    }
  });
  return result;
}

function scrapeDelishkitchen($: CheerioAPI): TableProps[] {
  const result: TableProps[] = [];
  $('ul.ingredient-list > li').each((_, elem) => {
    const ingredient = $(elem).find('.ingredient-name').text().trim();
    const amount = $(elem).find('.ingredient-serving').text().trim();
    if (ingredient && amount) {
      result.push({ checked: false, ingredient, amount });
    }
  });
  return result;
}

function scrapeCookpad($: CheerioAPI): TableProps[] {
  const result: TableProps[] = [];
  $('#ingredients > div.ingredient-list > ol > li').each((_, elem) => {
    if ($(elem).hasClass('headline')) return;
    const ingredient_raw = $(elem).find('span').text().trim();
    const ingredient = ingredient_raw.replace(/[☆★◯◎]/g, '');
    const amount = $(elem).find('bdi').text().trim();
    if (ingredient && amount) {
      result.push({ checked: false, ingredient, amount });
    }
  });
  return result;
}

export async function scrapeRecipe(url: string): Promise<TableProps[]> {
  try {
    const domain = new URL(url).hostname;
    let data: string;
    let result: TableProps[] = [];

    switch (domain) {
      case 'bazurecipe.com':
        const slug = url.split('/').filter(Boolean).pop();
        const apiUrl = `https://bazurecipe.com/wp-json/wp/v2/posts?slug=${slug}`;
        try {
          const post = await getResponseData(apiUrl);
          result = await scrapeBazurecipe(post.content.rendered);
        } catch (error) {
          // API取得失敗時は直接HTMLをスクレイピング
          console.error('Falling back to direct HTML scraping for bazurecipe');
          data = (await getResponseData(url)).toString();
          result = await scrapeBazurecipe(data);
        }
        break;

      case 'cookien.com':
        data = (await getResponseData(url)).toString();
        result = scrapeCookien(load(data));
        break;

      case 'delishkitchen.tv':
        data = (await getResponseData(url)).toString();
        result = scrapeDelishkitchen(load(data));
        break;

      case 'cookpad.com':
        data = (await getResponseData(url)).toString();
        result = scrapeCookpad(load(data));
        break;

      default:
        throw new Error('対応していないWebサイトです');
    }

    if (result.length === 0) {
      throw new Error('材料が取得できませんでした');
    }

    return result;
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error instanceof Error ? error : new Error('予期せぬエラーが発生しました');
  }
}
