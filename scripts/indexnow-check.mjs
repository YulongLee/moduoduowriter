import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPaths, siteOrigin } from '../server/seo.mjs';
import {
  buildIndexNowPayload, indexNowEndpoint, indexNowHost, indexNowKey, indexNowKeyLocation,
  IndexNowError, requestTimeoutMs, submitIndexNow,
} from './submit-indexnow.mjs';

// Entire suite uses injected fetch; no real IndexNow request or account secret.
const expectedUrls = publicPaths.map(path => `${siteOrigin}${path}`);
assert.equal(requestTimeoutMs, 20_000);
assert.equal(indexNowHost, 'moduoduowriter.com');
assert.equal(indexNowEndpoint, 'https://api.indexnow.org/indexnow');
assert.match(indexNowKey, /^[a-f0-9]{32}$/);
assert.equal(indexNowKeyLocation, `${siteOrigin}/${indexNowKey}.txt`);
assert.equal(await readFile(new URL(`../public/${indexNowKey}.txt`, import.meta.url), 'utf8'), indexNowKey, 'Published protocol file matches the newly created public key exactly');
const payload = buildIndexNowPayload();
assert.deepEqual(payload, { host: indexNowHost, key: indexNowKey, keyLocation: indexNowKeyLocation, urlList: expectedUrls });
assert.equal(payload.urlList.length, 7);
payload.urlList.pop();
assert.equal(buildIndexNowPayload().urlList.length, 7, 'Callers cannot mutate the default seven-page batch');

let calls = 0;
const noNetwork = async () => { calls++; throw Error('Network is forbidden in a dry-run'); };
assert.deepEqual(await submitIndexNow({ fetchImpl: noNetwork }), { status: 'dry-run', urlCount: 7 });
assert.deepEqual(await submitIndexNow({ submit: false, fetchImpl: noNetwork }), { status: 'dry-run', urlCount: 7 });
assert.equal(calls, 0);
for (const submit of ['true', 1, null]) {
  await assert.rejects(submitIndexNow({ submit, fetchImpl: noNetwork }), TypeError);
}
console.log('PASS dedicated public ownership token, immutable seven-page batch and default dry-run with zero network calls');

const invalidPayloads = [
  { host: 'evil.example' }, { host: 'www.moduoduowriter.com' }, { host: `${indexNowHost}:443` },
  { key: 'a'.repeat(32) }, { key: '' },
  { keyLocation: `http://${indexNowHost}/${indexNowKey}.txt` },
  { keyLocation: `https://evil.example/${indexNowKey}.txt` },
  { keyLocation: `https://${indexNowHost}.evil.example/${indexNowKey}.txt` },
  { keyLocation: `https://evil.example@${indexNowHost}/${indexNowKey}.txt` },
  { keyLocation: `${indexNowKeyLocation}?x=1` }, { keyLocation: `${indexNowKeyLocation}#x` },
  { keyLocation: `${siteOrigin}/private/${indexNowKey}.txt` },
  { urlList: [] }, { urlList: expectedUrls.slice(1) },
  { urlList: [...expectedUrls, `${siteOrigin}/admin/`] },
  { urlList: expectedUrls.map(() => expectedUrls[0]) },
];
for (const invalidUrl of [
  'https://evil.example/', 'http://moduoduowriter.com/', 'https://www.moduoduowriter.com/',
  '//moduoduowriter.com/', 'https://moduoduowriter.com.evil.example/',
  'https://evil.example@moduoduowriter.com/',
  `${siteOrigin}/admin/`, `${siteOrigin}/works/`, `${siteOrigin}/api/auth/status`,
  `${siteOrigin}/unknown/`, `${siteOrigin}/#home`, `${siteOrigin}/?q=novel`,
  `${siteOrigin}/about/#x`, `${siteOrigin}/about/?x=1`,
  `${siteOrigin}/%61bout/`, `${siteOrigin}/features/../about/`,
  `${siteOrigin}/features/ai-novel-writing`, '/about/', null,
]) {
  invalidPayloads.push({ urlList: [invalidUrl, ...expectedUrls.slice(1)] });
}
for (const invalid of invalidPayloads) {
  assert.throws(() => buildIndexNowPayload(invalid), TypeError);
  await assert.rejects(submitIndexNow({ submit: true, payload: invalid, fetchImpl: noNetwork }), TypeError);
}
assert.equal(calls, 0, 'Malformed/domain/private/query/hash requests are rejected before any network access');
console.log('PASS fixed domain/keyLocation and strict public canonical URL boundaries reject unsafe batches before requests');

