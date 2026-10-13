import { compressSync, decompressSync, strToU8, strFromU8 } from 'fflate';

export const emptyProfile = {
  name: '', role: '', email: '', phone: '', location: '', bio: '', photo: '',
  headline: '', skills: '', website: '', linkedin: '', github: '', instagram: '', projects: [],
};
export const demoProfile = {
  ...emptyProfile,
  name: 'Virat Kohli', role: 'Product designer & creative developer', email: 'alex@example.com',
  location: 'Bengaluru, India', headline: 'Designing moments.\nConnecting people.',
  bio: 'I turn complex ideas into thoughtful digital experiences. Blending strategy, design, and a little curiosity to create things people love to use.',
  photo: '',
  skills: 'Product design, Brand identity, Web development, Creative direction',
  projects: [
    { title: 'Aura Studio', category: 'Brand identity · Digital experience', description: 'A sample brand concept built around clarity, calm, and intentional design.', url: '' },
    { title: 'Roam', category: 'Product strategy · UI/UX design', description: 'A sample travel product that helps curious people discover their next destination.', url: '' },
  ],
};
const limits = { name: 70, role: 100, email: 150, phone: 40, location: 80, bio: 450, photo: 400, headline: 100, skills: 160, website: 250, linkedin: 250, github: 250, instagram: 250 };
const string = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function safeUrl(value, maxLength = Infinity) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.href.length <= maxLength ? url.href : ''; } catch { return ''; }
}
export function normalizeProfile(input) {
  const source = input && typeof input === 'object' ? input : {};
  const profile = {};
  for (const [key, max] of Object.entries(limits)) profile[key] = string(source[key], max);
  for (const key of ['photo', 'website', 'linkedin', 'github', 'instagram']) profile[key] = safeUrl(typeof source[key] === 'string' ? source[key].trim() : '', limits[key]);
  profile.email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email) ? profile.email : '';
  profile.phone = profile.phone.replace(/[^\d+() .-]/g, '');
  profile.projects = Array.isArray(source.projects) ? source.projects.slice(0, 3).map(project => ({
    title: string(project?.title, 70), category: string(project?.category, 100),
    description: string(project?.description, 300), url: safeUrl(typeof project?.url === 'string' ? project.url.trim() : '', 250),
  })).filter(project => project.title) : [];
  return profile;
}
export function encodeProfile(profile) {
  const bytes = compressSync(strToU8(JSON.stringify({ v: 1, p: normalizeProfile(profile) })), { mtime: 0 });
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeProfile(token) {
  try {
    if (!token || token.length > 14000 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const compressed = Uint8Array.from(binary, c => c.charCodeAt(0));
    // A fixed output buffer also bounds decompression of untrusted shared links.
    const bytes = decompressSync(compressed, { out: new Uint8Array(16000) });
    const value = JSON.parse(strFromU8(bytes).replace(/\0+$/, ''));
    if (value.v !== 1 || !value.p || typeof value.p !== 'object') return null;
    const result = normalizeProfile(value.p);
    return result.name && result.role ? result : null;
  } catch { return null; }
}
export function profileUrl(profile, base) {
  const url = new URL(base); url.hash = `p=${encodeProfile(profile)}`; return url.href;
}
export function createVCard(profile, url) {
  const clean = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${clean(profile.name)}`, `N:;${clean(profile.name)};;;`, `TITLE:${clean(profile.role)}`];
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET:${clean(profile.email)}`);
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${clean(profile.phone)}`);
  if (profile.bio) lines.push(`NOTE:${clean(profile.bio)}`);
  if (url) lines.push(`URL:${clean(url)}`);
  lines.push('END:VCARD');
  // RFC 2425 folding keeps long profile links readable by contact importers.
  return lines.map(line => {
    const result = []; let part = ''; let size = 0;
    for (const char of line) {
      const length = new TextEncoder().encode(char).length;
      if (size + length > 74) { result.push(part); part = ' '; size = 1; }
      part += char; size += length;
    }
    result.push(part); return result.join('\r\n');
  }).join('\r\n') + '\r\n';
}
export function readSavedProfile(storage) {
  try { const value = JSON.parse(storage.getItem('scx-profile') || 'null'); const result = normalizeProfile(value); return result.name && result.role ? result : null; } catch { return null; }
}
