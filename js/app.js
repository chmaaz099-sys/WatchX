/**
 * WatchX - Core Application Controller
 * The Ultimate Pure Black Monochrome Movie Streaming Platform.
 * Features:
 * - 100% Strict Pure Black Monochrome Theme (No red, blue, green, purple, orange, etc.)
 * - Real User Accounts, Profiles & Supabase Cloud PostgreSQL Sync
 * - 4-Digit Profile PIN Cryptographic Protection
 * - 10,000+ Movies & TV Shows Discovery Engine
 * - Profile-Isolated Watchlists & Precision Stopped Playback
 * - Clutter-Free Cinema Player (Zero technical badges or provider spam)
 */

import * as api from './api.js?v=20';
import { player } from './player.js?v=20';
import { dbClient } from './supabase-client.js?v=20';
import { authManager } from './auth.js?v=20';

// Global App State
const state = {
  currentTab: 'home',
  spotlightItems: [],
  currentSpotlightIndex: 0,
  spotlightTimer: null,
  activeDetailMedia: null,
  activeDetailFullData: null,
  searchTimeout: null,
  soundEnabled: localStorage.getItem('watchx_sound_enabled') === 'true',

  // Catalog State
  catalogMode: 'movies', // 'movies' or 'tv'
  catalogPage: 1,
  catalogGenre: '',
  catalogYear: '',
  catalogSort: 'popularity.desc',
  catalogLoading: false,
  catalogHasMore: true,

  // Search History
  recentSearches: JSON.parse(localStorage.getItem('watchx_recent_searches') || '["Inception", "Dune", "Interstellar", "Arcane", "Batman"]')
};

// ==========================================================================
// Web Audio API Cinematic Synthesizer (Monochrome Acoustic Feedback)
// ==========================================================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTaDum() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.exponentialRampToValueAtTime(40, now + 0.8);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(220, now + 0.08);
      osc2.frequency.linearRampToValueAtTime(260, now + 0.9);
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 1.4);
    } catch (e) {}
  }

  playClick() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}

const soundFX = new SoundFX();

// ==========================================================================
// 240Hz Extreme Performance & Real-Time Frame Rate Engine
// High-resolution RAF timestamp tracking (Supports 60Hz, 120Hz, 144Hz, 165Hz, 240Hz)
// ==========================================================================
class WatchXPerformanceEngine {
  constructor() {
    this.hudElement = null;
    this.fpsValueEl = null;
    this.frametimeValueEl = null;
    this.refreshRateValueEl = null;
    this.fpsToggleCheckbox = null;
    this.isEnabled = false;
    this.rafId = null;

    // Refresh rate calibration (measures native display Hz over first 40 frames)
    this.detectedHz = 60;
    this.isCalibrated = false;

    // Moving average FPS calculation
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.lastFpsUpdate = performance.now();
  }

  init() {
    this.hudElement = document.getElementById('performance-hud');
    this.fpsValueEl = document.getElementById('hud-fps');
    this.frametimeValueEl = document.getElementById('hud-frametime');
    this.refreshRateValueEl = document.getElementById('hud-refreshrate');
    this.fpsToggleCheckbox = document.getElementById('settings-fps-toggle');

    const closeBtn = document.getElementById('hud-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggle(false));
    }

    if (this.fpsToggleCheckbox) {
      this.fpsToggleCheckbox.addEventListener('change', (e) => {
        this.toggle(e.target.checked);
      });
    }

    // Keyboard shortcut Shift + F to toggle HUD
    window.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        e.preventDefault();
        this.toggle(!this.isEnabled);
      }
    });

    // Start background refresh calibration
    this.calibrateRefreshRate();
  }

  calibrateRefreshRate() {
    let frameTimes = [];
    let last = performance.now();

    const sample = (now) => {
      const delta = now - last;
      last = now;
      if (delta > 0 && delta < 100) {
        frameTimes.push(delta);
      }

      if (frameTimes.length < 40) {
        requestAnimationFrame(sample);
      } else {
        frameTimes = frameTimes.slice(5);
        const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const rawHz = Math.round(1000 / avgDelta);

        if (rawHz >= 230) this.detectedHz = 240;
        else if (rawHz >= 160) this.detectedHz = 165;
        else if (rawHz >= 140) this.detectedHz = 144;
        else if (rawHz >= 115) this.detectedHz = 120;
        else if (rawHz >= 70) this.detectedHz = 75;
        else this.detectedHz = 60;

        this.isCalibrated = true;
        if (this.refreshRateValueEl) {
          this.refreshRateValueEl.textContent = `${this.detectedHz} Hz`;
        }
      }
    };

    requestAnimationFrame(sample);
  }

  toggle(enable) {
    this.isEnabled = enable;
    if (this.fpsToggleCheckbox) {
      this.fpsToggleCheckbox.checked = this.isEnabled;
    }

    if (this.hudElement) {
      this.hudElement.style.display = this.isEnabled ? 'block' : 'none';
    }

    if (this.isEnabled) {
      this.lastTime = performance.now();
      this.lastFpsUpdate = performance.now();
      this.frameCount = 0;
      this.startLoop();
    } else {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  startLoop() {
    const loop = (now) => {
      if (!this.isEnabled) return;
      this.frameCount++;
      const frameDelta = now - this.lastTime;
      this.lastTime = now;

      // Update HUD metrics every 200ms for high-frequency responsiveness
      if (now - this.lastFpsUpdate >= 200) {
        const elapsed = (now - this.lastFpsUpdate) / 1000;
        const currentFps = Math.min(240, Math.round(this.frameCount / elapsed));
        const frameTimeMs = frameDelta.toFixed(2);

        if (this.fpsValueEl) {
          this.fpsValueEl.textContent = `${currentFps} FPS`;
        }
        if (this.frametimeValueEl) {
          this.frametimeValueEl.textContent = `${frameTimeMs} ms`;
        }
        if (this.refreshRateValueEl) {
          this.refreshRateValueEl.textContent = `${this.detectedHz} Hz`;
        }

        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }
}

export const performanceEngine = new WatchXPerformanceEngine();

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  player.init();
  performanceEngine.init();
  await authManager.init();
  setupNavigation();
  setupHeaderControls();
  setupDetailModal();
  setupSettingsView();
  setupShortcuts();
  setupEventListeners();

  // Load Initial Tab
  switchTab('home');
});

// ==========================================================================
// Navigation & Routing
// ==========================================================================
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  const brandLogo = document.getElementById('brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('home');
    });
  }

  window.addEventListener('watchx:navigate', (e) => {
    if (e.detail) switchTab(e.detail);
  });
}

