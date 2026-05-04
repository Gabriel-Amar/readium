/**
 * toc.js — Table of Contents parser and sidebar controller
 * Extracts PDF outline (bookmarks) via PDF.js and renders a clickable nav.
 */

let pdfDoc = null;
let onNavigate = null;

/**
 * Initialize the TOC sidebar with a loaded PDF document.
 * @param {PDFDocumentProxy} pdf - The loaded PDF.js document
 * @param {function} navigateCallback - Called with page number when a TOC item is clicked
 */
export async function init(pdf, navigateCallback) {
  pdfDoc = pdf;
  onNavigate = navigateCallback;

  const tocList = document.getElementById('toc-list');
  const tocBtn = document.getElementById('toc-btn');
  const tocClose = document.getElementById('toc-close');
  const tocOverlay = document.getElementById('toc-overlay');
  const tocPanel = document.getElementById('toc-panel');

  // Parse outline
  const outline = await pdf.getOutline();
  tocList.innerHTML = '';

  if (!outline || outline.length === 0) {
    tocList.innerHTML = '<li class="toc-empty">No table of contents available for this document.</li>';
  } else {
    await buildTocTree(outline, tocList, 0);
  }

  // Event listeners
  function openToc() {
    tocOverlay.classList.add('active');
    tocPanel.classList.add('active');
  }
  function closeToc() {
    tocOverlay.classList.remove('active');
    tocPanel.classList.remove('active');
  }

  tocBtn.onclick = openToc;
  tocClose.onclick = closeToc;
  tocOverlay.onclick = closeToc;
}

/**
 * Recursively build the TOC tree.
 */
async function buildTocTree(items, parentEl, depth) {
  for (const item of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = `toc-item depth-${depth}`;
    btn.textContent = item.title;

    // Resolve destination to page number
    btn.addEventListener('click', async () => {
      try {
        let pageIndex = 0;
        if (item.dest) {
          const dest = typeof item.dest === 'string'
            ? await pdfDoc.getDestination(item.dest)
            : item.dest;
          if (dest) {
            const ref = dest[0];
            pageIndex = await pdfDoc.getPageIndex(ref);
          }
        }
        if (onNavigate) onNavigate(pageIndex + 1); // 1-indexed

        // Close sidebar
        document.getElementById('toc-overlay').classList.remove('active');
        document.getElementById('toc-panel').classList.remove('active');
      } catch (err) {
        console.warn('[TOC] Failed to resolve destination:', err);
      }
    });

    li.appendChild(btn);
    parentEl.appendChild(li);

    // Recurse into children
    if (item.items && item.items.length > 0) {
      await buildTocTree(item.items, parentEl, depth + 1);
    }
  }
}

export default { init };
