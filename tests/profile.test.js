import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, normalizeProfile, encodeProfile, decodeProfile, profileUrl, createVCard, readSavedProfile } from '../profile.js';

const person = {
  ...emptyProfile,
  name: 'Priya शर्मा', role: 'Photographer & storyteller',
  email: 'priya@example.com', phone: '+91 98765 43210',
  bio: 'Stories, portraits; and places.\nBased in Mumbai.',
  website: 'https://example.com/portfolio',
  projects: [{ title: 'City stories', category: 'Photography', description: 'Portraits of people & places.', url: 'https://example.com/city' }],
};

test('a portable link restores a completed Unicode portfolio without browser storage', () => {
  const url = new URL(profileUrl(person, 'https://example.com/portfolio#about'));
  const restored = decodeProfile(new URLSearchParams(url.hash.slice(1)).get('p'));
  assert.deepEqual(restored, normalizeProfile(person));
  assert.equal(url.origin, 'https://example.com');
  assert.equal(url.pathname, '/portfolio');
});

test('invalid or oversized shared profiles fall back safely', () => {
  for (const token of ['', 'not-a-valid-profile', '***', 'a'.repeat(14001)]) assert.equal(decodeProfile(token), null);
  assert.equal(decodeProfile(encodeProfile({ name: 'Missing role' })), null);
});

test('profile links accept web destinations and reject executable or credential-bearing links', () => {
  const profile = normalizeProfile({ ...person, photo: 'javascript:alert(1)', website: 'https://user:password@example.com', linkedin: 'data:text/html,<script>', projects: [{ title: 'Project', url: 'file:///tmp/data' }] });
  assert.equal(profile.photo, '');
  assert.equal(profile.website, '');
  assert.equal(profile.linkedin, '');
  assert.equal(profile.projects[0].url, '');
});

test('contact cards preserve Unicode, escape punctuation, and fold long links by byte count', () => {
  const url = profileUrl(person, 'https://example.com/portfolio');
  const card = createVCard(person, url);
  const unfolded = card.replace(/\r\n /g, '');
  assert.match(unfolded, /FN:Priya शर्मा\r\n/);
  assert.match(unfolded, /EMAIL;TYPE=INTERNET:priya@example.com/);
  assert.ok(unfolded.includes(`URL:${url}\r\n`));
  assert.ok(unfolded.includes('NOTE:Stories\\, portraits\\; and places.\\nBased in Mumbai.'));
  for (const line of card.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 74);
  assert.ok(card.endsWith('END:VCARD\r\n'));
});

test('bad or unavailable local storage cannot prevent loading a portfolio', () => {
  assert.equal(readSavedProfile({ getItem: () => '{broken' }), null);
  assert.equal(readSavedProfile({ getItem: () => { throw new Error('storage unavailable'); } }), null);
  assert.deepEqual(readSavedProfile({ getItem: () => JSON.stringify(person) }), normalizeProfile(person));
});

test('normalization is stable and rejects oversized Unicode URLs instead of truncating them', () => {
  const source = { ...person, website: 'https://example.com/' + 'अ'.repeat(100) };
  const first = normalizeProfile(source);
  assert.equal(first.website, '');
  assert.deepEqual(normalizeProfile(first), first);
  assert.equal(readSavedProfile({ getItem: () => JSON.stringify({ name: true, role: 1 }) }), null);
});

test('a carriage return in shared text cannot inject a vCard property', () => {
  const card = createVCard({ ...person, name: 'Priya\rTEL:999' }, 'https://example.com');
  assert.ok(card.includes('FN:Priya\\nTEL:999\r\n'));
  assert.ok(card.includes('N:;Priya\\nTEL:999;;;\r\n'));
  assert.equal(card.includes('\rTEL:999'), false);
});