function switchTab(tabName) {
  state.currentTab = tabName;
  soundFX.playClick();

  // Update Nav links
  document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });

  // Hide all view panes
  const panes = ['home-view', 'catalog-view', 'categories-view', 'mylist-view', 'search-view', 'settings-view'];
  panes.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  switch (tabName) {
    case 'home':
      document.getElementById('home-view').style.display = 'block';
      loadHomeContent();
      break;
    case 'movies':
      state.catalogMode = 'movies';
      document.getElementById('catalog-view').style.display = 'block';
      document.getElementById('catalog-main-title').textContent = '10,000+ Movies Catalog';
      resetCatalogFilters();
      loadCatalog();
      break;
    case 'tv':
      state.catalogMode = 'tv';
      document.getElementById('catalog-view').style.display = 'block';
      document.getElementById('catalog-main-title').textContent = 'TV Series & Shows';
      resetCatalogFilters();
      loadCatalog();
      break;
    case 'categories':
      document.getElementById('categories-view').style.display = 'block';
      loadCategoriesView();
      break;
    case 'mylist':
      document.getElementById('mylist-view').style.display = 'block';
      loadWatchlistView();
      break;
    case 'search':
      document.getElementById('search-view').style.display = 'block';
      renderRecentSearches();
      break;
    case 'settings':
      document.getElementById('settings-view').style.display = 'block';
      refreshSettingsView();
      break;
  }
}

// ==========================================================================
// Header Controls & Search
// ==========================================================================
function setupHeaderControls() {
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Sound Toggle Button
  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    updateSoundBtnIcon();
    soundBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('watchx_sound_enabled', state.soundEnabled ? 'true' : 'false');
      updateSoundBtnIcon();
      if (state.soundEnabled) soundFX.playTaDum();
    });
  }

  // Header Search Input
  const searchInput = document.getElementById('header-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q.length > 0) {
        if (state.currentTab !== 'search') {
          switchTab('search');
        }
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(() => performSearch(q), 300);
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          saveRecentSearch(q);
          performSearch(q);
        }
      }
    });
  }
}

function updateSoundBtnIcon() {
  const btn = document.getElementById('sound-toggle-btn');
  if (btn) {
    btn.innerHTML = state.soundEnabled
      ? '<i class="fas fa-volume-high"></i>'
      : '<i class="fas fa-volume-xmark"></i>';
  }
  const check = document.getElementById('settings-sound-toggle');
  if (check) check.checked = state.soundEnabled;
}

// ==========================================================================
// Home Content & Spotlight
// ==========================================================================
let homeLoaded = false;
async function loadHomeContent() {
  if (homeLoaded) {
    // Refresh Continue Watching row for active profile
    await renderContinueWatchingRow();
    return;
  }
  homeLoaded = true;

  try {
    // Fetch Spotlight and Trending items
    const trending = await api.getTrending('day');
    state.spotlightItems = trending.slice(0, 5);
    renderSpotlight();
    startSpotlightRotation();

    // Fetch Content Rows
    const container = document.getElementById('carousel-rows-container');
    container.innerHTML = '';

    // 1. Profile Continue Watching
    const cwRow = document.createElement('div');
    cwRow.id = 'row-continue-watching';
    container.appendChild(cwRow);
    await renderContinueWatchingRow();

    // 2. Trending Now
    appendContentRow(container, 'Trending Now', trending);

    // 3. Popular Movies
    const popularMovies = await api.getPopularMovies();
    appendContentRow(container, 'Popular Movies', popularMovies);

    // 4. Popular TV Series
    const popularTV = await api.getPopularTV();
    appendContentRow(container, 'Popular TV Shows', popularTV);

    // 5. Top Rated
    const topRated = await api.getTopRatedMovies();
    appendContentRow(container, 'Top Rated Cinema', topRated);

    // 6. Action
    const actionMovies = await api.getByGenre('movie', 28);
    appendContentRow(container, 'High-Octane Action', actionMovies);

    // 7. Sci-Fi & Fantasy
    const sciFiMovies = await api.getByGenre('movie', 878);
    appendContentRow(container, 'Sci-Fi & Cyberpunk Worlds', sciFiMovies);

    // 8. Top Anime
    const anime = await api.getTopAnime();
    appendContentRow(container, 'Top Anime Hits', anime);

    // 9. Horror & Suspense
    const horror = await api.getByGenre('movie', 27);
    appendContentRow(container, 'Horror & Psychological Thrillers', horror);

    // 10. Comedy
    const comedy = await api.getByGenre('movie', 35);
    appendContentRow(container, 'Comedy & Lighthearted', comedy);

    // 11. Documentaries
    const docs = await api.getByGenre('movie', 99);
    appendContentRow(container, 'Critically Acclaimed Documentaries', docs);

  } catch (err) {
    console.error('[WatchX] Failed to load home content:', err);
  }
}

