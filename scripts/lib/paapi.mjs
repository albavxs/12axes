/**
 * Minimal Amazon Product Advertising API 5.0 client.
 *
 * No dependencies: SigV4 is signed with node:crypto and the request goes out
 * through the global fetch, matching the other scripts in this directory which
 * use only node builtins.
 *
 * Credentials come from the environment, per locale, because an Associates
 * account (and therefore its PA-API keys) is specific to one marketplace:
 *
 *   AMAZON_PAAPI_BR_ACCESS_KEY / _SECRET_KEY / _PARTNER_TAG
 *   AMAZON_PAAPI_US_ACCESS_KEY / _SECRET_KEY / _PARTNER_TAG
 */
import { createHash, createHmac } from 'node:crypto';

const SERVICE = 'ProductAdvertisingAPI';
const REGION = 'us-east-1';

export const MARKETPLACES = {
  br: { host: 'webservices.amazon.com.br', marketplace: 'www.amazon.com.br', env: 'BR' },
  us: { host: 'webservices.amazon.com', marketplace: 'www.amazon.com', env: 'US' }
};

/** Throttle shared by all calls: PA-API starts at 1 request/second per account. */
const MIN_INTERVAL_MS = 1100;
const lastCallAt = new Map();

export class PaapiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = 'PaapiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** True when the key pair itself is rejected, which no retry can fix. */
  get isAuthFailure() {
    if (this.status === 401 || this.status === 403) return true;
    return ['InvalidAssociate', 'InvalidSignature', 'UnrecognizedClient', 'AccessDenied']
      .includes(this.code ?? '');
  }
}

export function credentials(marketplace) {
  const { env } = MARKETPLACES[marketplace];
  const accessKey = process.env[`AMAZON_PAAPI_${env}_ACCESS_KEY`];
  const secretKey = process.env[`AMAZON_PAAPI_${env}_SECRET_KEY`];
  const partnerTag = process.env[`AMAZON_PAAPI_${env}_PARTNER_TAG`];
  if (!accessKey || !secretKey || !partnerTag) {
    throw new PaapiError(
      `Credenciais PA-API ausentes para "${marketplace}": defina ` +
      `AMAZON_PAAPI_${env}_ACCESS_KEY, AMAZON_PAAPI_${env}_SECRET_KEY e ` +
      `AMAZON_PAAPI_${env}_PARTNER_TAG`,
      { code: 'MissingCredentials' }
    );
  }
  return { accessKey, secretKey, partnerTag };
}

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value, 'utf8').digest();

function signingKey(secretKey, date) {
  let key = hmac(`AWS4${secretKey}`, date);
  for (const part of [REGION, SERVICE, 'aws4_request']) key = hmac(key, part);
  return key;
}

function authorization({ accessKey, secretKey }, { host, target, path, payload, amzDate }) {
  const date = amzDate.slice(0, 8);
  // Header order must match signedHeaders exactly, and both must be sorted.
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST', path, '', canonicalHeaders, signedHeaders, sha256(payload)
  ].join('\n');

  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(secretKey, date))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
         `SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function throttle(marketplace) {
  const previous = lastCallAt.get(marketplace) ?? 0;
  const wait = previous + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  lastCallAt.set(marketplace, Date.now());
}

async function call(marketplace, operation, body, { attempts = 4 } = {}) {
  const { host, marketplace: marketplaceHost } = MARKETPLACES[marketplace];
  const creds = credentials(marketplace);
  const path = `/paapi5/${operation.toLowerCase()}`;
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const payload = JSON.stringify({
    ...body,
    PartnerTag: creds.partnerTag,
    PartnerType: 'Associates',
    Marketplace: marketplaceHost
  });

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await throttle(marketplace);
    const amzDate = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

    let response;
    try {
      response = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers: {
          'content-encoding': 'amz-1.0',
          'content-type': 'application/json; charset=utf-8',
          host,
          'x-amz-date': amzDate,
          'x-amz-target': target,
          authorization: authorization(creds, { host, target, path, payload, amzDate })
        },
        body: payload
      });
    } catch (cause) {
      lastError = new PaapiError(`Falha de rede em ${operation}: ${cause.message}`);
      await new Promise((done) => setTimeout(done, 2000 * (attempt + 1)));
      continue;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (response.ok) return parsed;

    const error = parsed?.Errors?.[0] ?? parsed?.__type ?? {};
    const code = error.Code ?? (typeof parsed?.__type === 'string' ? parsed.__type : undefined);
    lastError = new PaapiError(
      error.Message ?? `${operation} falhou com HTTP ${response.status}`,
      { status: response.status, code, body: parsed }
    );

    // Auth failures and "no results" are final; only throttling is worth retrying.
    if (lastError.isAuthFailure) throw lastError;
    if (response.status === 429 || response.status >= 500) {
      await new Promise((done) => setTimeout(done, 2500 * (attempt + 1)));
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

export const RESOURCES = [
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'ItemInfo.ExternalIds',
  'ItemInfo.ContentInfo',
  'Offers.Listings.Price',
  'Offers.Listings.Availability.Message',
  'Offers.Listings.Availability.Type',
  'Offers.Listings.MerchantInfo',
  'Offers.Summaries.LowestPrice',
  'Offers.Summaries.Condition'
];

/** Exact lookup by ASIN (for books, usually the ISBN-10). Up to 10 per call. */
export function getItems(marketplace, itemIds, resources = RESOURCES) {
  return call(marketplace, 'GetItems', {
    ItemIds: itemIds,
    ItemIdType: 'ASIN',
    Resources: resources
  });
}

/**
 * Structured book search. Title and Author are separate fields, which is what
 * makes this trustworthy where a keyword query was not.
 */
export function searchItems(marketplace, { title, author, itemCount = 10 }, resources = RESOURCES) {
  const body = { SearchIndex: 'Books', ItemCount: itemCount, Resources: resources };
  if (title) body.Title = title;
  if (author) body.Author = author;
  return call(marketplace, 'SearchItems', body);
}
