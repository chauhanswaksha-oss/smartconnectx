import test from 'node:test';
import assert from 'node:assert/strict';
import { upiUrl, validReference, validUpi, safeNext, rupeesToPaise, escapeHtml } from '../commerce.js';

test('UPI intent preserves recipient and exact server-quoted paise without parameter injection', () => {
  const order = { id: 'aabbccdd-1234-4234-9234-aabbccddeeff', amount_paise: 9901, currency: 'INR', merchant_name: 'Name & Co', upi_id: 'merchant@bank' };
  const url = new URL(upiUrl(order));
  assert.equal(url.protocol, 'upi:'); assert.equal(url.hostname, 'pay');
  assert.equal(url.searchParams.get('pa'), 'merchant@bank');
  assert.equal(url.searchParams.get('am'), '99.01');
  assert.equal(url.searchParams.get('pn'), 'Name & Co');
  assert.equal(url.searchParams.get('tr'), order.id);
  for (const amount of [0,-10,99.1,NaN,Infinity]) assert.throws(() => upiUrl({...order,amount_paise:amount}));
  assert.throws(() => upiUrl({...order,upi_id:'x@bank&am=1'}));
  assert.throws(() => upiUrl({...order,currency:'USD'}));
});
test('authentication return paths cannot redirect to an external origin', () => {
  for (const url of ['https://evil.test','//evil.test','/\\evil.test','/\n/evil.test']) assert.equal(safeNext(url),'/account');
  assert.equal(safeNext('/checkout?plan=pro-yearly'),'/checkout?plan=pro-yearly');
  assert.equal(safeNext('/editor?new=1'),'/editor?new=1');
});
test('payment input validation rejects malformed references and fractional paise', () => {
  assert.equal(validReference('123456789012'),true);
  for(const ref of ['123456','12345678901x','1234567890123','1e11']) assert.equal(validReference(ref),false);
  assert.equal(validUpi('business.name-2@bank'),true);
  assert.equal(validUpi('merchant@bank?am=1'),false);
  assert.equal(rupeesToPaise('499.25'),49925);
  for(const price of ['0','-1','1.001','1e2','1000000','']) assert.throws(()=>rupeesToPaise(price));
});
test('untrusted profile and payment notes render as text', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
