/**
 * app.js — Main entry point and application orchestrator
 * Initializes PDF.js, registers the Service Worker, and wires modules together.
 */

import { init as initSettings } from './settings.js';
import { init as initLibrary, render as renderLibrary } from './library.js';
import { init as initReader, openBook } from './reader.js';

async function boot() {
  // 1. Initialize settings (theme, transitions)
  initSettings();

  // 2. Load PDF.js
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';

  // 3. Initialize library view
  await initLibrary(pdfjsLib, async (book) => {
    await openBook(book);
  });

  // 4. Initialize reader
  initReader(pdfjsLib, () => {
    // When reader closes, re-render library to update progress
    renderLibrary();
  });

  // 5. Logo click → back to library
  document.getElementById('logo-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('reader-view').classList.remove('active');
    renderLibrary();
  });

  // 6. Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[App] Service Worker registered:', reg.scope);
    } catch (err) {
      console.warn('[App] Service Worker registration failed:', err);
    }
  }

  console.log('[App] Readium booted successfully.');
}

// Start the app
boot().catch((err) => {
  console.error('[App] Boot failed:', err);
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:Inter,sans-serif;color:#fff;background:#000">
      <h2>Failed to load Readium</h2>
      <p style="color:#999;max-width:400px;text-align:center">${err.message}</p>
      <button onclick="location.reload()" style="padding:10px 24px;border:none;background:#6366F1;color:#fff;border-radius:8px;cursor:pointer;font-size:.9rem">Retry</button>
    </div>
  `;
});
