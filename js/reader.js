/**
 * reader.js — PDF Reader interface
 * Handles PDF rendering, navigation, swipe gestures, progress tracking.
 */

import { getFileData, updateBookProgress, getBook } from './db.js';
import { transition } from './transitions.js';
import { init as initToc } from './toc.js';
import { enterPage, leavePage, formatTimeRemaining } from './analytics.js';
import { state as settings } from './settings.js';

let pdfjsLib = null;
let pdfDoc = null;
let currentBook = null;
let currentPage = 1;
let totalPages = 0;
let rendering = false;
let onClose = null;

// Mobile scroll mode state
let isScrollMode = false;
let scrollObserver = null;
let scrollContainer = null;
let scrollUpdateTimer = null;

// DOM elements
const readerView = document.getElementById('reader-view');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const pageContainer = document.getElementById('page-container');
const readerTitle = document.getElementById('reader-title');
const readerPageInfo = document.getElementById('reader-page-info');
const readerProgressText = document.getElementById('reader-progress-text');
const readerTimeRemaining = document.getElementById('reader-time-remaining');
const readerLoading = document.getElementById('reader-loading');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const readerBack = document.getElementById('reader-back');

// Touch tracking
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

/**
 * Initialize the reader module.
 * @param {object} pdfjs - The pdfjsLib module
 * @param {function} closeCallback - Called when user exits reader
 */
export function init(pdfjs, closeCallback) {
  pdfjsLib = pdfjs;
  onClose = closeCallback;

  // Button navigation
  prevBtn.addEventListener('click', () => goPage('prev'));
  nextBtn.addEventListener('click', () => goPage('next'));
  readerBack.addEventListener('click', closeReader);

  // Keyboard navigation (desktop only — scroll mode uses native scroll)
  document.addEventListener('keydown', (e) => {
    if (!readerView.classList.contains('active')) return;
    if (e.key === 'Escape') closeReader();
    if (isScrollMode) return; // let native scroll handle arrow keys
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goPage('next'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPage('prev'); }
  });

  // Touch/swipe navigation (desktop only — disabled in scroll mode)
  const area = document.getElementById('reader-canvas-area');
  area.addEventListener('touchstart', onTouchStart, { passive: true });
  area.addEventListener('touchend', onTouchEnd, { passive: false });

}

/**
 * Open a book in the reader.
 * @param {object} book - Book metadata from DB
 */
export async function openBook(book) {
  currentBook = book;
  readerTitle.textContent = book.title;
  readerView.classList.add('active');
  readerLoading.style.display = 'flex';

  // Hide the main app header for an immersive reading experience
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('library-view').style.display = 'none';

  try {
    const data = await getFileData(book.id);
    if (!data) throw new Error('File data not found in database');

    pdfDoc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    totalPages = pdfDoc.numPages;
    currentPage = book.lastPage || 1;

    // Clamp to valid range
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Init TOC sidebar
    await initToc(pdfDoc, (page) => jumpToPage(page));

    // Choose rendering mode based on user preference
    isScrollMode = settings.readingMode === 'scroll';

    if (isScrollMode) {
      await initScrollMode();
    } else {
      await renderPage(currentPage);
    }
    enterPage(currentPage);
    readerLoading.style.display = 'none';
  } catch (err) {
    console.error('[Reader] Failed to open book:', err);
    readerLoading.innerHTML = `<div style="text-align:center;color:var(--text-muted)">
      <p>Failed to load this PDF.</p>
      <button class="btn btn-primary" style="margin-top:12px" onclick="document.getElementById('reader-view').classList.remove('active')">Back</button>
    </div>`;
  }
}

/**
 * Render a specific page to the canvas.
 */
async function renderPage(pageNum) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const areaEl = document.getElementById('reader-canvas-area');
  const areaW = areaEl.clientWidth - 24;
  const areaH = areaEl.clientHeight - 24;

  // Calculate scale to fit viewport
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scaleW = areaW / unscaledViewport.width;
  const scaleH = areaH / unscaledViewport.height;
  const scale = Math.min(scaleW, scaleH, 3); // cap at 3x

  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  updateUI();
}

// ==================== MOBILE SCROLL MODE ====================

/**
 * Initialize continuous vertical scroll mode for mobile.
 * Creates a scrollable container with lazy-rendered page canvases.
 */
async function initScrollMode() {
  const area = document.getElementById('reader-canvas-area');
  area.classList.add('scroll-mode');

  // Hide the single-page canvas
  pageContainer.style.display = 'none';

  // Create scroll container
  scrollContainer = document.createElement('div');
  scrollContainer.className = 'scroll-pages-container';

  // Get page aspect ratio from page 1
  const firstPage = await pdfDoc.getPage(1);
  const vp = firstPage.getViewport({ scale: 1 });
  const ratio = vp.height / vp.width;

  // Create a placeholder div for every page
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'scroll-page';
    pageDiv.dataset.pageNum = String(i);
    pageDiv.style.aspectRatio = `1 / ${ratio}`;
    scrollContainer.appendChild(pageDiv);
  }

  area.appendChild(scrollContainer);

  // Lazy-render pages as they approach the viewport
  scrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const num = parseInt(entry.target.dataset.pageNum);
        renderScrollPage(num, entry.target);
      }
    }
  }, { root: area, rootMargin: '600px 0px', threshold: 0.01 });

  scrollContainer.querySelectorAll('.scroll-page').forEach((el) => scrollObserver.observe(el));

  // Track current page via scroll position
  area.addEventListener('scroll', onScrollTrack);

  // Scroll to the last-read page
  if (currentPage > 1) {
    const target = scrollContainer.children[currentPage - 1];
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant' }));
    }
  }

  updateUI();
}

