import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  defaultDescription, defaultTitle, publicPaths, renderSeoHead, seoScriptHashes, siteName, siteOrigin,
} from '../server/seo.mjs';
import { seoPages } from '../src/seo-content.mjs';

// Pure local metadata/asset checks: no accounts, network, browser or providers.
const expectedPaths = [
  '/',
  '/features/ai-novel-writing/',
  '/features/novel-outline/',
  '/features/character-design/',
  '/features/text-polish/',
  '/guides/getting-started/',
  '/about/',
];
const descriptors = [
  { path: '/', title: defaultTitle, description: defaultDescription },
  ...seoPages.map(page => ({ ...page, kind: page.path === '/about/' ? 'about' : 'page' })),
];
const entityDecode = value => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
})[entity]);
const normalize = value => value.replace(/\s+/gu, ' ').trim();

function oneMatch(pattern, head, label) {
  const values = [...head.matchAll(pattern)];
  assert.equal(values.length, 1, `Exactly one ${label} is emitted`);
  return values[0][1];
}

function meta(head, name, attribute = 'name') {
  return entityDecode(oneMatch(
    new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`, 'g'), head, `${name} meta tag`,
  ));
}

function parseHead(head) {
  const title = entityDecode(oneMatch(/<title>([^<]*)<\/title>/g, head, 'title'));
  const canonical = oneMatch(/<link rel="canonical" href="([^"]*)">/g, head, 'canonical');
  const json = oneMatch(/<script id="mdd-seo-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/g, head, 'JSON-LD block');
  assert.equal((head.match(/<script\b/gi) || []).length, 1, 'Metadata has one inert JSON-LD block and no executable script');
  return { title, canonical, json, schema: JSON.parse(json) };
}

function walkSchema(value, visit) {
  if (value && typeof value === 'object') {
    visit(value);
    for (const child of Object.values(value)) walkSchema(child, visit);
  }
}

const forbiddenFields = new Set([
  'offers', 'price', 'priceCurrency', 'aggregateRating', 'ratingValue', 'ratingCount',
  'reviewCount', 'review', 'downloadCount', 'interactionStatistic',
]);
const forbiddenTypes = new Set(['FAQPage', 'HowTo', 'AggregateRating', 'Review', 'Offer', 'SearchAction']);
assert.equal(siteOrigin, 'https://moduoduowriter.com');
assert.equal(siteName, '墨多多');
assert.deepEqual(publicPaths, expectedPaths, 'The metadata allowlist contains the seven authored public pages');
assert.deepEqual(descriptors.map(page => page.path).sort(), [...expectedPaths].sort(), 'All authored pages are represented exactly once');
assert.equal(new Set(descriptors.map(page => normalize(page.title))).size, 7, 'Each page has a distinct title');
assert.equal(new Set(descriptors.map(page => normalize(page.description))).size, 7, 'Each page has a distinct description');

const canonicals = new Set();
const cspHashes = new Set();
for (const descriptor of descriptors) {
  const { path } = descriptor;
  const head = renderSeoHead(descriptor);
  const { title, canonical, json, schema } = parseHead(head);
  const url = new URL(canonical);
  assert.equal(title, normalize(descriptor.title));
  assert.equal(meta(head, 'description'), normalize(descriptor.description));
  assert.equal(canonical, `${siteOrigin}${path}`);
  assert.equal(url.origin, siteOrigin);
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  canonicals.add(canonical);
  assert.match(meta(head, 'robots'), /(?:^|,)index(?:,|$)/);
  assert.ok(!meta(head, 'robots').includes('noindex'));
  assert.equal(meta(head, 'og:title', 'property'), title);
  assert.equal(meta(head, 'og:description', 'property'), normalize(descriptor.description));
  assert.equal(meta(head, 'og:url', 'property'), canonical);
  assert.equal(meta(head, 'og:site_name', 'property'), siteName);
  assert.equal(meta(head, 'og:locale', 'property'), 'zh_CN');
  assert.equal(meta(head, 'og:image', 'property'), `${siteOrigin}/og-image.png`);
  assert.equal(meta(head, 'og:image:width', 'property'), '1200');
  assert.equal(meta(head, 'og:image:height', 'property'), '630');
  assert.equal(meta(head, 'og:image:type', 'property'), 'image/png');
  assert.match(meta(head, 'og:image:alt', 'property'), /墨多多/);
  assert.equal(meta(head, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(head, 'twitter:image'), meta(head, 'og:image', 'property'));
  assert.equal(meta(head, 'twitter:title'), title);
  assert.equal(meta(head, 'twitter:description'), normalize(descriptor.description));
  assert.equal(schema['@context'], 'https://schema.org');
  assert.ok(Array.isArray(schema['@graph']));
  assert.equal(new Set(schema['@graph'].map(item => item['@id'])).size, schema['@graph'].length, 'Graph IDs are unique within a page');
  walkSchema(schema, node => {
    for (const field of Object.keys(node)) assert.ok(!forbiddenFields.has(field), `Do not fabricate commercial/rating data: ${field}`);
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    for (const type of types) assert.ok(!forbiddenTypes.has(type), `Unsupported rich-result claims must be absent: ${type}`);
  });
  const webpage = schema['@graph'].find(item => ['WebPage', 'AboutPage'].includes(item['@type']));
  assert.ok(webpage, 'Every public page identifies the actual web document');
  assert.equal(webpage['@id'], `${canonical}#webpage`);
  assert.equal(webpage.url, canonical);
  assert.equal(webpage.name, title);
  assert.equal(webpage.description, normalize(descriptor.description));
  assert.equal(webpage.inLanguage, 'zh-CN');
  assert.equal(webpage.isPartOf['@id'], `${siteOrigin}/#website`);
  if (path === '/') {
    const organization = schema['@graph'].find(item => item['@type'] === 'Organization');
    const website = schema['@graph'].find(item => item['@type'] === 'WebSite');
    const application = schema['@graph'].find(item => item['@type'] === 'WebApplication');
    assert.ok(organization && website && application, 'Home describes the brand, website and real web application');
    assert.equal(organization.name, '墨多多');
    assert.equal(organization.alternateName, '墨多多写作');
    assert.equal(organization.url, `${siteOrigin}/`);
    assert.equal(organization.logo.url, `${siteOrigin}/brand-mark.png`);
    assert.equal(organization.logo.width, 144);
    assert.equal(organization.logo.height, 144);
    assert.ok(!organization.legalName && !organization.address, 'Do not invent a registered corporate entity or office');
    assert.equal(website.name, siteName);
    assert.equal(website.url, canonical);
    assert.equal(website.publisher['@id'], organization['@id']);
    assert.equal(application.name, '墨多多写作');
    assert.equal(application.operatingSystem, 'Web');
    assert.equal(application.applicationCategory, 'ProductivityApplication');
    assert.equal(application.url, canonical);
    for (const feature of ['AI小说写作', '小说大纲规划', '人物设定', '章节续写', '文字润色']) {
      assert.ok(application.featureList.includes(feature), `The application describes its actual writing feature: ${feature}`);
    }
    assert.ok(application.featureList.every(feature => !/视频|微信登录|无限|保证|爆款/.test(feature)), 'Do not advertise postponed features or unsubstantiated promises');
    assert.equal(webpage.mainEntity['@id'], application['@id']);
    assert.ok(!schema['@graph'].some(item => item['@type'] === 'BreadcrumbList'));
  } else {
    assert.ok(!schema['@graph'].some(item => ['Organization', 'WebSite', 'WebApplication'].includes(item['@type'])), 'Content pages describe their own document instead of re-declaring the application');
    const breadcrumb = schema['@graph'].find(item => item['@type'] === 'BreadcrumbList');
    assert.equal(webpage.breadcrumb['@id'], breadcrumb['@id']);
    assert.equal(breadcrumb.itemListElement[0].item, `${siteOrigin}/`);
    assert.equal(breadcrumb.itemListElement.at(-1).item, canonical);
    breadcrumb.itemListElement.forEach((item, index) => {
      assert.equal(item.position, index + 1);
      assert.ok(publicPaths.some(knownPath => item.item === `${siteOrigin}${knownPath}`));
      assert.equal(typeof item.name, 'string');
      assert.ok(item.name.length > 0);
    });
    assert.equal(webpage['@type'], path === '/about/' ? 'AboutPage' : 'WebPage');
  }
  const expectedHash = `'sha256-${createHash('sha256').update(json, 'utf8').digest('base64')}'`;
  assert.deepEqual(seoScriptHashes(head), [expectedHash], 'CSP hash covers the exact emitted UTF-8 script body');
  cspHashes.add(expectedHash);
  const modifiedHead = head.replace(json, `${json}\n`);
  assert.notDeepEqual(seoScriptHashes(modifiedHead), [expectedHash], 'A whitespace change in the script body invalidates the old CSP hash');
}
assert.equal(canonicals.size, 7, 'Seven pages have seven unique canonical URLs');
assert.equal(cspHashes.size, 7, 'CSP is derived for each distinct page, not reused globally');
console.log('PASS seven authored pages: unique titles/descriptions/canonicals, sharing metadata, factual schema and exact CSP hashes');

for (const path of [
  'https://evil.example/', '//evil.example/', 'http://moduoduowriter.com/',
  `${siteOrigin}/`, `${siteOrigin}/about/`, '/admin/', '/works/', '/api/auth/status',
  '/unknown/', '/#home', '/?q=novel', '/about/#section', '/about/?utm_source=test',
  '/features/ai-novel-writing', '/ABOUT/', '/%61bout/', '/./about/',
  '/features/../about/', '/about//', '/about/\n', null, 42,
]) {
  assert.throws(() => renderSeoHead({ path }), TypeError, `Reject a non-canonical or non-public path: ${String(path)}`);
}
for (const breadcrumbs of [
  [], [{ name: '首页', path: '/' }],
  [{ name: '首页', path: '/' }, { name: '后台', path: '/admin/' }],
  [{ name: '首页', path: '/' }, { name: '外部', path: 'https://evil.example/' }],
  [{ name: '首页', path: '/' }, { name: '片段', path: '/about/#x' }],
  [{ name: '首页', path: '/' }, { name: '查询', path: '/about/?x=1' }],
  [{ name: '首页', path: '/' }, { name: '错误终点', path: '/features/text-polish/' }],
  [{ name: '错误起点', path: '/features/text-polish/' }, { name: '关于', path: '/about/' }],
  [{ name: '首页', path: '/' }, { path: '/about/' }],
  [{ name: '首页', path: '/' }, null],
]) {
  assert.throws(() => renderSeoHead({ path: '/about/', breadcrumbs }), TypeError, 'Breadcrumbs cannot introduce private, external, missing or malformed page references');
}
for (const field of ['title', 'description']) {
  for (const value of [null, 42, '', '   ']) {
    assert.throws(() => renderSeoHead({ [field]: value }), TypeError, `${field} requires meaningful text`);
  }
}
assert.throws(() => renderSeoHead({ title: 'x'.repeat(501) }), TypeError);
assert.throws(() => renderSeoHead({ description: 'x'.repeat(2001) }), TypeError);
assert.deepEqual(seoScriptHashes(''), []);
assert.throws(() => seoScriptHashes(null), TypeError);
console.log('PASS public-path allowlist, canonical URL boundaries, breadcrumb validation and malformed metadata rejection');

const hostile = `</title></script><script>alert("x")</script><img src=x onerror='x'>& \u2028 \u2029`;
const safeHead = renderSeoHead({
  path: '/about/', title: hostile, description: hostile,
  breadcrumbs: [{ name: '首页', path: '/' }, { name: hostile, path: '/about/' }],
});
const safeParsed = parseHead(safeHead);
assert.equal(safeParsed.title, normalize(hostile));
assert.equal(meta(safeHead, 'description'), normalize(hostile));
assert.equal(meta(safeHead, 'og:title', 'property'), normalize(hostile));
assert.equal(meta(safeHead, 'og:description', 'property'), normalize(hostile));
assert.equal(meta(safeHead, 'twitter:title'), normalize(hostile));
assert.equal(meta(safeHead, 'twitter:description'), normalize(hostile));
assert.ok(!safeHead.includes('<img') && !safeHead.includes('<script>alert'));
assert.ok(safeHead.includes('&lt;/title&gt;') && safeHead.includes('&quot;') && safeHead.includes('&#39;') && safeHead.includes('&amp;'));
assert.ok(!/[<>&\u2028\u2029]/u.test(safeParsed.json), 'JSON-LD encodes HTML delimiters and Unicode script separators');
assert.ok(safeParsed.json.includes('\\u003c/script\\u003e'), 'A closing script token remains JSON text');
assert.equal(safeParsed.schema['@graph'][0].name, normalize(hostile));
assert.equal(safeParsed.schema['@graph'][0].description, normalize(hostile));
assert.equal(safeParsed.schema['@graph'][1].itemListElement.at(-1).name, normalize(hostile));
assert.equal(meta(safeHead, 'robots'), meta(renderSeoHead(), 'robots'), 'Injected text cannot change indexing policy');
console.log('PASS HTML title/attribute escaping and JSON-LD closing-script injection cannot create executable markup');

async function pngSize(relativePath) {
  const bytes = await readFile(new URL(relativePath, import.meta.url));
  assert.ok(bytes.length > 24);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `${relativePath} is a real PNG`);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
assert.deepEqual(await pngSize('../public/og-image.png'), [1200, 630]);
assert.deepEqual(await pngSize('../public/brand-mark.png'), [144, 144]);
assert.deepEqual(
  await readFile(new URL('../public/brand-mark.png', import.meta.url)),
  await readFile(new URL('../server/assets/brand-mark.png', import.meta.url)),
  'The public logo is the existing original-derived logo, unchanged',
);
console.log('PASS share image is 1200×630 and the unchanged original logo is 144×144');