// ==========================================================================
// Profile Continue Watching Row (Non-Random Playback Tracking)
// ==========================================================================
async function renderContinueWatchingRow() {
  const rowEl = document.getElementById('row-continue-watching');
  if (!rowEl) return;

  const profile = authManager.getActiveProfile();
  if (!profile) {
    rowEl.innerHTML = '';
    return;
  }

  const history = await dbClient.getWatchHistory(profile.id);
  if (!history || history.length === 0) {
    rowEl.innerHTML = '';
    return;
  }

  rowEl.innerHTML = `
    <div class="content-row">
      <div class="row-header">
        <h3 class="row-title"><i class="fas fa-play"></i> Continue Watching for ${profile.name}</h3>
      </div>
      <div class="carousel-viewport">
        <div class="carousel-track" id="cw-track"></div>
      </div>
    </div>
  `;

  const track = rowEl.querySelector('#cw-track');
  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';

    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : api.getFallbackPoster(item.title);
    const stoppedMins = Math.floor(item.stopped_at_seconds / 60);
    const stoppedSecs = Math.floor(item.stopped_at_seconds % 60).toString().padStart(2, '0');
    const percent = item.progress_percent || Math.round((item.stopped_at_seconds / Math.max(1, item.duration_seconds)) * 100);

    card.innerHTML = `
      <div class="card-poster-wrap">
        <img class="card-poster-img" src="${poster}" alt="${item.title}" loading="lazy">
        <div class="cw-progress-bar">
          <div class="cw-progress-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="cw-stopped-badge">
          <span><i class="fas fa-clock"></i> ${stoppedMins}:${stoppedSecs}</span>
          <span>${percent}%</span>
        </div>
        <div class="card-hover-actions">
          <button class="card-action-btn btn-cw-play" title="Resume"><i class="fas fa-play"></i></button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${item.title}</div>
        <div class="card-subtext">
          <span>${item.media_type === 'tv' ? (item.episode_title || 'TV Series') : 'Feature Film'}</span>
          <span>Resume</span>
        </div>
      </div>
    `;

    // Click to play and resume
    card.addEventListener('click', () => {
      soundFX.playTaDum();
      player.play({
        id: item.media_id,
        title: item.title,
        media_type: item.media_type,
        poster_path: item.poster_path
      }, item.season_number || 1, item.episode_number || 1);
    });

    track.appendChild(card);
  });
}

// Content Row Helper
// ==========================================================================
// 240Hz High Refresh Rate RAF Smooth Scroller
// Dynamically synchronizes to monitor refresh rate (60Hz, 120Hz, 144Hz, 165Hz, 240Hz)
// ==========================================================================
function smoothScrollCarousel(element, distance, duration = 320) {
  if (!element) return;
  const start = element.scrollLeft;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Liquid quartic ease-out for 240 FPS rendering
    const ease = 1 - Math.pow(1 - progress, 4);
    element.scrollLeft = start + distance * ease;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function appendContentRow(container, title, items) {
  if (!items || items.length === 0) return;

  const row = document.createElement('div');
  row.className = 'content-row';

  row.innerHTML = `
    <div class="row-header">
      <h3 class="row-title">${title}</h3>
      <a href="#" class="row-view-all" onclick="document.querySelector('.nav-link[data-tab=\\'movies\\']').click(); return false;">Explore</a>
    </div>
    <div class="carousel-viewport-wrapper">
      <button class="carousel-nav-btn prev" aria-label="Scroll left"><i class="fas fa-chevron-left"></i></button>
      <div class="carousel-viewport">
        <div class="carousel-track">
          ${items.map(item => createCardMarkup(item)).join('')}
        </div>
      </div>
      <button class="carousel-nav-btn next" aria-label="Scroll right"><i class="fas fa-chevron-right"></i></button>
    </div>
  `;

  const viewport = row.querySelector('.carousel-viewport');
  const prevBtn = row.querySelector('.carousel-nav-btn.prev');
  const nextBtn = row.querySelector('.carousel-nav-btn.next');

  if (prevBtn && viewport) {
    prevBtn.addEventListener('click', () => {
      soundFX.playClick();
      smoothScrollCarousel(viewport, -650, 320);
    });
  }

  if (nextBtn && viewport) {
    nextBtn.addEventListener('click', () => {
      soundFX.playClick();
      smoothScrollCarousel(viewport, 650, 320);
    });
  }

  // Attach card click handlers
  row.querySelectorAll('.media-card').forEach((card, idx) => {
    const item = items[idx];
    card.addEventListener('click', () => openDetailModal(item));

    const playBtn = card.querySelector('.btn-card-quick-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundFX.playTaDum();
        player.play(item);
      });
    }

    const listBtn = card.querySelector('.btn-card-quick-list');
    if (listBtn) {
      listBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        soundFX.playClick();
        const profile = authManager.getActiveProfile();
        if (profile) {
          await dbClient.addToWatchlist(profile.id, item);
          listBtn.innerHTML = '<i class="fas fa-check"></i>';
        }
      });
    }
  });

  container.appendChild(row);
}

