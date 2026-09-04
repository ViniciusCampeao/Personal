import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './index.css';

/**
 * A route's dynamic import 404s when a deploy lands under an open tab: the document in
 * memory still points at the previous build's chunk hashes, which nginx no longer serves.
 * The tab is simply stale, so reloading picks up the new index — without this, every
 * deploy breaks lazy navigation for whoever already had the app open.
 *
 * Guarded by a session flag: if the chunk is missing for any *other* reason, reloading
 * would not fix it and the tab must not spin.
 */
const STALE_CHUNK_FLAG = 'pt:reloaded-for-chunk';

window.addEventListener('vite:preloadError', (event) => {
  let alreadyTried = true;
  try {
    alreadyTried = sessionStorage.getItem(STALE_CHUNK_FLAG) !== null;
    if (!alreadyTried) sessionStorage.setItem(STALE_CHUNK_FLAG, '1');
  } catch {
    // Private mode / storage disabled: fall through to the error boundary rather than
    // risking an unguarded reload loop.
  }
  if (alreadyTried) return;
  event.preventDefault();
  window.location.reload();
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