function fixture({ keyStatus = 200, keyText = indexNowKey, postStatus = 200, failGet, failPost, failBody } = {}) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      assert.ok(options.signal instanceof AbortSignal, 'Every request carries a bounded abort signal');
      assert.equal(options.signal.aborted, false);
      assert.equal(options.redirect, 'error', 'Ownership verification and notification never follow redirects');
      if (requests.length === 1) {
        assert.equal(url, indexNowKeyLocation);
        assert.equal(options.method, 'GET');
        if (failGet) throw failGet;
        return { status: keyStatus, text: async () => { if (failBody) throw failBody; return keyText; } };
      }
      assert.equal(requests.length, 2, 'No automatic retries or duplicate submissions');
      assert.equal(url, indexNowEndpoint);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/json; charset=utf-8');
      assert.deepEqual(JSON.parse(options.body), buildIndexNowPayload());
      if (failPost) throw failPost;
      return { status: postStatus };
    },
  };
}

for (const httpStatus of [200, 202]) {
  const state = fixture({ postStatus: httpStatus });
  const result = await submitIndexNow({ submit: true, fetchImpl: state.fetchImpl });
  assert.deepEqual(result, { status: httpStatus === 200 ? 'received' : 'key-validation-pending', httpStatus, urlCount: 7 });
  assert.equal(state.requests.length, 2);
  assert.ok(!/indexed|ranking-success/.test(JSON.stringify(result)), 'Protocol acknowledgment must not claim indexing');
}
for (const failure of [
  { keyStatus: 404 }, { keyStatus: 202 }, { keyStatus: 301 },
  { keyText: `${indexNowKey}\n` }, { keyText: 'wrong-token' }, { keyText: `<html>${indexNowKey}</html>` },
]) {
  const state = fixture(failure);
  await assert.rejects(submitIndexNow({ submit: true, fetchImpl: state.fetchImpl }), error => {
    assert.ok(error instanceof IndexNowError);
    assert.equal(error.code, 'KEY_VALIDATION_FAILED');
    assert.match(error.message, /not submitted/);
    return true;
  });
  assert.equal(state.requests.length, 1, 'A non-200 or inexact key file must prevent the POST');
}
console.log('PASS 200 means received, 202 means key validation pending; failed ownership verification never sends a POST');

for (const httpStatus of [400, 403, 422, 429, 500]) {
  const state = fixture({ postStatus: httpStatus });
  await assert.rejects(submitIndexNow({ submit: true, fetchImpl: state.fetchImpl }), error => {
    assert.ok(error instanceof IndexNowError);
    assert.equal(error.status, httpStatus);
    assert.equal(error.code, httpStatus === 429 ? 'RATE_LIMITED' : 'SUBMISSION_FAILED');
    assert.match(error.message, /no automatic retry/);
    if (httpStatus === 429) assert.match(error.message, /rate limited/);
    return true;
  });
  assert.equal(state.requests.length, 2);
}
for (const [failure, expectedCode, requestCount] of [
  [{ failGet: new Error('internal-transport-detail') }, 'NETWORK_ERROR', 1],
  [{ failBody: new Error('internal-body-detail') }, 'NETWORK_ERROR', 1],
  [{ failGet: Object.assign(new Error('internal-timeout-detail'), { name: 'TimeoutError' }) }, 'REQUEST_TIMEOUT', 1],
  [{ failPost: Object.assign(new Error('internal-abort-detail'), { name: 'AbortError' }) }, 'REQUEST_TIMEOUT', 2],
  [{ failPost: new Error('internal-post-detail') }, 'NETWORK_ERROR', 2],
]) {
  const state = fixture(failure);
  await assert.rejects(submitIndexNow({ submit: true, fetchImpl: state.fetchImpl }), error => {
    assert.equal(error.code, expectedCode);
    assert.ok(!error.message.includes('internal-'), 'Remote/network details cannot leak into operator logs');
    if (expectedCode === 'REQUEST_TIMEOUT') assert.match(error.message, /20 seconds/);
    return true;
  });
  assert.equal(state.requests.length, requestCount);
}
console.log('PASS 429 and other failures are explicit, timeout/transport details are safe and no failure is automatically retried');

const entry = fileURLToPath(new URL('./submit-indexnow.mjs', import.meta.url));
for (const args of [[], ['--dry-run']]) {
  const stdout = execFileSync(process.execPath, [entry, ...args], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(stdout), { status: 'dry-run', urlCount: 7 });
  assert.ok(!stdout.includes(indexNowKey) && !stdout.includes(siteOrigin), 'Dry-run output exposes only safe status/count');
}
assert.throws(() => execFileSync(process.execPath, [entry, '--unknown'], { encoding: 'utf8', stdio: 'pipe' }), error => {
  assert.equal(error.status, 1);
  assert.match(error.stderr, /Usage:/);
  return true;
});
const tempDirectory = await mkdtemp(join(tmpdir(), 'mdd-indexnow-cli-'));
try {
  const link = join(tempDirectory, 'submit-indexnow.mjs');
  await symlink(entry, link);
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, [link], { encoding: 'utf8' })), { status: 'dry-run', urlCount: 7 }, 'Whole-release symlink deployment still executes the default safe CLI');
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
console.log('PASS direct and symlink CLI default to a safe count-only dry-run; unknown flags do not submit');
