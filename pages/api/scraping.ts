// pages/api/scraping.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { load } from 'cheerio';
import { scrapeRecipe } from '@/lib/scraping';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyRecipeBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    });

    const $ = load(response.data);
    let ingredients = await scrapeRecipe(url);
    return res.status(200).json(ingredients);
  } catch (error) {
    // if ERR_BAD_REQUEST
    if (axios.isAxiosError(error) && error.response && error.response.status === 403) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    console.error('Error:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
