/**
 * Structured Data & XML Extraction Service
 * Extracts metadata from HTML (Open Graph, JSON-LD, microdata) and parses XML sitemaps/RSS feeds
 */

import { JSDOM } from 'jsdom';
import axios from 'axios';

export interface StructuredMetadata {
  title: string | null;
  description: string | null;
  ogSiteName: string | null;
  ogImage: string | null;
  jsonLd: any[];
  externalLinks: string[];
  brandMentions: string[];
}

export interface XmlData {
  sitemapUrls: string[];
  rssFeedItems: Array<{ title: string; link: string; pubDate: string }>;
  otherXmlLinks: string[];
}

export async function extractStructuredData(html: string, url: string): Promise<StructuredMetadata> {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const metadata: StructuredMetadata = {
      title: doc.querySelector('title')?.textContent || null,
      description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      ogSiteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null,
      ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
      jsonLd: [],
      externalLinks: [],
      brandMentions: [],
    };

    // Extract JSON-LD
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        metadata.jsonLd.push(parsed);
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    // Extract external links (limit to first 20)
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const linkHrefs = links.map((a) => a.getAttribute('href')).filter(Boolean) as string[];
    const uniqueLinks = Array.from(new Set(linkHrefs));
    metadata.externalLinks = uniqueLinks.slice(0, 20);

    // Simple brand mentions
    const bodyText = doc.body?.innerText || '';
    const brands = ['paypal', 'amazon', 'apple', 'microsoft', 'google', 'facebook', 'lidl', 'aldi'];
    metadata.brandMentions = brands.filter((brand) => bodyText.toLowerCase().includes(brand));

    return metadata;
  } catch (error) {
    console.error('[StructuredData] Extraction failed:', error);
    return {
      title: null,
      description: null,
      ogSiteName: null,
      ogImage: null,
      jsonLd: [],
      externalLinks: [],
      brandMentions: [],
    };
  }
}

export async function extractXmlData(baseUrl: string): Promise<XmlData> {
  const xmlData: XmlData = { sitemapUrls: [], rssFeedItems: [], otherXmlLinks: [] };
  const commonPaths = ['/sitemap.xml', '/sitemap_index.xml', '/rss.xml', '/feed.xml', '/atom.xml'];

  for (const path of commonPaths) {
    try {
      const fullUrl = new URL(path, baseUrl).toString();
      const response = await axios.get(fullUrl, {
        timeout: 5000,
        headers: { Accept: 'application/xml,text/xml' },
      });

      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('xml') || response.data.trim().startsWith('<?xml')) {
        const xmlString = response.data;

        // Parse sitemap: extract <loc> tags
        const locMatches = xmlString.match(/<loc>(.*?)<\/loc>/g);
        if (locMatches) {
          const urls = locMatches.map((m: string) => m.replace(/<\/?loc>/g, '').trim());
          xmlData.sitemapUrls.push(...urls.slice(0, 100)); // limit
        }

        // Parse RSS: extract <item><title>,<link>,<pubDate>
        const itemMatches = xmlString.match(/<item>[\s\S]*?<\/item>/g);
        if (itemMatches) {
          for (const item of itemMatches.slice(0, 20)) {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            if (link) {
              xmlData.rssFeedItems.push({ title, link, pubDate });
            }
          }
        }
      }
    } catch (err) {
      // Ignore 404 or fetch errors
      console.debug(`[StructuredData] XML fetch failed for ${baseUrl}${path}:`, (err as Error).message);
    }
  }

  return xmlData;
}
