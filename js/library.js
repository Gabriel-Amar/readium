/**
 * library.js — Home page / bookshelf library view
 * Renders book cards with covers, titles, and progress indicators.
 */

import { getAllBooks, addBook, deleteBook, getFileData } from './db.js';

let pdfjsLib = null;
let onBookOpen = null;

/**
 * Initialize the library view.
 * @param {object} pdfjs - The loaded pdfjsLib module
 * @param {function} openBookCallback - Called with book meta when user clicks a card
 */
export async function init(pdfjs, openBookCallback) {
  pdfjsLib = pdfjs;
  onBookOpen = openBookCallback;

  const fileInput = document.getElementById('file-input');
  const importBtn = document.getElementById('import-btn');
  const importBtn2 = document.getElementById('import-btn-2');

  importBtn.addEventListener('click', () => fileInput.click());
  importBtn2.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      await importPDF(file);
    }
    fileInput.value = '';
    await render();
  });

  await render();
}

/**
 * Import a PDF file: generate thumbnail, extract page count, store in DB.
 */
async function importPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const totalPages = pdf.numPages;

    // Generate cover thumbnail from page 1
    const coverDataUrl = await generateThumbnail(pdf);
    pdf.destroy();

    await addBook(file, coverDataUrl, totalPages);
  } catch (err) {
    console.error('[Library] Failed to import PDF:', err);
    alert(`Failed to import "${file.name}". The file may be corrupted or password-protected.`);
  }
}

/**
 * Render page 1 of a PDF to a small canvas and return as data URL.
 */
async function generateThumbnail(pdf) {
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

/**
 * Render the library grid.
 */
export async function render() {
  const grid = document.getElementById('book-grid');
  const stats = document.getElementById('library-stats');
  const books = await getAllBooks();

  stats.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;

  if (books.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <h3>Your library is empty</h3>
        <p>Import a PDF to start reading</p>
        <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import PDF
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = books.map((book) => {
    const progress = book.totalPages > 0
      ? Math.round(((book.lastPage) / book.totalPages) * 100)
      : 0;
    const coverHtml = book.coverDataUrl
      ? `<img src="${book.coverDataUrl}" alt="${escapeHtml(book.title)}" loading="lazy">`
      : `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;

    return `
      <div class="book-card" data-id="${book.id}">
        <button class="book-delete" data-delete="${book.id}" title="Remove from library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="book-cover">${coverHtml}</div>
        <div class="book-info">
          <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
          <div class="book-progress-bar"><div class="book-progress-fill" style="width:${progress}%"></div></div>
          <div class="book-progress-text">${progress}% · p.${book.lastPage}/${book.totalPages}</div>
        </div>
      </div>
    `;
  }).join('');

  // Attach click handlers
  grid.querySelectorAll('.book-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Don't open if clicking delete
      if (e.target.closest('.book-delete')) return;
      const id = card.dataset.id;
      const book = books.find((b) => b.id === id);
      if (book && onBookOpen) onBookOpen(book);
    });
  });

  grid.querySelectorAll('.book-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      const book = books.find((b) => b.id === id);
      if (confirm(`Remove "${book?.title}" from your library?`)) {
        await deleteBook(id);
        await render();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default { init, render };
