import './style.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-800.css';
import QRCode from 'qrcode';
import { db, result, rpc, currentUser } from './cloud.js';
import { emptyProfile, demoProfile, normalizeProfile, decodeProfile, profileUrl, createVCard, readSavedProfile, safeUrl } from './profile.js';

const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icons = {
  arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0v3h3v3m3-6v6m-6-9h6M3 12h9v9"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
};
const icon = name => `<span class="icon" aria-hidden="true">${icons[name]}</span>`;
const token = new URLSearchParams(location.hash.slice(1)).get('p');
const incoming = decodeProfile(token);
let invalidLink = Boolean(token && !incoming);
let saved = null;
try { saved = readSavedProfile(localStorage); } catch { /* The portfolio also works when storage is blocked. */ }
let isVisitor = Boolean(incoming);
let isDemo = !incoming && !saved;
let profile = incoming || saved || normalizeProfile(demoProfile);
const isLocalFile = location.protocol === 'file:';
const baseUrl = () => isLocalFile ? location.href.split('#')[0] : `${location.origin}${location.pathname}${location.search}`;
let cloudCard = null;
const editingCloud = location.pathname === '/editor';
const sharedUrl = () => cloudCard?.is_public ? `${location.origin}/?card=${encodeURIComponent(cloudCard.slug)}` : profileUrl(profile, baseUrl());
const app = document.querySelector('#app');
let toastTimer;
let draft, step = 0;