function createCardMarkup(item) {
  const title = item.display_title || item.title || item.name || 'Title';
  const year = item.display_year || (item.release_date || item.first_air_date || '').substring(0, 4) || '2024';
  const rating = item.vote_average ? `${Math.round(item.vote_average * 10)}%` : '95%';
  const poster = item.poster_src || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : api.getFallbackPoster(title));

  return `
    <div class="media-card" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
      <div class="card-poster-wrap">
        <img class="card-poster-img" src="${poster}" alt="${title}" loading="lazy" decoding="async">
        <div class="card-spec-tag">1080p</div>
        <div class="card-hover-actions">
          <button class="card-action-btn btn-card-quick-play" title="Play"><i class="fas fa-play"></i></button>
          <button class="card-action-btn btn-card-quick-list" title="Add to List"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${title}</div>
        <div class="card-subtext">
          <span>${year}</span>
          <span><i class="fas fa-star" style="font-size: 10px;"></i> ${rating}</span>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// Hero Spotlight
// ==========================================================================
function renderSpotlight() {
  if (state.spotlightItems.length === 0) return;
  const item = state.spotlightItems[state.currentSpotlightIndex];
  if (!item) return;

  const titleEl = document.getElementById('spotlight-title');
  const descEl = document.getElementById('spotlight-desc');
  const bgEl = document.getElementById('spotlight-bg');
  const matchEl = document.getElementById('spotlight-match');
  const yearEl = document.getElementById('spotlight-year');

  if (titleEl) titleEl.textContent = item.display_title || item.title || item.name;
  if (descEl) descEl.textContent = item.overview || 'Streaming now in full cinematic quality on WatchX.';
  if (matchEl) matchEl.textContent = `${item.rating_percentage || 98}% Match`;
  if (yearEl) yearEl.textContent = item.display_year || '2024';

  if (bgEl && item.backdrop_path) {
    bgEl.src = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
  }

  // Spotlight Buttons
  const playBtn = document.getElementById('spotlight-play');
  if (playBtn) {
    playBtn.onclick = () => {
      soundFX.playTaDum();
      player.play(item);
    };
  }

  const infoBtn = document.getElementById('spotlight-info');
  if (infoBtn) {
    infoBtn.onclick = () => openDetailModal(item);
  }

  const listBtn = document.getElementById('spotlight-list');
  if (listBtn) {
    listBtn.onclick = async () => {
      soundFX.playClick();
      const profile = authManager.getActiveProfile();
      if (profile) {
        await dbClient.addToWatchlist(profile.id, item);
        listBtn.innerHTML = '<i class="fas fa-check"></i> In List';
      }
    };
  }
}

function startSpotlightRotation() {
  if (state.spotlightTimer) clearInterval(state.spotlightTimer);
  state.spotlightTimer = setInterval(() => {
    if (state.spotlightItems.length > 1 && !player.isOpen()) {
      state.currentSpotlightIndex = (state.currentSpotlightIndex + 1) % state.spotlightItems.length;
      renderSpotlight();
    }
  }, 12000);
}

// ==========================================================================
// Catalog View (10,000+ Movies & TV Shows with Filters & Pagination)
// ==========================================================================
function resetCatalogFilters() {
  state.catalogPage = 1;
  state.catalogGenre = '';
  state.catalogYear = '';
  state.catalogSort = 'popularity.desc';
  state.catalogHasMore = true;

  const g = document.getElementById('catalog-genre-filter');
  if (g) g.value = '';
  const y = document.getElementById('catalog-year-filter');
  if (y) y.value = '';
  const s = document.getElementById('catalog-sort-filter');
  if (s) s.value = 'popularity.desc';
}

async function loadCatalog(append = false) {
  if (state.catalogLoading) return;
  state.catalogLoading = true;

  const grid = document.getElementById('catalog-grid');
  const countEl = document.getElementById('catalog-count');
  const loadMoreBtn = document.getElementById('catalog-loadmore');

  if (!append && grid) {
    grid.innerHTML = '<div class="player-spinner" style="grid-column: 1/-1; height: 200px;"><div class="spinner-icon"></div></div>';
  }

  try {
    const res = await api.discoverMovies({
      page: state.catalogPage,
      genre: state.catalogGenre,
      year: state.catalogYear,
      sortBy: state.catalogSort
    });

    if (countEl) countEl.textContent = `Showing 10,000+ verified titles (Page ${state.catalogPage} of ${res.totalPages})`;

    if (!append && grid) grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    res.items.forEach(item => {
      const card = document.createElement('div');
      card.innerHTML = createCardMarkup(item);
      const cardEl = card.firstElementChild;
      cardEl.addEventListener('click', () => openDetailModal(item));
      fragment.appendChild(cardEl);
    });
    grid.appendChild(fragment);

    state.catalogHasMore = state.catalogPage < res.totalPages;
    if (loadMoreBtn) {
      loadMoreBtn.style.display = state.catalogHasMore ? 'block' : 'none';
      loadMoreBtn.textContent = `Load More Titles (+20)`;
    }
  } catch (err) {
    console.error('[WatchX] Catalog load error:', err);
  } finally {
    state.catalogLoading = false;
  }
}

// Catalog Filter Listeners
const genreFilter = document.getElementById('catalog-genre-filter');
if (genreFilter) {
  genreFilter.addEventListener('change', () => {
    state.catalogGenre = genreFilter.value;
    state.catalogPage = 1;
    loadCatalog(false);
  });
}

const yearFilter = document.getElementById('catalog-year-filter');
if (yearFilter) {
  yearFilter.addEventListener('change', () => {
    state.catalogYear = yearFilter.value;
    state.catalogPage = 1;
    loadCatalog(false);
  });
}

const sortFilter = document.getElementById('catalog-sort-filter');
if (sortFilter) {
  sortFilter.addEventListener('change', () => {
    state.catalogSort = sortFilter.value;
    state.catalogPage = 1;
    loadCatalog(false);
  });
}

const loadMoreBtn = document.getElementById('catalog-loadmore');
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    if (state.catalogHasMore && !state.catalogLoading) {
      state.catalogPage++;
      loadCatalog(true);
    }
  });
}

// ==========================================================================
// Categories View
// ==========================================================================
const GENRE_CARDS = [
  { id: 28, name: 'Action', desc: 'Explosive, high-energy blockbusters' },
  { id: 878, name: 'Science Fiction', desc: 'Futuristic worlds, technology & space' },
  { id: 27, name: 'Horror', desc: 'Psychological thrills and chilling horror' },
  { id: 35, name: 'Comedy', desc: 'Laugh-out-loud comedy & feel-good cinema' },
  { id: 18, name: 'Drama', desc: 'Emotionally gripping narratives & classics' },
  { id: 16, name: 'Animation & Anime', desc: 'Stunning animated features & series' },
  { id: 99, name: 'Documentary', desc: 'Real stories, true events & nature' },
  { id: 9648, name: 'Mystery & Crime', desc: 'Detective cases, puzzles & suspense' },
  { id: 10749, name: 'Romance', desc: 'Heartfelt romance & passionate dramas' },
  { id: 14, name: 'Fantasy', desc: 'Magic, mythical lands & epic quests' }
];

function loadCategoriesView() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  grid.innerHTML = GENRE_CARDS.map(g => `
    <div class="media-card" style="padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; height: 180px; background: var(--bg-card);" data-genre="${g.id}">
      <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">${g.name}</div>
      <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${g.desc}</div>
      <div style="margin-top: 14px; font-size: 12px; font-weight: 600; color: var(--text-primary);"><i class="fas fa-arrow-right"></i> Explore Genre</div>
    </div>
  `).join('');

  grid.querySelectorAll('.media-card').forEach((card, idx) => {
    card.addEventListener('click', () => {
      const g = GENRE_CARDS[idx];
      state.catalogGenre = g.id.toString();
      state.catalogPage = 1;
      state.catalogMode = 'movies';
      switchTab('movies');
      const filterSelect = document.getElementById('catalog-genre-filter');
      if (filterSelect) filterSelect.value = g.id.toString();
      loadCatalog(false);
    });
  });
}

// ==========================================================================
// My List (Personal Watchlist per Profile)
// ==========================================================================
async function loadWatchlistView() {
  const grid = document.getElementById('mylist-grid');
  const emptyState = document.getElementById('mylist-empty-state');
  const countEl = document.getElementById('mylist-count');
  const profile = authManager.getActiveProfile();

  if (!profile) return;
  const list = await dbClient.getWatchlist(profile.id);

  if (countEl) countEl.textContent = `${list.length} Title${list.length === 1 ? '' : 's'} Saved`;

  if (!list || list.length === 0) {
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (grid) {
    grid.innerHTML = '';
    list.forEach(item => {
      const card = document.createElement('div');
      card.innerHTML = createCardMarkup(item);
      const cardEl = card.firstElementChild;
      cardEl.addEventListener('click', () => openDetailModal(item));

      // Quick remove button
      const actions = cardEl.querySelector('.card-hover-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="card-action-btn btn-remove-wl" title="Remove from My List"><i class="fas fa-trash"></i></button>
          <button class="card-action-btn btn-card-quick-play" title="Play"><i class="fas fa-play"></i></button>
        `;
        actions.querySelector('.btn-remove-wl').addEventListener('click', async (e) => {
          e.stopPropagation();
          await dbClient.removeFromWatchlist(profile.id, item.media_id || item.id, item.media_type);
          loadWatchlistView();
        });
        actions.querySelector('.btn-card-quick-play').addEventListener('click', (e) => {
          e.stopPropagation();
          soundFX.playTaDum();
          player.play(item);
        });
      }
      grid.appendChild(cardEl);
    });
  }
}

