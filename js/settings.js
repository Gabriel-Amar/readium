/**
 * settings.js — Settings panel logic (theme, transitions, PDF inversion)
 */

const KEYS = {
  theme: 'readium-theme',
  transition: 'readium-transition',
  invertPdf: 'readium-invert-pdf',
};

/** Load a setting with a default fallback */
function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

/** Current settings state */
export const state = {
  theme: load(KEYS.theme, 'dark'),
  transition: load(KEYS.transition, 'slide'),
  invertPdf: load(KEYS.invertPdf, 'false') === 'true',
};

/** Apply theme to the document */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'dark' ? '#000000' : '#F5F5F5');
}

/** Apply PDF inversion */
function applyInvert() {
  if (state.invertPdf) {
    document.documentElement.setAttribute('data-invert-pdf', 'true');
  } else {
    document.documentElement.removeAttribute('data-invert-pdf');
  }
}

/** Initialize settings UI and event listeners */
export function init() {
  const themeToggle = document.getElementById('theme-toggle');
  const invertToggle = document.getElementById('invert-toggle');
  const transitionGroup = document.getElementById('transition-group');
  const settingsBtn = document.getElementById('settings-btn');
  const readerSettingsBtn = document.getElementById('reader-settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');

  // Apply initial state
  applyTheme();
  applyInvert();

  // Sync toggle states
  themeToggle.classList.toggle('active', state.theme === 'dark');
  invertToggle.classList.toggle('active', state.invertPdf);
  transitionGroup.querySelectorAll('.radio-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === state.transition);
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    themeToggle.classList.toggle('active', state.theme === 'dark');
    save(KEYS.theme, state.theme);
    applyTheme();
  });

  // Invert PDF toggle
  invertToggle.addEventListener('click', () => {
    state.invertPdf = !state.invertPdf;
    invertToggle.classList.toggle('active', state.invertPdf);
    save(KEYS.invertPdf, String(state.invertPdf));
    applyInvert();
  });

  // Transition radio
  transitionGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.radio-option');
    if (!btn) return;
    state.transition = btn.dataset.value;
    save(KEYS.transition, state.transition);
    transitionGroup.querySelectorAll('.radio-option').forEach((b) => b.classList.toggle('active', b === btn));
  });

  // Open/close settings
  function openSettings() {
    settingsOverlay.classList.add('active');
    settingsPanel.classList.add('active');
  }
  function closeSettings() {
    settingsOverlay.classList.remove('active');
    settingsPanel.classList.remove('active');
  }

  settingsBtn.addEventListener('click', openSettings);
  readerSettingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', closeSettings);
}

export default { init, state };