function render() {
  const skills = profile.skills.split(',').map(s => s.trim()).filter(Boolean);
  const initials = profile.name.split(/\s+/).slice(0, 2).map(s => s[0]).join('');
  const socials = [['website', 'Website'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['instagram', 'Instagram']].filter(([key]) => profile[key]);
  document.title = isDemo ? 'SmartConnectX · Your portfolio, one tap away' : `${profile.name} · SmartConnectX`;
  app.innerHTML = `
    <header>
<div class="scx-live-bridge"><a href="/">← SmartConnect X</a><a href="/account">My cards & subscription ↗</a></div>
      <a class="logo" href="#" aria-label="SmartConnectX home"><span>✳</span> smartconnect<span class="x">x</span></a>
      <nav aria-label="Main navigation">${profile.bio || skills.length ? '<a href="#about">About</a>' : ''}${profile.projects.length ? '<a href="#work">Selected work</a>' : ''}<a href="#contact">Contact</a></nav>
      <button class="outline" id="create-top">${icon(isDemo || isVisitor ? 'plus' : 'arrow')}${isDemo ? 'Create your portfolio' : isVisitor ? 'Create yours' : 'Edit portfolio'}</button>
    </header>
    <main>
      ${isDemo ? `<section class="builder-banner" aria-label="Create a portfolio"><div><span class="banner-icon">${icon('qr')}</span><div><strong>Your identity. Beyond the screen.</strong><p>Build a portfolio people remember. Share it with a tap or scan.</p></div></div><button id="create-banner">Make it yours ${icon('arrow')}</button></section>` : ''}
      ${invalidLink ? '<p class="link-error" role="alert">This profile link is incomplete or invalid. You can create a new portfolio below.</p>' : ''}
      <section class="intro">
        <div class="intro-copy"><div class="availability"><i></i> ${isDemo ? 'ONE PROFILE. ENDLESS POSSIBILITIES.' : 'OPEN TO NEW CONNECTIONS'}</div>
          <p class="hello">Hello, I'm</p><h1>${escape(profile.name)}${profile.headline ? `<span>${escape(profile.headline).replace(/\n/g, '<br>')}</span>` : ''}</h1>
          <p class="description">${escape(profile.role)}</p>
          <div class="actions"><button class="primary" id="save">${icon('download')}Save my contact</button><button class="text-link" id="share">Share profile ${icon('arrow')}</button></div>
          ${profile.location ? `<div class="location">◎ ${escape(profile.location)} <span>•</span> Let's connect</div>` : ''}
        </div>
        <div class="portrait-wrap"><div class="portrait ${profile.photo ? '' : 'no-photo'}">${profile.photo ? `<img src="${escape(profile.photo)}" alt="${escape(profile.name)}" referrerpolicy="no-referrer">` : ''}<span class="initials" aria-hidden="true">${escape(initials)}</span><span class="portrait-label">SMARTCONNECTX / DIGITAL ID</span><div class="portrait-meta"><span><i></i> READY TO CONNECT</span><strong>${escape(profile.name)}</strong><small>${escape(profile.role)}</small></div></div>
          <button class="floating-card" id="share-card"><span class="nfc" aria-hidden="true">⌁</span><div><strong>One tap. A real connection.</strong><small>NFC & QR digital portfolio</small></div>${icon('arrow')}</button><div class="portrait-note"><span>✳</span> Digital identity. Real connection.</div>
        </div>
      </section>
      <div class="ticker" aria-label="Skills and interests">${(skills.length ? skills.slice(0, 4) : ['YOUR STORY', 'YOUR WORK', 'YOUR PEOPLE', 'ONE CONNECTION']).map(skill => `<span>${escape(skill)}</span>✳`).join('')}</div>
      ${profile.bio || skills.length ? `<section id="about" class="about"><div><div class="eyebrow">01 / A LITTLE ABOUT ME</div><h2>Good things start<br>with a <em>conversation.</em></h2></div><div>${profile.bio ? `<p>${escape(profile.bio)}</p>` : ''}<div class="skills">${skills.map(skill => `<span>${escape(skill)}</span>`).join('')}</div></div></section>` : ''}
      ${profile.projects.length ? `<section id="work"><div class="section-title"><div><div class="eyebrow">02 / SELECTED WORK${isDemo ? ' · SAMPLE PROJECTS' : ''}</div><h2>A few things I've <em>put into the world.</em></h2></div><span>${String(profile.projects.length).padStart(2, '0')} projects</span></div><div class="projects">${profile.projects.map((project, index) => `<button class="project" data-project="${index}"><div class="project-art ${index % 2 ? 'art-two' : 'art-one'}"><small>PROJECT / ${String(index + 1).padStart(2, '0')}</small>${index % 2 ? '<div class="orbit"></div>' : ''}<strong>${escape(project.title)}</strong><span class="art-category">${escape(project.category)}</span><span class="art-mark">${icon('arrow')}</span></div><div class="project-caption"><div><h3>${escape(project.title)}</h3><p>${escape(project.category)}</p></div><span aria-hidden="true">${icon('arrow')}</span></div></button>`).join('')}</div></section>` : ''}
      <section class="contact" id="contact"><div><div class="eyebrow">03 / LET'S CONNECT</div><h2>Great things happen<br>when people <em>connect.</em></h2><p>Have an idea, a project, or just a hello?<br>I'd love to hear from you.</p><div class="contact-actions">${profile.email ? `<a class="primary" href="mailto:${escape(profile.email)}">Say hello ${icon('arrow')}</a>` : ''}${profile.phone ? `<a class="${profile.email ? 'contact-phone' : 'primary'}" href="tel:${escape(profile.phone.replace(/[^\d+]/g, ''))}">${profile.email ? escape(profile.phone) : `Call me ${icon('arrow')}`}</a>` : ''}${!profile.email && !profile.phone ? `<button class="primary" id="save-secondary">${icon('download')}Save my contact</button>` : ''}</div>${profile.email ? `<a class="email" href="mailto:${escape(profile.email)}">${escape(profile.email)}</a>` : ''}<div class="socials">${socials.map(([key, label]) => `<a href="${escape(profile[key])}" target="_blank" rel="noopener noreferrer">${label} ${icon('arrow')}</a>`).join('')}</div></div>
        <button class="qr-card" id="qr-card" aria-label="Open profile sharing options">${isLocalFile ? `<div class="offline-qr">${icon('qr')}</div>` : '<canvas id="qr" aria-label="QR code for this portfolio"></canvas>'}<strong>${isLocalFile ? 'Your portfolio. On your device.' : 'Scan. Save. Stay connected.'}</strong><p>${isLocalFile ? 'Host this page to enable QR and NFC sharing.' : 'My portfolio & contact, right in your pocket.'}</p><span>⌁ NFC READY <b>·</b> QR ENABLED</span></button>
      </section>
      <footer><a class="logo" href="#"><span>✳</span> smartconnect<span class="x">x</span></a><span>Your story. One connection away.</span><button id="edit">${isDemo || isVisitor ? 'Create your portfolio' : 'Edit your portfolio'} ${icon('arrow')}</button></footer>
      <p class="demo-note">${isDemo ? 'You’re viewing a sample portfolio. Create yours with your own details.' : 'Made with SmartConnectX · Share your story in a single tap.'}</p>
    </main><dialog id="modal" aria-labelledby="dialog-title"></dialog><div id="toast" role="status" aria-live="polite"></div>`;
  if (!isLocalFile) drawQr(document.querySelector('#qr'), sharedUrl(), 160);
  for (const id of ['share', 'share-card', 'qr-card']) document.getElementById(id).onclick = () => { if (editingCloud && !cloudCard?.is_public) saveCloudCard(); else share(); };
  for (const id of ['save', 'save-secondary']) document.getElementById(id)?.addEventListener('click', saveContact);
  for (const id of ['create-top', 'create-banner', 'edit']) document.getElementById(id)?.addEventListener('click', startEditor);
  document.querySelectorAll('[data-project]').forEach(button => button.onclick = () => showProject(Number(button.dataset.project)));
  document.querySelectorAll('nav a, a.logo').forEach(anchor => anchor.onclick = event => {
    event.preventDefault(); const target = document.querySelector(anchor.getAttribute('href') === '#' ? 'header' : anchor.getAttribute('href'));
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  const img = document.querySelector('.portrait img');
  if (img) img.onerror = () => { img.remove(); document.querySelector('.portrait').classList.add('no-photo'); };
}
function toast(message) {
  clearTimeout(toastTimer); const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('visible');
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4000);
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function saveContact() { download(new Blob([createVCard(profile, isLocalFile ? profile.website : sharedUrl())], { type: 'text/vcard;charset=utf-8' }), `${profile.name.replace(/[^\p{L}\p{N}-]/gu, '-').toLowerCase() || 'contact'}.vcf`); toast('Contact card downloaded. Open it to save this contact.'); }
function modal(content, className = '') {
  const dialog = document.querySelector('#modal'); dialog.className = className;
  dialog.innerHTML = `<button class="close" aria-label="Close dialog">×</button>${content}`;
  dialog.querySelector('.close').onclick = () => dialog.close();
  if (!dialog.open) dialog.showModal();
  dialog.onclick = event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } };
}
async function drawQr(canvas, url, width) {
  try {
    const resolution = width <= 300 ? width * 4 : width;
    await QRCode.toCanvas(canvas, url, { width: resolution, margin: 4, errorCorrectionLevel: 'L', color: { dark: '#29382d', light: '#ffffff' } });
    canvas.style.width = `${width}px`; canvas.style.height = `${width}px`;
    return true;
  }
  catch { canvas.hidden = true; const text = document.createElement('p'); text.className = 'qr-error'; text.textContent = 'This profile is too large for a QR code. Shorten the bio, project details, or links and try again.'; canvas.after(text); return false; }
}
function share() {
  if (isLocalFile) {
    modal(`<div class="eyebrow">YOUR LOCAL PREVIEW</div><h2 id="dialog-title">Your portfolio.<br><em>Ready to connect.</em></h2><p>You can customize your portfolio and download your contact here. To share it with another phone through NFC or a QR code, publish this page at a public HTTPS address.</p><button class="primary" id="offline-contact">${icon('download')}Save my contact</button>`);
    document.querySelector('#offline-contact').onclick = saveContact;
    return;
  }
  const link = sharedUrl(); const local = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(location.hostname);
  modal(`<div class="eyebrow">ONE LINK. EVERY CONNECTION.</div><h2 id="dialog-title">Meet your next<br><em>connection.</em></h2><p>Scan the code to open ${escape(profile.name)}’s portfolio and save their contact.</p><canvas id="share-qr" aria-label="Shareable portfolio QR code"></canvas><label>Portfolio link<input id="share-link" readonly value="${escape(link)}"></label><div class="share-actions"><button class="primary" id="copy">Copy link ${icon('arrow')}</button><button class="outline" id="download-qr">${icon('download')}Save QR</button></div><details class="nfc-guide"><summary>Connect an NFC card or tag</summary><ol><li>Copy the portfolio link above.</li><li>Open an NFC writer app and choose a URL / web link record.</li><li>Paste the link, then hold your tag against your phone to write it.</li><li>Test with another phone. A tap should open your portfolio.</li></ol><p>Write a URL record and test it with another phone. QR sharing works without a physical tag.</p></details><small class="hint">${local ? 'This site is running locally. Deploy it to a public website address before sharing with other people. ' : ''}${cloudCard?.is_public ? 'This permanent link opens your published card. Edits update the same link, so your QR code and NFC tag keep working.' : 'This snapshot link contains your profile details. After editing a snapshot, you need to share a new link.'}</small>`);
  drawQr(document.querySelector('#share-qr'), link, 230).then(ok => { const button = document.querySelector('#download-qr'); if (button) button.disabled = !ok; });
  document.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Portfolio link copied'); }
    catch { document.querySelector('#share-link').select(); toast('Select and copy the portfolio link'); }
  };
  document.querySelector('#download-qr').onclick = async () => {
    const canvas = document.createElement('canvas');
    if (await drawQr(canvas, link, 1200)) canvas.toBlob(blob => { if (blob) { download(blob, 'smartconnectx-qr.png'); toast('QR code downloaded'); } });
  };
}
function startEditor() {
  if (!editingCloud) { location.assign('/editor'); return; }
  draft = structuredClone(isDemo || isVisitor ? emptyProfile : profile); step = 0; renderEditor();
}
const fields = [
  ['name', 'Your name', 'text', 'e.g. Priya Sharma', 70, true],
  ['role', 'What do you do?', 'text', 'e.g. Photographer & visual storyteller', 100, true],
  ['location', 'Location', 'text', 'e.g. Mumbai, India', 80],
  ['photo', 'Profile photo URL', 'url', 'https://…', 400],
  ['email', 'Email address', 'email', 'you@example.com', 150],
  ['phone', 'Phone number', 'tel', '+91 …', 40],
  ['website', 'Website', 'url', 'https://yourwebsite.com', 250],
  ['linkedin', 'LinkedIn', 'url', 'https://linkedin.com/in/…', 250],
  ['github', 'GitHub', 'url', 'https://github.com/…', 250],
  ['instagram', 'Instagram', 'url', 'https://instagram.com/…', 250],
];
function field(key) {
  const [name, label, type, placeholder, max, required] = fields.find(f => f[0] === key);
  return `<label>${label}${required ? ' <span class="required">*</span>' : '<span class="optional">Optional</span>'}<input name="${name}" type="${type}" maxlength="${max}" ${required ? 'required' : ''} placeholder="${placeholder}" value="${escape(draft[name])}" ${name === 'name' ? 'autocomplete="name"' : name === 'email' ? 'autocomplete="email"' : name === 'phone' ? 'autocomplete="tel"' : ''}>${name === 'photo' ? '<small>Use a public https image link, or leave blank for your initials.</small>' : ''}</label>`;
}
function renderEditor() {
  const content = step === 0 ? `<h3>Start with you.</h3><p>Give your next connection a face and a name.</p><div class="form-grid">${['name', 'role', 'location', 'photo'].map(field).join('')}</div><label>Your headline <span class="optional">Optional</span><textarea name="headline" maxlength="100" rows="2" placeholder="A short line that sounds like you">${escape(draft.headline)}</textarea></label><label>A little about you <span class="optional">Optional</span><textarea name="bio" maxlength="450" rows="3" placeholder="Share your story, what you do, and what you care about.">${escape(draft.bio)}</textarea></label><label>Skills & interests <span class="optional">Optional</span><input name="skills" maxlength="160" placeholder="Photography, Branding, Travel" value="${escape(draft.skills)}"><small>Separate each one with a comma.</small></label>` : step === 1 ? `<h3>Make it easy to connect.</h3><p>Add the contact details and links you want to share.</p><div class="form-grid">${['email', 'phone', 'website', 'linkedin', 'github', 'instagram'].map(field).join('')}</div><div class="form-note">${icon('check')}Only include details you’re comfortable sharing with anyone who has your link.</div>` : `<h3>Let your work speak.</h3><p>Add up to three projects, or skip this step and finish your portfolio.</p><div id="project-fields">${draft.projects.map((project, index) => `<fieldset class="project-fields"><legend>Project ${index + 1}</legend><button type="button" class="remove-project" data-remove="${index}" aria-label="Remove project ${index + 1}">Remove</button><label>Project title<input name="project-${index}-title" maxlength="70" required value="${escape(project.title)}" placeholder="What did you create?"></label><label>Category<input name="project-${index}-category" maxlength="100" value="${escape(project.category)}" placeholder="e.g. Brand design · Website"></label><label>Description<textarea name="project-${index}-description" maxlength="300" rows="2" placeholder="The idea, your role, and what you achieved.">${escape(project.description)}</textarea></label><label>Project link <span class="optional">Optional</span><input name="project-${index}-url" type="url" maxlength="250" value="${escape(project.url)}" placeholder="https://…"></label></fieldset>`).join('')}</div>${draft.projects.length < 3 ? `<button type="button" class="add-project" id="add-project">${icon('plus')}Add a project</button>` : ''}`;
  modal(`<div class="eyebrow">YOUR STORY STARTS HERE</div><h2 id="dialog-title">${isDemo || isVisitor ? 'Create your portfolio.' : 'Make it yours.'}</h2><ol class="editor-steps" aria-label="Progress">${['Your story', 'Contact', 'Your work'].map((title, index) => `<li class="${index === step ? 'current' : index < step ? 'done' : ''}" ${index === step ? 'aria-current="step"' : ''}><span>${index < step ? '✓' : index + 1}</span>${title}</li>`).join('')}</ol><form id="profile-form">${content}<p class="form-error" id="form-error" role="alert"></p><div class="editor-bottom">${step ? '<button type="button" class="text-link" id="back">← Back</button>' : '<small>Fields marked * are required.</small>'}<button class="primary" type="submit">${step === 2 ? `Create ${isDemo || isVisitor ? 'portfolio' : 'updated portfolio'} ${icon('check')}` : `Continue ${icon('arrow')}`}</button></div></form>`, 'editor-dialog');
  const dialog = document.querySelector('#modal'); dialog.scrollTop = 0;
  document.querySelector('#back')?.addEventListener('click', () => { collectDraft(); step--; renderEditor(); });
  document.querySelector('#add-project')?.addEventListener('click', () => { collectDraft(); draft.projects.push({ title: '', category: '', description: '', url: '' }); renderEditor(); document.querySelectorAll('.project-fields input')[draft.projects.length * 3 - 3]?.focus(); });
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { collectDraft(); draft.projects.splice(Number(button.dataset.remove), 1); renderEditor(); });
  document.querySelector('#profile-form').onsubmit = event => {
    event.preventDefault(); collectDraft();
    if (!validateStep()) return;
    if (step < 2) { step++; renderEditor(); return; }
    profile = normalizeProfile(draft);
    isDemo = false; isVisitor = false; invalidLink = false; saved = profile;
    document.querySelector('#modal').close(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
    saveCloudCard();
  };
}
function collectDraft() {
  const data = new FormData(document.querySelector('#profile-form'));
  for (const [name, value] of data) {
    const projectField = /^project-(\d+)-(\w+)$/.exec(name);
    if (projectField) draft.projects[Number(projectField[1])][projectField[2]] = value.trim();
    else draft[name] = value.trim();
  }
}
function validateStep() {
  const error = document.querySelector('#form-error');
  if (step === 0 && (!draft.name || !draft.role)) { error.textContent = 'Please add your name and what you do.'; return false; }
  const urlFields = step === 0 ? [[draft.photo, 400]] : step === 1 ? [draft.website, draft.linkedin, draft.github, draft.instagram].map(url => [url, 250]) : draft.projects.map(p => [p.url, 250]);
  if (urlFields.some(([value, max]) => value && !safeUrl(value, max))) { error.textContent = 'Use full http:// or https:// links without login details. Keep photo links under 400 characters and other links under 250.'; return false; }
  return true;
}
function showProject(index) {
  const project = profile.projects[index];
  modal(`<div class="eyebrow">${isDemo ? 'SAMPLE PROJECT' : 'SELECTED WORK'} / ${String(index + 1).padStart(2, '0')}</div><h2 id="dialog-title">${escape(project.title)}</h2>${project.category ? `<div class="project-tag">${escape(project.category)}</div>` : ''}${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}${project.url ? `<a class="primary" href="${escape(project.url)}" target="_blank" rel="noopener noreferrer">View project ${icon('arrow')}</a>` : ''}`);
}
async function saveCloudCard() {
  const suggested = profile.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,30) || 'my-card';
  modal(`<div class="eyebrow">YOUR PERMANENT CARD</div><h2 id="dialog-title">Save your card.</h2><p>Choose the address people will use to find you. This address stays the same when you edit your card.</p><form id="cloud-save-form"><label>Card address<input name="slug" pattern="[a-z0-9][a-z0-9-]{2,39}" minlength="3" maxlength="40" required value="${escape(cloudCard?.slug || suggested)}" ${cloudCard ? 'readonly' : ''}><small>3–40 lowercase letters, numbers or hyphens. The address cannot be changed later.</small></label><label class="publish-choice"><input name="published" type="checkbox" ${cloudCard?.is_public !== false ? 'checked' : ''}><span>Publish this card so anyone with its link can see the details I added.</span></label><p class="form-error" id="cloud-save-error" role="alert"></p><div class="share-actions"><button class="primary" type="submit">Save card ${icon('check')}</button><a href="/account" class="text-link">My account ↗</a></div></form>`);
  document.querySelector('#cloud-save-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget, submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const data = new FormData(form);
      cloudCard = await rpc('scx_save_profile', { p_id: cloudCard?.id || null, p_slug: String(data.get('slug')), p_profile: normalizeProfile(profile), p_public: data.has('published') });
      history.replaceState(null, '', `/editor?id=${cloudCard.id}`);
      document.querySelector('#modal').close(); render();
      if (cloudCard.is_public) share();
      else modal(`<h2 id="dialog-title">Private draft saved.</h2><p>Your card is saved to your account and is not publicly visible.</p><a href="/account" class="primary">Go to my account ↗</a>`);
      toast(cloudCard.is_public ? 'Card published. Your permanent link is ready.' : 'Private draft saved.');
    } catch (error) { document.querySelector('#cloud-save-error').textContent = error.message || 'Could not save your card. Please try again.'; }
    finally { if(submit.isConnected) submit.disabled = false; }
  };
}
async function initialize() {
  try {
    const query = new URLSearchParams(location.search), slug = query.get('card');
    if (editingCloud) {
      const user = await currentUser();
      if (!user) { location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
      if (query.get('id')) cloudCard = await result(db.from('scx_profiles').select('*').eq('id',query.get('id')).eq('owner_id',user.id).single());
      else if (!query.has('new')) {
        const cards = await result(db.from('scx_profiles').select('*').eq('owner_id',user.id).order('created_at').limit(1));
        cloudCard = cards[0] || null;
      }
      profile = normalizeProfile(cloudCard?.profile || demoProfile);
      isDemo = !cloudCard; isVisitor = false;
      render(); startEditor(); return;
    }
    if (slug) {
      cloudCard = await result(db.from('scx_profiles').select('*').eq('slug',slug).eq('is_public',true).single());
      profile = normalizeProfile(cloudCard.profile); isDemo = false; isVisitor = true;
    }
    render();
  } catch (error) {
    app.innerHTML = `<main class="profile-load-error"><a class="logo" href="/">✳ SmartConnect X</a><h1>Card unavailable.</h1><p>This card may be private, or the link may be incorrect.</p><a href="/account" class="primary">Go to my account</a><p role="status">${escape(error.message)}</p></main>`;
  }
}
initialize();
