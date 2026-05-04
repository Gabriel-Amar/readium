/**
 * db.js — IndexedDB persistence layer using localForage
 * Manages two stores: book metadata and raw PDF file data.
 */

const metaStore = localforage.createInstance({
  name: 'readium',
  storeName: 'library',
  description: 'Book metadata (title, progress, cover, etc.)',
});

const fileStore = localforage.createInstance({
  name: 'readium',
  storeName: 'files',
  description: 'Raw PDF ArrayBuffer data',
});

/** Generate a short unique ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Add a new book to the library.
 * @param {File} file - The PDF File object
 * @param {string} coverDataUrl - Base64 data URL of the generated cover thumbnail
 * @param {number} totalPages - Total page count from PDF.js
 * @returns {Promise<object>} The saved book metadata
 */
export async function addBook(file, coverDataUrl, totalPages) {
  const id = generateId();
  const arrayBuffer = await file.arrayBuffer();

  const meta = {
    id,
    title: file.name.replace(/\.pdf$/i, ''),
    fileName: file.name,
    totalPages,
    lastPage: 1,
    addedAt: Date.now(),
    coverDataUrl,
    readingSpeeds: [],    // Array of pages-per-minute samples
    avgPPM: 0,
  };

  await fileStore.setItem(id, arrayBuffer);
  await metaStore.setItem(id, meta);
  return meta;
}

/**
 * Get all book metadata entries.
 * @returns {Promise<object[]>}
 */
export async function getAllBooks() {
  const books = [];
  await metaStore.iterate((value) => {
    books.push(value);
  });
  // Sort by most recently added
  books.sort((a, b) => b.addedAt - a.addedAt);
  return books;
}

/**
 * Get a single book's metadata.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getBook(id) {
  return metaStore.getItem(id);
}

/**
 * Get the raw PDF ArrayBuffer for a book.
 * @param {string} id
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function getFileData(id) {
  return fileStore.getItem(id);
}

/**
 * Update reading progress for a book.
 * @param {string} id
 * @param {number} page - Current page number
 * @param {number|null} ppm - Pages per minute reading speed sample
 */
export async function updateBookProgress(id, page, ppm = null) {
  const meta = await metaStore.getItem(id);
  if (!meta) return;

  meta.lastPage = page;

  if (ppm !== null && ppm > 0 && isFinite(ppm)) {
    meta.readingSpeeds.push(ppm);
    // Keep only last 20 samples
    if (meta.readingSpeeds.length > 20) {
      meta.readingSpeeds = meta.readingSpeeds.slice(-20);
    }
    meta.avgPPM = meta.readingSpeeds.reduce((a, b) => a + b, 0) / meta.readingSpeeds.length;
  }

  await metaStore.setItem(id, meta);
}

/**
 * Delete a book and its file data.
 * @param {string} id
 */
export async function deleteBook(id) {
  await metaStore.removeItem(id);
  await fileStore.removeItem(id);
}

export default { addBook, getAllBooks, getBook, getFileData, updateBookProgress, deleteBook };
