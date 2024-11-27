import axios from 'axios';
import { load, CheerioAPI } from 'cheerio';
import { TableProps } from '@/components/table';
import type { NextApiRequest, NextApiResponse } from 'next';

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
  const isProd = process.env.NEXT_PUBLIC_VERCEL;

  try {
    // User-Agentを設定
    const response = await axios.get(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000, // 5秒でタイムアウト
    });

    const $ = load(response.data);

    // ドメインからレシピサイトを判定
    const domain = new URL(url).hostname;
    console.log('domain: ', domain);

    let result: TableProps[] = [];
    switch (domain) {
      case 'bazurecipe.com':
        result = await bazurecipe($);
        break;

      // つくおき
      case 'cookien.com':
        result = await cookien($);
        break;

      // DELISH KITCHEN
      case 'delishkitchen.tv':
        result = await delishkitchen($);
        break;

      // クックパッド
      case 'cookpad.com':
        result = await cookpad($);
        break;

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
    console.error(error);
    throw new Error(message);
  }
}

// リュウジのバズレシピ
async function bazurecipe($: CheerioAPI): Promise<TableProps[]> {
  // section.content > div:not([class]) > (text)
  // <div style="background: #f4f4f4; padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px; word-break: break-all;"><b>【材料】</b><br>
  // キャベツ…1／2玉<br>
  // ジャガイモ…300g<br>
  // ☆味変で粉チーズ</div>
  const result: TableProps[] = [];
  const ingredientsText = $('section.content > div:not([class])').text();

  if (!ingredientsText.includes('材料')) {
    return [];
  }

  const lines = ingredientsText.split('\n').slice(1);
  for (const line of lines) {
    if (line.includes('＝')) continue;

    const [ingredient, amount] = line.split(/…+/).map((str) => str.trim().replace(/[◯◎]/g, ''));

    if (ingredient && amount) {
      result.push({
        checked: false,
        ingredient,
        amount,
      });
    }
  }

  return result;
}

// つくおき
function cookien($: CheerioAPI): TableProps[] {
  // #r_contents > p, #r_contents > p > span
  // <p>豚もも薄切り肉<span>約２００ｇ（８～１０枚）</span></p>
  // -> 豚もも薄切り肉 と 約２００ｇ（８～１０枚） をそれぞれ取得
  const result: TableProps[] = [];

  try {
    $('#r_contents > p').each((_, elem) => {
      const text = $(elem).text();
      const amount = $(elem).find('span').text();
      // text - amount で材料名を取得
      // ◯,◎を消去
      // （メモ1）,（メモ2）,...を消去
      const ingredient = text
        .replace(amount, '')
        .replace(/[◯◎]/g, '')
        .replace(/（メモ.*）/g, '')
        .trim();

      if (ingredient && amount) {
        result.push({
          checked: false,
          ingredient,
          amount,
        });
      }
    });

    return result;
  } catch (error) {
    console.error('Error in cookien function:', error);
    return [];
  }
}

// DELISH KITCHEN
async function delishkitchen($: CheerioAPI): Promise<TableProps[]> {
  // ul.ingredient-list > li
  // <li class="ingredient" data-v-ae6b758c="">
  //  <a href="..." class="ingredient-name" data-v-ae6b758c=""> ピーマン </a>
  //  <span class="ingredient-serving" data-v-ae6b758c="">2個</span>
  // </li>
  const result: TableProps[] = [];

  $('ul.ingredient-list > li').each((_, elem) => {
    const ingredient = $(elem).find('.ingredient-name').text().trim();
    const amount = $(elem).find('.ingredient-serving').text().trim();

    if (ingredient && amount) {
      result.push({
        checked: false,
        ingredient,
        amount,
      });
    }
  });

  return result;
}

// クックパッド
async function cookpad($: CheerioAPI): Promise<TableProps[]> {
  // #ingredients > div.ingredient-list > ol
  // <li id="ingredient_135664599" class="justified-quantity-and-name overflow-wrap-anywhere not-headline">
  //   <span>鶏もも肉</span> <bdi class="font-semibold">1枚（300g）</bdi>
  // </li>
  // <li id="ingredient_135664603" class="justified-quantity-and-name overflow-wrap-anywhere font-semibold headline">
  //   <span>【調味料】･･･★は先に混ぜておく</span> <bdi class="font-semibold"></bdi>
  // </li>
  const result: TableProps[] = [];

  $('#ingredients > div.ingredient-list > ol > li').each((_, elem) => {
    console.log('elem:', elem);
    // headlineクラスを持つ要素は材料名ではないのでスキップ
    if ($(elem).hasClass('headline')) {
      return;
    }
    const ingredient_raw = $(elem).find('span').text().trim();
    console.log('ingredient_raw:', ingredient_raw);
    // ◯,◎,☆,★を削除
    const ingredient = ingredient_raw.replace(/[☆★◯◎]/g, '');
    const amount = $(elem).find('bdi').text().trim();

    if (ingredient && amount) {
      result.push({
        checked: false,
        ingredient,
        amount,
      });
    }
  });

  return result;
}
