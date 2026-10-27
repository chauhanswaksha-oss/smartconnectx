export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const money = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
export const validUpi = value => /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(String(value || '').trim());
export const validReference = value => /^\d{12}$/.test(String(value || '').trim());
export const statusLabel = status => ({ awaiting_payment: 'Awaiting payment', pending_review: 'Payment under review', paid: 'Payment verified', rejected: 'Needs attention', cancelled: 'Cancelled' })[status] || 'Unknown status';
export function upiUrl(order) {
  if (!validUpi(order.upi_id) || !Number.isSafeInteger(order.amount_paise) || order.amount_paise <= 0 || order.currency !== 'INR' || !/^[0-9a-f-]{36}$/i.test(order.id)) throw new Error('Payment details are unavailable.');
  const query = new URLSearchParams({ pa: order.upi_id, pn: order.merchant_name, am: (order.amount_paise / 100).toFixed(2), cu: 'INR', tn: `SmartConnect X ${order.id.slice(0,8)}`, tr: order.id });
  return `upi://pay?${query}`;
}
export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/account';
  try { const url = new URL(value, 'https://smartconnect.invalid'); return url.origin === 'https://smartconnect.invalid' ? url.pathname + url.search : '/account'; } catch { return '/account'; }
}
export function rupeesToPaise(value) {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(String(value))) throw new Error('Use a valid price with at most two decimal places.');
  const amount = Math.round(Number(value) * 100);
  if (amount < 100 || amount > 10000000) throw new Error('Price must be between ₹1 and ₹1,00,000.');
  return amount;
}
