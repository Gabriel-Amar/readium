/**
 * analytics.js — Reading speed tracking and time-remaining estimation
 */

let pageTimestamps = {};   // { pageNum: enterTimestamp }
let currentPage = null;

/**
 * Record that the user entered a page.
 * @param {number} page
 */
export function enterPage(page) {
  currentPage = page;
  pageTimestamps[page] = Date.now();
}

/**
 * Calculate reading speed when leaving a page.
 * Returns pages-per-minute or null if data is insufficient.
 * @param {number} page - The page being left
 * @returns {number|null}
 */
export function leavePage(page) {
  const enterTime = pageTimestamps[page];
  if (!enterTime) return null;

  const elapsed = (Date.now() - enterTime) / 1000; // seconds

  // Ignore if spent less than 3 seconds or more than 10 minutes (likely idle)
  if (elapsed < 3 || elapsed > 600) return null;

  const ppm = 60 / elapsed; // pages per minute
  delete pageTimestamps[page];
  return ppm;
}

/**
 * Format time remaining as a human-readable string.
 * @param {number} pagesLeft - Number of pages remaining
 * @param {number} avgPPM - Average pages per minute
 * @returns {string}
 */
export function formatTimeRemaining(pagesLeft, avgPPM) {
  if (!avgPPM || avgPPM <= 0 || !isFinite(avgPPM)) return '';

  const minutesLeft = pagesLeft / avgPPM;

  if (minutesLeft < 1) return '< 1 min left';
  if (minutesLeft < 60) return `~${Math.round(minutesLeft)} min left`;

  const hours = Math.floor(minutesLeft / 60);
  const mins = Math.round(minutesLeft % 60);
  if (mins === 0) return `~${hours} hr left`;
  return `~${hours} hr ${mins} min left`;
}

export default { enterPage, leavePage, formatTimeRemaining };