// ==========================================================================
// Search View
// ==========================================================================
async function performSearch(query) {
  const grid = document.getElementById('search-results-grid');
  if (!grid || !query) return;

  grid.innerHTML = '<div class="player-spinner" style="grid-column: 1/-1; height: 160px;"><div class="spinner-icon"></div></div>';

  try {
    const results = await api.searchMulti(query);
    grid.innerHTML = '';

    if (results.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-magnifying-glass" style="font-size: 32px; margin-bottom: 12px; color: var(--text-muted);"></i>
          <h3>No titles found matching "${query}"</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Try searching for another movie, actor, or genre.</p>
        </div>
      `;
      return;
    }

    results.forEach(item => {
      const card = document.createElement('div');
      card.innerHTML = createCardMarkup(item);
      const cardEl = card.firstElementChild;
      cardEl.addEventListener('click', () => openDetailModal(item));
      grid.appendChild(cardEl);
    });
  } catch (err) {
    console.error('[WatchX] Search error:', err);
  }
}

function saveRecentSearch(term) {
  if (!term) return;
  state.recentSearches = state.recentSearches.filter(t => t.toLowerCase() !== term.toLowerCase());
  state.recentSearches.unshift(term);
  if (state.recentSearches.length > 8) state.recentSearches = state.recentSearches.slice(0, 8);
  localStorage.setItem('watchx_recent_searches', JSON.stringify(state.recentSearches));
  renderRecentSearches();
}

function renderRecentSearches() {
  const container = document.getElementById('search-recent-chips-container');
  if (!container) return;

  container.innerHTML = state.recentSearches.map(term => `
    <button class="btn-secondary-dark search-chip" style="padding: 4px 12px; font-size: 12px; margin-right: 6px; margin-bottom: 6px;">
      ${term}
    </button>
  `).join('');

  container.querySelectorAll('.search-chip').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const term = state.recentSearches[idx];
      const searchInp = document.getElementById('header-search-input');
      if (searchInp) searchInp.value = term;
      performSearch(term);
    });
  });
}

// ==========================================================================
// Movie & TV Show Details Modal
// ==========================================================================
function setupDetailModal() {
  const closeBtn = document.getElementById('detail-modal-close');
  const modal = document.getElementById('detail-modal');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }
}

async function openDetailModal(media) {
  if (!media) return;
  state.activeDetailMedia = media;
  soundFX.playClick();

  const modal = document.getElementById('detail-modal');
  const titleEl = document.getElementById('detail-title');
  const bgEl = document.getElementById('detail-backdrop');
  const matchEl = document.getElementById('detail-match');
  const yearEl = document.getElementById('detail-year');
  const overviewEl = document.getElementById('detail-overview');
  const castEl = document.getElementById('detail-cast');
  const genresEl = document.getElementById('detail-genres');
  const playBtn = document.getElementById('detail-play-btn');
  const listBtn = document.getElementById('detail-list-btn');
  const trailerBtn = document.getElementById('detail-trailer-btn');
  const epSection = document.getElementById('detail-episodes-section');

  const title = media.display_title || media.title || media.name || 'Title';
  const year = media.display_year || (media.release_date || media.first_air_date || '').substring(0, 4) || '2024';

  if (titleEl) titleEl.textContent = title;
  if (yearEl) yearEl.textContent = year;
  if (matchEl) matchEl.textContent = `${media.rating_percentage || 96}% Match`;
  if (overviewEl) overviewEl.textContent = media.overview || 'Streaming in pristine 1080p Full HD on WatchX.';
  if (bgEl && media.backdrop_path) {
    bgEl.src = `https://image.tmdb.org/t/p/original${media.backdrop_path}`;
  }

  // Play button handler
  if (playBtn) {
    playBtn.onclick = () => {
      modal.classList.remove('active');
      soundFX.playTaDum();
      player.play(media);
    };
  }

  // Check Watchlist status
  const profile = authManager.getActiveProfile();
  if (profile && listBtn) {
    const inList = await dbClient.isInWatchlist(profile.id, media.id, media.media_type);
    listBtn.innerHTML = inList ? '<i class="fas fa-check"></i> In List' : '<i class="fas fa-plus"></i> My List';
    listBtn.onclick = async () => {
      soundFX.playClick();
      const currentInList = await dbClient.isInWatchlist(profile.id, media.id, media.media_type);
      if (currentInList) {
        await dbClient.removeFromWatchlist(profile.id, media.id, media.media_type);
        listBtn.innerHTML = '<i class="fas fa-plus"></i> My List';
      } else {
        await dbClient.addToWatchlist(profile.id, media);
        listBtn.innerHTML = '<i class="fas fa-check"></i> In List';
      }
    };
  }

  // Show modal immediately
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Fetch full details (Cast, Genres, Trailer, Episodes)
  const mediaType = media.media_type || (media.name ? 'tv' : 'movie');
  try {
    const full = await api.getMediaDetails(mediaType, media.id);
    state.activeDetailFullData = full;

    // Cast members
    if (castEl && full?.credits?.cast) {
      const topCast = full.credits.cast.slice(0, 5).map(c => c.name).join(', ');
      castEl.innerHTML = `<strong>Cast:</strong> ${topCast}`;
    }

    // Genres
    if (genresEl && full?.genres) {
      const genreNames = full.genres.map(g => g.name).join(', ');
      genresEl.innerHTML = `<strong>Genres:</strong> ${genreNames}`;
    }

    // Official Trailer
    if (trailerBtn) {
      const trailer = full?.videos?.results?.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
      if (trailer && trailer.key) {
        trailerBtn.style.display = 'inline-flex';
        trailerBtn.onclick = () => {
          modal.classList.remove('active');
          player.playTrailer(trailer.key, title);
        };
      } else {
        trailerBtn.style.display = 'none';
      }
    }

    // Similar titles
    const similarGrid = document.getElementById('detail-similar-grid');
    if (similarGrid && full?.similar?.results) {
      similarGrid.innerHTML = full.similar.results.slice(0, 6).map(s => createCardMarkup(s)).join('');
      similarGrid.querySelectorAll('.media-card').forEach((card, idx) => {
        const simItem = full.similar.results[idx];
        card.addEventListener('click', () => openDetailModal(simItem));
      });
    }

    // TV Episodes
    if (mediaType === 'tv' && full?.seasons && full.seasons.length > 0) {
      if (epSection) epSection.style.display = 'block';
      const seasonSelect = document.getElementById('detail-season-select');
      if (seasonSelect) {
        seasonSelect.innerHTML = full.seasons
          .filter(s => s.season_number > 0)
          .map(s => `<option value="${s.season_number}">${s.name || `Season ${s.season_number}`} (${s.episode_count} eps)</option>`)
          .join('');

        seasonSelect.onchange = () => loadSeasonEpisodes(media.id, seasonSelect.value);
        loadSeasonEpisodes(media.id, seasonSelect.value || 1);
      }
    } else {
      if (epSection) epSection.style.display = 'none';
    }

  } catch (err) {
    console.warn('[WatchX] Failed to fetch full details:', err);
  }
}

async function loadSeasonEpisodes(tvId, seasonNumber) {
  const listEl = document.getElementById('detail-episodes-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="player-spinner" style="height: 100px;"><div class="spinner-icon"></div></div>';

  try {
    const seasonData = await api.getSeasonDetails(tvId, seasonNumber);
    listEl.innerHTML = '';

    if (!seasonData?.episodes || seasonData.episodes.length === 0) {
      listEl.innerHTML = '<div style="padding: 16px; color: var(--text-muted);">Episodes unavailable.</div>';
      return;
    }

    seasonData.episodes.forEach(ep => {
      const epRow = document.createElement('div');
      epRow.className = 'episode-item';
      const thumb = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : api.getFallbackPoster(ep.name);

      epRow.innerHTML = `
        <span class="episode-num">${ep.episode_number}</span>
        <img class="episode-thumb" src="${thumb}" alt="${ep.name}" loading="lazy">
        <div class="episode-info">
          <div class="episode-title">${ep.episode_number}. ${ep.name || `Episode ${ep.episode_number}`}</div>
          <div class="episode-desc">${ep.overview || 'Stream this episode in crystal clear 1080p on WatchX.'}</div>
        </div>
        <div style="color: var(--text-secondary); font-size: 13px; font-weight: 600;">
          ${ep.runtime ? `${ep.runtime}m` : '45m'}
        </div>
      `;

      epRow.addEventListener('click', () => {
        const modal = document.getElementById('detail-modal');
        if (modal) modal.classList.remove('active');
        soundFX.playTaDum();
        player.play(state.activeDetailMedia, seasonNumber, ep.episode_number);
      });

      listEl.appendChild(epRow);
    });
  } catch (err) {
    console.error('[WatchX] Season episodes load error:', err);
  }
}

// ==========================================================================
// Settings View (Account, Profile, Preferences, Privacy, Supabase Cloud)
// ==========================================================================
function setupSettingsView() {
  const tabs = document.querySelectorAll('.settings-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = btn.dataset.pane;
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
      const activeP = document.getElementById(`pane-${targetPane}`);
      if (activeP) activeP.classList.add('active');
    });
  });

  // Supabase Test Connection Button
  const testBtn = document.getElementById('cloud-test-btn');
  const saveBtn = document.getElementById('cloud-save-btn');
  const statusMsg = document.getElementById('cloud-status-msg');

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const url = document.getElementById('cloud-supabase-url').value;
      const key = document.getElementById('cloud-supabase-key').value;
      if (!url || !key) {
        showCloudStatus('Please provide both Supabase URL and Anon Key.', false);
        return;
      }
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing Connection...';
      const res = await dbClient.testSupabaseConnection(url, key);
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
      showCloudStatus(res.message, res.ok);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const url = document.getElementById('cloud-supabase-url').value;
      const key = document.getElementById('cloud-supabase-key').value;
      dbClient.saveCloudCredentials(url, key);
      showCloudStatus('Supabase credentials successfully saved to browser configuration!', true);
    });
  }

  // Clear Watch History
  const clearHistBtn = document.getElementById('settings-clear-history-btn');
  if (clearHistBtn) {
    clearHistBtn.addEventListener('click', async () => {
      const p = authManager.getActiveProfile();
      if (p && confirm(`Clear all watch history for profile "${p.name}"?`)) {
        await dbClient.clearWatchHistory(p.id);
        alert('Watch history cleared.');
        await renderContinueWatchingRow();
      }
    });
  }

  // Clear Searches
  const clearSearchBtn = document.getElementById('settings-clear-searches-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      localStorage.removeItem('watchx_recent_searches');
      state.recentSearches = [];
      renderRecentSearches();
      alert('Search history cleared.');
    });
  }

  // Settings Sound Toggle
  const soundCheck = document.getElementById('settings-sound-toggle');
  if (soundCheck) {
    soundCheck.addEventListener('change', () => {
      state.soundEnabled = soundCheck.checked;
      localStorage.setItem('watchx_sound_enabled', state.soundEnabled ? 'true' : 'false');
      updateSoundBtnIcon();
      if (state.soundEnabled) soundFX.playTaDum();
    });
  }

  // Settings 240Hz Performance HUD Toggle
  const fpsCheck = document.getElementById('settings-fps-toggle');
  if (fpsCheck) {
    fpsCheck.checked = performanceEngine.isEnabled;
    fpsCheck.addEventListener('change', () => {
      performanceEngine.toggle(fpsCheck.checked);
    });
  }

  // Edit Profile from Settings
  const editProfileBtn = document.getElementById('settings-edit-profile-btn');
  const managePinBtn = document.getElementById('settings-manage-pin-btn');
  if (editProfileBtn) {
    editProfileBtn.onclick = () => {
      const p = authManager.getActiveProfile();
      if (p) authManager.openProfileEditModal(p);
    };
  }
  if (managePinBtn) {
    managePinBtn.onclick = () => {
      const p = authManager.getActiveProfile();
      if (p) authManager.openProfileEditModal(p);
    };
  }

  // Sign Out Button from Settings
  const signoutBtn = document.getElementById('settings-signout-btn');
  if (signoutBtn) {
    signoutBtn.onclick = async () => {
      if (confirm('Sign out of WatchX?')) {
        await dbClient.signOut();
        location.reload();
      }
    };
  }
}

