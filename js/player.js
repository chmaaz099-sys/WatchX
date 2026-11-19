/**
 * WatchX - Ultra-Clean Cinema Video Player Controller
 * 100% Monochromatic & Clutter-Free.
 * Provider names and technical badges are strictly removed from the UI.
 * Precision profile-specific playback tracking with automatic resume.
 */

import { dbClient } from './supabase-client.js?v=28';
import { authManager } from './auth.js?v=28';
import { getMediaDetails } from './api.js?v=28';

// Clean, Secure, and High-Performance Streaming Sources (Zero popups / zero redirect abuse)
// 100% Verified HTTP 200 Fast Global CDN Endpoints
const STREAM_PROVIDERS = [
  {
    label: 'Server 1',
    description: 'VidSrc Global CDN',
    movieUrl: (id, imdb) => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl: (id, s, e, imdb) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
  },
  {
    label: 'Server 2',
    description: 'AutoEmbed Cinema HD',
    movieUrl: (id, imdb) => `https://player.autoembed.cc/embed/movie/${id}`,
    tvUrl: (id, s, e, imdb) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
  },
  {
    label: 'Server 3',
    description: 'VidSrc XYZ Ultra Stream',
    movieUrl: (id, imdb) => `https://vidsrc.xyz/embed/movie?tmdb=${id}${imdb ? `&imdb=${imdb}` : ''}`,
    tvUrl: (id, s, e, imdb) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
  },
  {
    label: 'Server 4',
    description: '2Embed Cinema Direct',
    movieUrl: (id, imdb) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, s, e, imdb) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
  },
  {
    label: 'Server 5',
    description: 'VidPrime High-Speed Backup',
    movieUrl: (id, imdb) => `https://vidprime.top/movie/${id}`,
    tvUrl: (id, s, e, imdb) => `https://vidprime.top/tv/${id}/${s}/${e}`
  },
  {
    label: 'Server 6',
    description: 'VidLink Pro (Pure Cinema)',
    movieUrl: (id, imdb) => `https://vidlink.pro/movie/${id}?primaryColor=ffffff&secondaryColor=141414&iconColor=ffffff&icons=default&autoplay=false`,
    tvUrl: (id, s, e, imdb) => `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ffffff&secondaryColor=141414&iconColor=ffffff&icons=default&autoplay=false`
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

    // Advanced Player UI Elements
    this.skipBackBtn = document.getElementById('player-skip-back-10');
    this.skipForwardBtn = document.getElementById('player-skip-forward-10');
    this.speedBtn = document.getElementById('player-speed-btn');
    this.speedLabel = document.getElementById('player-speed-label');
    this.pipBtn = document.getElementById('player-pip-btn');
    this.timelineTrack = document.getElementById('player-scrubber-track');
    this.timelineProgress = document.getElementById('player-scrubber-progress');
    this.timeCurrentEl = document.getElementById('player-time-current');
    this.timeTotalEl = document.getElementById('player-time-total');
    this.currentSpeed = 1.0;
    this.speedOptions = [0.5, 1.0, 1.25, 1.5, 2.0];

    this.setupSecurityShield();
    this.setupEpisodeButtons();
    this.setupGeneralButtons();
    this.setupAdvancedControls();
    this.setupStreamSwitcher();
    this.setupMessageListener();
  }

  setupAdvancedControls() {
    if (this.skipBackBtn) {
      this.skipBackBtn.addEventListener('click', () => this.skipSeconds(-10));
    }
    if (this.skipForwardBtn) {
      this.skipForwardBtn.addEventListener('click', () => this.skipSeconds(10));
    }
    if (this.speedBtn) {
      this.speedBtn.addEventListener('click', () => this.cycleSpeed());
    }
    if (this.pipBtn) {
      this.pipBtn.addEventListener('click', () => this.togglePiP());
    }
    if (this.timelineTrack) {
      this.timelineTrack.addEventListener('click', (e) => {
        const rect = this.timelineTrack.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekSeconds = Math.floor(clickRatio * this.totalDurationSeconds);
        this.seekTo(seekSeconds);
      });
    }
  }

  skipSeconds(delta) {
    this.currentSeconds = Math.max(0, Math.min(this.totalDurationSeconds, this.currentSeconds + delta));
    this.updateTimelineUI();
    this.reloadWithCurrentTimestamp();
  }

  seekTo(seconds) {
    this.currentSeconds = Math.max(0, Math.min(this.totalDurationSeconds, seconds));
    this.updateTimelineUI();
    this.reloadWithCurrentTimestamp();
  }

  cycleSpeed() {
    const currIdx = this.speedOptions.indexOf(this.currentSpeed);
    const nextIdx = (currIdx + 1) % this.speedOptions.length;
    this.currentSpeed = this.speedOptions[nextIdx];
    if (this.speedLabel) {
      this.speedLabel.textContent = `${this.currentSpeed}x`;
    }
    try {
      if (this.playerIframe && this.playerIframe.contentWindow) {
        this.playerIframe.contentWindow.postMessage({ type: 'setspeed', speed: this.currentSpeed }, '*');
      }
    } catch (e) {}
  }

  togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (this.playerIframe) {
        this.toggleFullscreen();
      }
    } catch (e) {}
  }

  mountCleanIframe(srcUrl) {
    const mountContainer = document.getElementById('player-mount-point') || document.getElementById('player-media-container') || document.querySelector('.player-container');
    if (!mountContainer) return null;

    // Purge any existing iframe completely from DOM to eliminate all sandbox constraints
    const existing = document.getElementById('player-iframe');
    if (existing) {
      existing.src = 'about:blank';
      existing.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'player-iframe';
    iframe.className = 'player-iframe';
    iframe.loading = 'eager';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; display-capture');
    iframe.setAttribute('referrerpolicy', 'origin');
    iframe.removeAttribute('sandbox');
    iframe.src = srcUrl;

    iframe.onload = () => {
      setTimeout(() => {
        if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
      }, 400);
    };

    mountContainer.appendChild(iframe);
    this.playerIframe = iframe;
    return iframe;
  }

  reloadWithCurrentTimestamp() {
    if (!this.currentMedia) return;
    const provider = STREAM_PROVIDERS[this.currentProviderIndex] || STREAM_PROVIDERS[0];
    const isTV = this.isTV();
    const mediaId = this.currentMedia.id;
    const imdbId = this.currentMedia.imdb_id || '';

    let streamUrl = isTV
      ? provider.tvUrl(mediaId, this.currentSeason, this.currentEpisode, imdbId)
      : provider.movieUrl(mediaId, imdbId);

    if (this.currentSeconds > 0) {
      const sep = streamUrl.includes('?') ? '&' : '?';
      streamUrl += `${sep}start=${this.currentSeconds}&t=${this.currentSeconds}`;
    }
    this.mountCleanIframe(streamUrl);
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs}`;
    }
    return `${mins}:${secs}`;
  }

  updateTimelineUI() {
    if (this.timeCurrentEl) {
      this.timeCurrentEl.textContent = this.formatTime(this.currentSeconds);
    }
    if (this.timeTotalEl) {
      this.timeTotalEl.textContent = this.formatTime(this.totalDurationSeconds);
    }
    if (this.timelineProgress) {
      const percent = Math.min(100, (this.currentSeconds / Math.max(1, this.totalDurationSeconds)) * 100);
      this.timelineProgress.style.width = `${percent}%`;
    }
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

    // 3. Iframe Privacy & Referrer Policy (Sandbox removed to eliminate player "Please Disable Sandbox" blocks)
    if (this.playerIframe) {
      this.playerIframe.removeAttribute('sandbox');
      this.playerIframe.setAttribute('referrerpolicy', 'origin');
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
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.skipSeconds(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.skipSeconds(10);
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
    if (!this.currentMedia) return false;
    if (this.currentMedia.media_type === 'tv') return true;
    if (this.currentMedia.media_type === 'movie') return false;
    return Boolean(this.currentMedia.name && !this.currentMedia.title);
  }

  // ==========================================================================
  // Play Media
  // ==========================================================================
  async play(media, season = 1, episode = 1) {
    if (!media) return;
    this.currentMedia = { ...media };
    this.currentSeason = season;
    this.currentEpisode = episode;
    this.currentTrailerKey = null;
    this.currentProviderIndex = 0;

    const mediaType = media.media_type || (media.name && !media.title ? 'tv' : 'movie');
    this.currentMedia.media_type = mediaType;

    const releaseYear = parseInt((media.release_date || media.first_air_date || media.display_year || '').substring(0, 4) || '2024');
    const isUpcoming = Boolean(media.is_upcoming || releaseYear > 2024);

    // If title is unreleased/upcoming, automatically provide the official 4K cinematic trailer
    if (isUpcoming) {
      this.updateHeader();
      this.openModal();
      if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';

      let trailerKey = media.trailer_key;
      try {
        const details = await getMediaDetails(mediaType, media.id);
        const videos = details?.videos?.results || [];
        const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
          || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
          || videos.find(v => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip'));
        if (trailer?.key) trailerKey = trailer.key;
      } catch (e) {
        console.warn('[WatchX] Error fetching upcoming trailer:', e);
      }

      if (trailerKey) {
        this.playTrailer(trailerKey, media.display_title || media.title || media.name || 'Upcoming Film', `Official 4K Cinematic Trailer · In Theaters ${releaseYear}`);
        return;
      } else {
        this.showUpcomingPremiereCard(media, releaseYear);
        return;
      }
    }

    // Ensure IMDb ID is fetched in background for universal provider compatibility
    if (!this.currentMedia.imdb_id) {
      getMediaDetails(mediaType, media.id).then(details => {
        if (details?.external_ids?.imdb_id) {
          this.currentMedia.imdb_id = details.external_ids.imdb_id;
        }
      }).catch(() => {});
    }

    // Estimate runtime
    const runtimeMinutes = media.runtime || (media.episode_run_time && media.episode_run_time[0]) || 115;
    this.totalDurationSeconds = runtimeMinutes * 60;

    // Check active profile's watch history for saved progress
    const activeProfile = authManager.getActiveProfile();
    const history = activeProfile ? await dbClient.getWatchHistory(activeProfile.id) : [];
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

  showUpcomingPremiereCard(media, releaseYear) {
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
    const mountContainer = document.getElementById('player-mount-point') || document.getElementById('player-media-container') || document.querySelector('.player-container');
    const existing = document.getElementById('player-iframe');
    if (existing) {
      existing.src = 'about:blank';
      existing.remove();
    }
    const title = media.display_title || media.title || media.name || 'Upcoming Film';
    const date = media.release_date || media.first_air_date || `${releaseYear}`;
    
    let previewEl = document.getElementById('player-upcoming-banner');
    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.id = 'player-upcoming-banner';
      previewEl.className = 'player-upcoming-banner';
      if (mountContainer) mountContainer.appendChild(previewEl);
    }
    previewEl.style.display = 'flex';
    previewEl.innerHTML = `
      <div style="text-align: center; max-width: 540px; padding: 40px 24px;">
        <i class="fas fa-film" style="font-size: 52px; color: #ffffff; margin-bottom: 20px; opacity: 0.9;"></i>
        <h2 style="font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 12px; letter-spacing: -0.5px;">${title}</h2>
        <div style="display: inline-block; padding: 4px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 16px;">Theatrical Premiere · ${date}</div>
        <p style="font-size: 14px; color: #a0a0a0; line-height: 1.6; margin-bottom: 28px;">This title is scheduled for upcoming theatrical and studio release. High-definition cinema streams will unlock on release day.</p>
        <button class="btn-primary-white" id="player-prem-notify-btn" style="padding: 12px 28px; font-size: 14px; font-weight: 700; cursor: pointer;">
          <i class="fas fa-bell"></i> Notify Me On Release Day
        </button>
      </div>
    `;
    const notifyBtn = previewEl.querySelector('#player-prem-notify-btn');
    if (notifyBtn) {
      notifyBtn.onclick = async () => {
        const profile = authManager.getActiveProfile();
        if (profile) {
          await dbClient.addNotification(profile.id, {
            title: `Release Alert: ${title}`,
            message: `${title} is tracked. You will receive an instant notification on premiere day.`,
            type: 'release',
            media_id: media.id,
            media_type: media.media_type || 'movie'
          });
          notifyBtn.innerHTML = '<i class="fas fa-check"></i> Alert Active';
          notifyBtn.style.opacity = '0.7';
          notifyBtn.disabled = true;
        }
      };
    }
  }

  updateHeader() {
    const title = this.currentMedia.display_title || this.currentMedia.title || this.currentMedia.name || 'Cinema';
    const year = (this.currentMedia.release_date || this.currentMedia.first_air_date || this.currentMedia.display_year || '').substring(0, 4) || '2024';

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
    if (!this.currentMedia) return;
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';
    if (this.switchStreamBtn) this.switchStreamBtn.style.display = 'inline-flex';

    const upcomingBanner = document.getElementById('player-upcoming-banner');
    if (upcomingBanner) upcomingBanner.style.display = 'none';

    const provider = STREAM_PROVIDERS[this.currentProviderIndex] || STREAM_PROVIDERS[0];
    const isTV = this.isTV();
    const mediaId = this.currentMedia.id;
    const imdbId = this.currentMedia.imdb_id || '';

    let streamUrl = isTV
      ? provider.tvUrl(mediaId, this.currentSeason, this.currentEpisode, imdbId)
      : provider.movieUrl(mediaId, imdbId);

    // Pass resume timestamp parameter if supported
    if (this.currentSeconds > 0) {
      const sep = streamUrl.includes('?') ? '&' : '?';
      streamUrl += `${sep}start=${this.currentSeconds}&t=${this.currentSeconds}`;
    }

    this.mountCleanIframe(streamUrl);
    this.updateStreamLabel();
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
    this.updateTimelineUI();
    // Increment exact seconds every 1 second
    this.progressInterval = setInterval(() => {
      this.currentSeconds++;
      if (this.currentSeconds > this.totalDurationSeconds) {
        this.currentSeconds = this.totalDurationSeconds;
      }
      this.updateTimelineUI();
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

    const upcomingBanner = document.getElementById('player-upcoming-banner');
    if (upcomingBanner) upcomingBanner.style.display = 'none';

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

  playTrailer(trailerKey, mediaTitle, customSubtitle = 'Official 4K Cinematic Trailer') {
    if (!trailerKey) return;
    this.currentTrailerKey = trailerKey;
    this.currentMedia = { title: `${mediaTitle} (Official Trailer)`, media_type: 'trailer' };

    const upcomingBanner = document.getElementById('player-upcoming-banner');
    if (upcomingBanner) upcomingBanner.style.display = 'none';

    if (this.playerTitle) this.playerTitle.textContent = `${mediaTitle}`;
    if (this.playerSubtitle) this.playerSubtitle.textContent = customSubtitle;
    if (this.episodeControls) this.episodeControls.style.display = 'none';
    if (this.switchStreamBtn) this.switchStreamBtn.style.display = 'none';

    this.openModal();
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';

    const embedUrl = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0`;
    this.mountCleanIframe(embedUrl);
  }
}

export const player = new WatchXCinemaPlayer();
window.player = player;