/**
 * Render a single page into its scroll-mode placeholder div.
 */
async function renderScrollPage(pageNum, container) {
  if (container.dataset.rendered === 'true') return;
  container.dataset.rendered = 'true';

  try {
    const page = await pdfDoc.getPage(pageNum);
    const containerWidth = container.clientWidth || window.innerWidth;
    const unscaledVp = page.getViewport({ scale: 1 });
    const scale = (containerWidth * (window.devicePixelRatio || 1)) / unscaledVp.width;
    const viewport = page.getViewport({ scale });

    const c = document.createElement('canvas');
    c.width = viewport.width;
    c.height = viewport.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;

    container.innerHTML = '';
    container.appendChild(c);
  } catch (err) {
    console.warn(`[Reader] Failed to render scroll page ${pageNum}:`, err);
  }
}

/**
 * Debounced scroll handler that determines which page is currently in view.
 */
function onScrollTrack() {
  if (scrollUpdateTimer) clearTimeout(scrollUpdateTimer);
  scrollUpdateTimer = setTimeout(() => {
    if (!scrollContainer || !pdfDoc) return;

    const area = document.getElementById('reader-canvas-area');
    const areaRect = area.getBoundingClientRect();
    const centerY = areaRect.top + areaRect.height / 2;

    let closestPage = currentPage;
    let closestDist = Infinity;

    for (const child of scrollContainer.children) {
      const rect = child.getBoundingClientRect();
      const childCenter = rect.top + rect.height / 2;
      const dist = Math.abs(childCenter - centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = parseInt(child.dataset.pageNum);
      }
    }

    if (closestPage !== currentPage) {
      const ppm = leavePage(currentPage);
      if (ppm !== null) updateBookProgress(currentBook.id, currentPage, ppm);
      currentPage = closestPage;
      enterPage(currentPage);
      updateBookProgress(currentBook.id, currentPage, null);
      getBook(currentBook.id).then((b) => { if (b) currentBook = b; });
      updateUI();
    }
  }, 150);
}

/**
 * Clean up scroll mode elements and observers.
 */
function cleanupScrollMode() {
  const area = document.getElementById('reader-canvas-area');
  area.classList.remove('scroll-mode');
  area.removeEventListener('scroll', onScrollTrack);

  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  if (scrollContainer) { scrollContainer.remove(); scrollContainer = null; }
  if (scrollUpdateTimer) { clearTimeout(scrollUpdateTimer); scrollUpdateTimer = null; }

  pageContainer.style.display = '';
  isScrollMode = false;
}

/**
 * Navigate to next or previous page with transition.
 */
async function goPage(direction) {
  if (rendering || isScrollMode) return; // scroll mode uses native scroll
  const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
  if (targetPage < 1 || targetPage > totalPages) return;

  rendering = true;

  // Track reading speed
  const ppm = leavePage(currentPage);
  if (ppm !== null) {
    await updateBookProgress(currentBook.id, currentPage, ppm);
    // Refresh book meta for avgPPM
    currentBook = await getBook(currentBook.id);
  }

  const prevPage = currentPage;
  currentPage = targetPage;

  await transition(canvas, pageContainer, settings.transition, direction, () => renderPage(currentPage));

  enterPage(currentPage);
  await updateBookProgress(currentBook.id, currentPage, null);
  currentBook = await getBook(currentBook.id);

  rendering = false;
}

/**
 * Jump directly to a specific page (no transition animation).
 */
async function jumpToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages) return;

  // In scroll mode, just scroll to the target page element
  if (isScrollMode && scrollContainer) {
    const target = scrollContainer.children[pageNum - 1];
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (rendering || pageNum === currentPage) return;
  rendering = true;
  const ppm = leavePage(currentPage);
  if (ppm !== null) {
    await updateBookProgress(currentBook.id, currentPage, ppm);
  }

  currentPage = pageNum;
  await renderPage(currentPage);
  enterPage(currentPage);
  await updateBookProgress(currentBook.id, currentPage, null);
  currentBook = await getBook(currentBook.id);
  rendering = false;
}

/**
 * Update progress bar, page info, and time remaining.
 */
function updateUI() {
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  readerPageInfo.textContent = `${currentPage} / ${totalPages}`;
  readerProgressText.textContent = `${progress}%`;

  // Time remaining
  const pagesLeft = totalPages - currentPage;
  const avgPPM = currentBook?.avgPPM || 0;
  readerTimeRemaining.textContent = formatTimeRemaining(pagesLeft, avgPPM);
}

/**
 * Close the reader and return to library.
 */
function closeReader() {
  const ppm = leavePage(currentPage);
  if (currentBook && ppm !== null) {
    updateBookProgress(currentBook.id, currentPage, ppm);
  } else if (currentBook) {
    updateBookProgress(currentBook.id, currentPage, null);
  }

  // Clean up scroll mode if active
  if (isScrollMode) cleanupScrollMode();

  readerView.classList.remove('active');
  // Restore the main app header and library view
  document.getElementById('app-header').style.display = '';
  document.getElementById('library-view').style.display = '';
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  currentBook = null;
  if (onClose) onClose();
}

// Touch handlers for swipe
function onTouchStart(e) {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}

function onTouchEnd(e) {
  if (isScrollMode) return; // scroll mode uses native scroll
  if (e.changedTouches.length !== 1) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  // Must be a fast horizontal swipe (not a vertical scroll)
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && elapsed < 500) {
    e.preventDefault();
    if (dx < 0) goPage('next');
    else goPage('prev');
  }
}

export default { init, openBook };
