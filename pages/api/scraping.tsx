import { scraping } from "../../lib/scraping";
import { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    const props = await scraping(url.toString());
    return res.status(200).json(props);
  } catch (error) {
    console.error(error);
    return res.status(500);
  }
}
