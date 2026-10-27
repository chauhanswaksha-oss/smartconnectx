import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/manrope/latin-800.css';

const url = new URL(location.href);
if (url.pathname === '/editor' || url.searchParams.has('card') || new URLSearchParams(url.hash.slice(1)).has('p')) {
  await import('./portfolio.js');
} else {
  await import('./storefront.js');
}