function showCloudStatus(msg, isSuccess) {
  const el = document.getElementById('cloud-status-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isSuccess ? '#ffffff' : '#a0a0a0';
}

function refreshSettingsView() {
  const user = dbClient.getCurrentUser();
  const emailEl = document.getElementById('settings-account-email');
  if (emailEl && user) emailEl.textContent = user.email || 'member@watchx.stream';

  const profile = authManager.getActiveProfile();
  const profNameEl = document.getElementById('settings-profile-name-desc');
  const pinStatusEl = document.getElementById('settings-pin-status');
  if (profNameEl && profile) profNameEl.textContent = profile.name;
  if (pinStatusEl && profile) {
    pinStatusEl.textContent = profile.pin_enabled ? 'Protected by 4-digit PIN' : 'Disabled (No PIN required)';
  }

  // Cloud credentials
  const creds = dbClient.getCloudCredentials();
  const urlInp = document.getElementById('cloud-supabase-url');
  const keyInp = document.getElementById('cloud-supabase-key');
  if (urlInp) urlInp.value = creds.url;
  if (keyInp) keyInp.value = creds.key;
}

// ==========================================================================
// Keyboard Shortcuts Modal & Global Key Listener
// ==========================================================================
function setupShortcuts() {
  const btn = document.getElementById('shortcuts-btn');
  const modal = document.getElementById('shortcuts-modal');
  const closeBtn = document.getElementById('shortcuts-close-btn');

  if (btn && modal) {
    btn.onclick = () => modal.classList.add('active');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };
  }

  document.addEventListener('keydown', (e) => {
    // If typing in input, ignore
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.key === '/') {
      e.preventDefault();
      const s = document.getElementById('header-search-input');
      if (s) s.focus();
    } else if (e.key === '?') {
      if (modal) modal.classList.toggle('active');
    } else if (e.key === 'm' || e.key === 'M') {
      const soundBtn = document.getElementById('sound-toggle-btn');
      if (soundBtn) soundBtn.click();
    } else if (e.key === ' ' && !player.isOpen()) {
      e.preventDefault();
      const playBtn = document.getElementById('spotlight-play');
      if (playBtn) playBtn.click();
    }
  });
}

// ==========================================================================
// Event Listeners (Profile Changed, Playback Saved)
// ==========================================================================
function setupEventListeners() {
  window.addEventListener('watchx:profile-changed', async (e) => {
    const profile = e.detail;
    if (profile) {
      await renderContinueWatchingRow();
      if (state.currentTab === 'mylist') loadWatchlistView();
    }
  });

  window.addEventListener('watchx:progress-updated', async () => {
    await renderContinueWatchingRow();
  });
}
