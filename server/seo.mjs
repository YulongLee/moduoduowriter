import { createHash } from 'node:crypto';

// Use a fixed origin rather than request headers for all public search URLs.
export const siteOrigin = 'https://moduoduowriter.com';
export const siteName = '墨多多';
export const defaultTitle = '墨多多写作｜AI小说写作、小说大纲与人物设定';
export const defaultDescription = '墨多多是一款AI小说创作与内容编辑工具，支持故事灵感、小说大纲、人物设定、章节续写与文字润色，帮助创作者从想法逐步完成作品。';
export const publicPaths = Object.freeze([
  '/',
  '/features/ai-novel-writing/',
  '/features/novel-outline/',
  '/features/character-design/',
  '/features/text-polish/',
  '/guides/getting-started/',
  '/about/',
]);

const allowedPaths = new Set(publicPaths);
const websiteId = `${siteOrigin}/#website`;
const organizationId = `${siteOrigin}/#organization`;
const applicationId = `${siteOrigin}/#application`;
const shareImage = `${siteOrigin}/og-image.png`;
const shareImageAlt = '墨多多写作：AI小说创作与内容编辑，故事灵感、小说大纲、人物设定与文字润色';

function canonicalUrl(path) {
  if (typeof path !== 'string' || !allowedPaths.has(path)) {
    throw new TypeError('SEO metadata is only available for an exact public canonical path.');
  }
  return `${siteOrigin}${path}`;
}

function readableText(value, fallback, limit) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') throw new TypeError('SEO text must be a string.');
  const result = value.replace(/\s+/gu, ' ').trim();
  if (!result || result.length > limit) throw new TypeError('SEO text is empty or too long.');
  return result;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeJson(value) {
  // A JSON string containing </script> must never end its HTML script element.
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function breadcrumbData(path, title, breadcrumbs) {
  const items = breadcrumbs === undefined
    ? [{ name: '首页', path: '/' }, { name: title, path }]
    : breadcrumbs;
  if (!Array.isArray(items) || items.length < 2 || items.length > 8) {
    throw new TypeError('Public page breadcrumbs require between two and eight items.');
  }
  const list = items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError('Invalid breadcrumb item.');
    return {
      '@type': 'ListItem',
      position: index + 1,
      name: readableText(item.name, undefined, 200),
      item: canonicalUrl(item.path),
    };
  });
  if (list[0].item !== `${siteOrigin}/` || list.at(-1).item !== canonicalUrl(path)) {
    throw new TypeError('Breadcrumbs must run from the public home page to the current page.');
  }
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl(path)}#breadcrumbs`,
    itemListElement: list,
  };
}

function structuredData({ path, title, description, kind, breadcrumbs }) {
  const url = canonicalUrl(path);
  const page = {
    '@type': kind === 'about' ? 'AboutPage' : 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
  };
  if (path !== '/') {
    const breadcrumb = breadcrumbData(path, title, breadcrumbs);
    page.breadcrumb = { '@id': breadcrumb['@id'] };
    return { '@context': 'https://schema.org', '@graph': [page, breadcrumb] };
  }
  page.mainEntity = { '@id': applicationId };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: siteName,
        alternateName: '墨多多写作',
        url: `${siteOrigin}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${siteOrigin}/brand-mark.png`,
          contentUrl: `${siteOrigin}/brand-mark.png`,
          width: 144,
          height: 144,
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: siteName,
        alternateName: '墨多多写作',
        url: `${siteOrigin}/`,
        inLanguage: 'zh-CN',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'WebApplication',
        '@id': applicationId,
        name: '墨多多写作',
        url: `${siteOrigin}/`,
        description: defaultDescription,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: 'zh-CN',
        publisher: { '@id': organizationId },
        featureList: ['AI小说写作', '故事灵感生成', '小说大纲规划', '人物设定', '章节续写', '文字润色'],
      },
      page,
    ],
  };
}

/**
 * Render metadata only for an explicit public path. Private/unknown routes must
 * be handled separately by the HTTP layer with noindex and no public canonical.
 * Breadcrumb items use the shape { name, path }; paths must be in publicPaths.
 */
export function renderSeoHead({ path = '/', title, description, kind = 'page', breadcrumbs } = {}) {
  const url = canonicalUrl(path);
  const pageTitle = readableText(title, defaultTitle, 500);
  const pageDescription = readableText(description, defaultDescription, 2000);
  const data = structuredData({ path, title: pageTitle, description: pageDescription, kind, breadcrumbs });
  const text = escapeHtml(pageTitle);
  const summary = escapeHtml(pageDescription);
  return [
    `<title>${text}</title>`,
    `<meta name="description" content="${summary}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="zh_CN">',
    `<meta property="og:site_name" content="${siteName}">`,
    `<meta property="og:title" content="${text}">`,
    `<meta property="og:description" content="${summary}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${shareImage}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${shareImageAlt}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${text}">`,
    `<meta name="twitter:description" content="${summary}">`,
    `<meta name="twitter:image" content="${shareImage}">`,
    `<meta name="twitter:image:alt" content="${shareImageAlt}">`,
    `<script id="mdd-seo-schema" type="application/ld+json">${safeJson(data)}</script>`,
  ].join('\n');
}

/** Exact quoted sources to append to CSP script-src without unsafe-inline. */
export function seoScriptHashes(head) {
  if (typeof head !== 'string') throw new TypeError('SEO head must be a string.');
  const scriptPattern = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  return [...head.matchAll(scriptPattern)].map(([, content]) =>
    `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`,
  );
}
