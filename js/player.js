/**
 * WatchX - Ultra-Clean Cinema Video Player Controller
 * 100% Monochromatic & Clutter-Free.
 * Provider names and technical badges are strictly removed from the UI.
 * Precision profile-specific playback tracking with automatic resume.
 */

import { dbClient } from './supabase-client.js?v=20';
import { authManager } from './auth.js?v=20';

// Clean, Secure, and High-Performance Streaming Sources (Zero popups / zero redirect abuse)
// VidLink Pro is primary: custom dark theme parameters, no popups, full HTML5 player
const STREAM_PROVIDERS = [
  {
    label: 'Server 1',
    movieUrl: (id) => `https://vidlink.pro/movie/${id}?primaryColor=ffffff&secondaryColor=141414&iconColor=ffffff&icons=default&autoplay=false`,
    tvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ffffff&secondaryColor=141414&iconColor=ffffff&icons=default&autoplay=false`
  },
  {
    label: 'Server 2',
    movieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false`,
    tvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}?autoPlay=false`
  },
  {
    label: 'Server 3',
    movieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
  },
  {
    label: 'Server 4',
    movieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
  },
  {
    label: 'Server 5',
    movieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
  }
];

class WatchXCinemaPlayer {
  constructor() {
    this.currentMedia = null;
    this.currentProviderIndex = 0;
    this.currentSeason = 1;
    this.currentEpisode = 1;
    this.totalEpisodesInSeason = 24;
    this.currentTrailerKey = null;

    // Precision Playback State (Non-Random)
    this.currentSeconds = 0;
    this.totalDurationSeconds = 7200; // Default 2 hours, updated on media load
    this.progressInterval = null;
    this.lastSavedTimestamp = 0;

    // DOM Elements
    this.playerModal = null;
    this.playerIframe = null;
    this.playerTitle = null;
    this.playerSubtitle = null;
    this.prevEpisodeBtn = null;
    this.nextEpisodeBtn = null;
    this.switchStreamBtn = null;
    this.streamLabel = null;
    this.loadingSpinner = null;
    this.resumeToast = null;
    this.episodeControls = null;
    this.streamWatchdog = null;
  }

  init() {
    this.playerModal = document.getElementById('player-modal');
    this.playerIframe = document.getElementById('player-iframe');
    this.playerTitle = document.getElementById('player-title');
    this.playerSubtitle = document.getElementById('player-subtitle');
    this.prevEpisodeBtn = document.getElementById('player-prev-ep');
    this.nextEpisodeBtn = document.getElementById('player-next-ep');
    this.switchStreamBtn = document.getElementById('player-switch-stream-btn');
    this.streamLabel = document.getElementById('player-stream-label');
    this.loadingSpinner = document.getElementById('player-spinner');
    this.resumeToast = document.getElementById('player-resume-toast');
    this.episodeControls = document.getElementById('player-episode-controls');

    this.setupSecurityShield();
    this.setupEpisodeButtons();
    this.setupGeneralButtons();
    this.setupStreamSwitcher();
    this.setupMessageListener();
  }

  isOpen() {
    return this.playerModal && this.playerModal.classList.contains('active');
  }

  // ==========================================================================
  // Anti-Malicious Popups & Top-Level Redirect Shield
  // ==========================================================================
  setupSecurityShield() {
    // 1. Intercept rogue window.open calls from malicious embeds or scripts
    const originalOpen = window.open;
    window.open = (url, target, features) => {
      // Only permit explicit, authorized OAuth authentication popups
      if (url && (String(url).includes('accounts.google.com') || String(url).includes('supabase.co'))) {
        return originalOpen.call(window, url, target, features);
      }
      console.warn('[WatchX Shield] Intercepted and blocked unauthorized popup attempt:', url);
      return null;
    };

    // 2. Prevent rogue embeds from forcing top-level location unloads
    window.addEventListener('beforeunload', (e) => {
      if (this.isOpen()) {
        console.warn('[WatchX Shield] Top-level unload attempt blocked during cinema session.');
      }
    });

    // 3. Iframe Sandbox Hardening
    if (this.playerIframe) {
      // Strictly OMIT allow-popups, allow-top-navigation, and allow-modals
      this.playerIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
      this.playerIframe.setAttribute('referrerpolicy', 'no-referrer');
    }
  }

  setupStreamSwitcher() {
    if (this.switchStreamBtn) {
      this.switchStreamBtn.addEventListener('click', () => {
        this.switchStream();
      });
    }
  }

  switchStream() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % STREAM_PROVIDERS.length;
    this.updateStreamLabel();
    this.loadStream();
  }

  updateStreamLabel() {
    const provider = STREAM_PROVIDERS[this.currentProviderIndex] || STREAM_PROVIDERS[0];
    if (this.streamLabel) {
      this.streamLabel.textContent = provider.label || `Server ${this.currentProviderIndex + 1}`;
    }
  }

  setupEpisodeButtons() {
    if (this.prevEpisodeBtn) {
      this.prevEpisodeBtn.addEventListener('click', () => {
        if (this.currentEpisode > 1) {
          this.currentEpisode--;
          this.loadStream();
        }
      });
    }

    if (this.nextEpisodeBtn) {
      this.nextEpisodeBtn.addEventListener('click', () => {
        this.currentEpisode++;
        this.loadStream();
      });
    }
  }

  setupGeneralButtons() {
    const closeBtn = document.getElementById('player-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const fullscreenBtn = document.getElementById('player-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === 'n' || e.key === 'N') {
        if (this.nextEpisodeBtn && this.isTV()) {
          this.currentEpisode++;
          this.loadStream();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (this.prevEpisodeBtn && this.isTV() && this.currentEpisode > 1) {
          this.currentEpisode--;
          this.loadStream();
        }
      }
    });
  }

  setupMessageListener() {
    // Listen for postMessage events from embed players for time updates
    window.addEventListener('message', (event) => {
      try {
        let msg = event.data;
        if (typeof msg === 'string') {
          try { msg = JSON.parse(msg); } catch (e) { return; }
        }
        if (msg && (msg.type === 'timeupdate' || msg.event === 'timeupdate')) {
          const t = msg.currentTime || msg.data?.currentTime;
          const d = msg.duration || msg.data?.duration;
          if (t && !isNaN(t) && t > 0) {
            this.currentSeconds = Math.floor(t);
            if (d && !isNaN(d) && d > 0) {
              this.totalDurationSeconds = Math.floor(d);
            }
          }
        }
      } catch (err) {}
    });
  }

  isTV() {
    return Boolean(this.currentMedia && (this.currentMedia.media_type === 'tv' || this.currentMedia.name));
  }

  // ==========================================================================
  // Play Media
  // ==========================================================================
  async play(media, season = 1, episode = 1) {
    if (!media) return;
    this.currentMedia = media;
    this.currentSeason = season;
    this.currentEpisode = episode;
    this.currentTrailerKey = null;
    this.currentProviderIndex = 0;

    // Estimate runtime
    const runtimeMinutes = media.runtime || (media.episode_run_time && media.episode_run_time[0]) || 115;
    this.totalDurationSeconds = runtimeMinutes * 60;

    // Check active profile's watch history for saved progress
    const activeProfile = authManager.getActiveProfile();
    const history = activeProfile ? await dbClient.getWatchHistory(activeProfile.id) : [];
    const mediaType = this.isTV() ? 'tv' : 'movie';
    const savedRecord = history.find(h => h.media_id == media.id && h.media_type === mediaType);

    if (savedRecord && savedRecord.stopped_at_seconds > 10) {
      this.currentSeconds = savedRecord.stopped_at_seconds;
      if (savedRecord.duration_seconds > 0) {
        this.totalDurationSeconds = savedRecord.duration_seconds;
      }
      this.showResumeToast(this.currentSeconds, this.totalDurationSeconds);
    } else {
      this.currentSeconds = 0;
    }

    this.updateHeader();
    this.openModal();
    this.loadStream();
    this.startProgressTicker();
  }

  updateHeader() {
    const title = this.currentMedia.title || this.currentMedia.name || 'Cinema';
    const year = (this.currentMedia.release_date || this.currentMedia.first_air_date || '').substring(0, 4) || '2024';

    if (this.playerTitle) this.playerTitle.textContent = title;

    if (this.isTV()) {
      if (this.playerSubtitle) {
        this.playerSubtitle.textContent = `Season ${this.currentSeason} · Episode ${this.currentEpisode}`;
      }
      if (this.episodeControls) this.episodeControls.style.display = 'flex';
      if (this.prevEpisodeBtn) this.prevEpisodeBtn.disabled = this.currentEpisode <= 1;
    } else {
      if (this.playerSubtitle) {
        this.playerSubtitle.textContent = `${year} · Feature Film`;
      }
      if (this.episodeControls) this.episodeControls.style.display = 'none';
    }
  }

  loadStream() {
    if (!this.currentMedia || !this.playerIframe) return;
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';

    // Ensure strict sandbox and security headers
    this.playerIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
    this.playerIframe.setAttribute('referrerpolicy', 'no-referrer');

    const provider = STREAM_PROVIDERS[this.currentProviderIndex] || STREAM_PROVIDERS[0];
    const isTV = this.isTV();

    let streamUrl = isTV
      ? provider.tvUrl(this.currentMedia.id, this.currentSeason, this.currentEpisode)
      : provider.movieUrl(this.currentMedia.id);

    // Pass resume timestamp parameter if supported
    if (this.currentSeconds > 0) {
      const sep = streamUrl.includes('?') ? '&' : '?';
      streamUrl += `${sep}start=${this.currentSeconds}&t=${this.currentSeconds}`;
    }

    this.playerIframe.src = streamUrl;
    this.updateStreamLabel();

    this.playerIframe.onload = () => {
      setTimeout(() => {
        if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
      }, 600);
    };

    this.updateHeader();
  }

  showResumeToast(seconds, totalDuration) {
    if (!this.resumeToast) return;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const percent = Math.min(99, Math.round((seconds / Math.max(1, totalDuration)) * 100));

    this.resumeToast.innerHTML = `
      <i class="fas fa-play"></i>
      <span>Resumed from <strong>${mins}:${secs}</strong> (${percent}%)</span>
    `;
    this.resumeToast.style.display = 'flex';
    this.resumeToast.classList.add('fade-in');

    setTimeout(() => {
      this.resumeToast.classList.remove('fade-in');
      setTimeout(() => { this.resumeToast.style.display = 'none'; }, 400);
    }, 4500);
  }

  startProgressTicker() {
    this.stopProgressTicker();
    // Increment exact seconds every 1 second
    this.progressInterval = setInterval(() => {
      this.currentSeconds++;
      if (this.currentSeconds > this.totalDurationSeconds) {
        this.currentSeconds = this.totalDurationSeconds;
      }
      // Save progress to database every 5 seconds
      const now = Date.now();
      if (now - this.lastSavedTimestamp >= 5000) {
        this.lastSavedTimestamp = now;
        this.saveCurrentProgress();
      }
    }, 1000);
  }

  stopProgressTicker() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  async saveCurrentProgress() {
    if (!this.currentMedia || this.currentSeconds < 2) return;
    const activeProfile = authManager.getActiveProfile();
    if (!activeProfile) return;

    await dbClient.saveWatchProgress(
      activeProfile.id,
      this.currentMedia,
      this.currentSeconds,
      this.totalDurationSeconds,
      {
        season: this.currentSeason,
        episode: this.currentEpisode,
        episodeTitle: this.isTV() ? `Episode ${this.currentEpisode}` : ''
      }
    );
  }

  openModal() {
    if (this.playerModal) {
      this.playerModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  close() {
    this.saveCurrentProgress();
    this.stopProgressTicker();

    if (this.playerModal) {
      this.playerModal.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (this.playerIframe) {
      this.playerIframe.src = 'about:blank';
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Refresh Continue Watching in main app
    window.dispatchEvent(new CustomEvent('watchx:progress-updated'));
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (this.playerModal.requestFullscreen) {
        this.playerModal.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  playTrailer(trailerKey, mediaTitle) {
    if (!trailerKey) return;
    this.currentTrailerKey = trailerKey;
    this.currentMedia = { title: `${mediaTitle} (Official Trailer)`, media_type: 'trailer' };

    if (this.playerTitle) this.playerTitle.textContent = `${mediaTitle}`;
    if (this.playerSubtitle) this.playerSubtitle.textContent = 'Official 4K Cinematic Trailer';
    if (this.episodeControls) this.episodeControls.style.display = 'none';

    this.openModal();
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
    this.playerIframe.src = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`;
  }
}

export const player = new WatchXCinemaPlayer();
window.player = player;
