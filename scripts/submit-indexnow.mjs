import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicPaths, siteOrigin } from '../server/seo.mjs';

// This is a public IndexNow ownership token, not an account/API credential.
// Protocol: https://www.indexnow.org/documentation
export const indexNowKey = '0b977e46ec233aef6996576fa3438721';
export const indexNowHost = 'moduoduowriter.com';
export const indexNowKeyLocation = `${siteOrigin}/${indexNowKey}.txt`;
export const indexNowEndpoint = 'https://api.indexnow.org/indexnow';
export const requestTimeoutMs = 20_000;
const allowedUrls = Object.freeze(publicPaths.map(path => `${siteOrigin}${path}`));
const allowedUrlSet = new Set(allowedUrls);

export class IndexNowError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'IndexNowError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/** Validate an exact public page batch; never accept request/user URLs. */
export function buildIndexNowPayload({
  host = indexNowHost,
  key = indexNowKey,
  keyLocation = indexNowKeyLocation,
  urlList = allowedUrls,
} = {}) {
  if (siteOrigin !== `https://${indexNowHost}` || host !== indexNowHost) {
    throw new TypeError('IndexNow host must be the fixed HTTPS production website.');
  }
  if (key !== indexNowKey || !/^[a-f0-9]{32}$/.test(key)) {
    throw new TypeError('IndexNow requires the dedicated public ownership token.');
  }
  if (keyLocation !== indexNowKeyLocation) {
    throw new TypeError('IndexNow keyLocation must be the exact root key file on the production website.');
  }
  if (!Array.isArray(urlList) || urlList.length !== allowedUrls.length || new Set(urlList).size !== allowedUrls.length) {
    throw new TypeError('IndexNow accepts exactly the distinct authored public URLs.');
  }
  for (const url of urlList) {
    if (typeof url !== 'string' || !allowedUrlSet.has(url)) {
      throw new TypeError('IndexNow rejects private, unknown, external or non-canonical URLs.');
    }
    const parsed = new URL(url);
    if (parsed.origin !== siteOrigin || parsed.protocol !== 'https:' || parsed.search || parsed.hash) {
      throw new TypeError('IndexNow URLs must use the canonical HTTPS website without a query or fragment.');
    }
  }
  return { host, key, keyLocation, urlList: [...urlList] };
}

async function request(fetchImpl, url, options, stage, consume) {
  const signal = AbortSignal.timeout(requestTimeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal, redirect: 'error' });
    return await consume(response);
  } catch (error) {
    if (error instanceof IndexNowError) throw error;
    if (signal.aborted || ['AbortError', 'TimeoutError'].includes(error?.name)) {
      throw new IndexNowError(`${stage} timed out after 20 seconds; no automatic retry was made.`, 'REQUEST_TIMEOUT');
    }
    // Do not echo transport messages or remote response bodies into logs.
    throw new IndexNowError(`${stage} failed; check connectivity and HTTPS configuration before trying again.`, 'NETWORK_ERROR');
  }
}

/**
 * Default is local dry-run. Tests inject fetchImpl; real submission is explicit.
 * A successful protocol response acknowledges discovery, not indexing/ranking.
 */
export async function submitIndexNow({ submit = false, fetchImpl = globalThis.fetch, payload } = {}) {
  if (typeof submit !== 'boolean') throw new TypeError('IndexNow submission must be explicitly enabled with a boolean.');
  const verified = buildIndexNowPayload(payload);
  if (!submit) return { status: 'dry-run', urlCount: verified.urlList.length };
  if (typeof fetchImpl !== 'function') throw new TypeError('IndexNow submission requires a fetch implementation.');

  await request(fetchImpl, verified.keyLocation, { method: 'GET', headers: { Accept: 'text/plain' } }, 'IndexNow key verification', async response => {
    if (response.status !== 200) {
      throw new IndexNowError(`IndexNow ownership file returned HTTP ${response.status}; the batch was not submitted.`, 'KEY_VALIDATION_FAILED', response.status);
    }
    if (await response.text() !== verified.key) {
      throw new IndexNowError('IndexNow ownership file content did not match the public token exactly; the batch was not submitted.', 'KEY_VALIDATION_FAILED');
    }
  });

  return request(fetchImpl, indexNowEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify(verified),
  }, 'IndexNow notification', async response => {
    if (response.status === 200 || response.status === 202) {
      return {
        status: response.status === 200 ? 'received' : 'key-validation-pending',
        httpStatus: response.status,
        urlCount: verified.urlList.length,
      };
    }
    const reasons = {
      400: 'invalid request format',
      403: 'ownership key rejected',
      422: 'host or URL validation rejected',
      429: 'rate limited',
    };
    const reason = reasons[response.status] || 'unexpected response';
    throw new IndexNowError(`IndexNow returned HTTP ${response.status} (${reason}); no automatic retry was made.`, response.status === 429 ? 'RATE_LIMITED' : 'SUBMISSION_FAILED', response.status);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--dry-run', '--submit'].includes(args[0]))) {
    throw new TypeError('Usage: node scripts/submit-indexnow.mjs [--dry-run|--submit]');
  }
  const result = await submitIndexNow({ submit: args[0] === '--submit' });
  console.log(JSON.stringify(result));
  if (result.status !== 'dry-run') {
    console.log(result.status === 'received'
      ? 'IndexNow received the notification. This does not confirm indexing or ranking.'
      : 'IndexNow received the notification; ownership validation is pending. This does not confirm indexing or ranking.');
  }
}

function isDirectEntry() {
  try { return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url); }
  catch { return false; }
}

if (isDirectEntry()) {
  main().catch(error => {
    console.error(error instanceof IndexNowError || error instanceof TypeError ? error.message : 'IndexNow failed. No automatic retry was made.');
    process.exitCode = 1;
  });
}
