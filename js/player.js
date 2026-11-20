/**
 * WatchX - Legal, Ad-Free Cinema Video Player Controller
 * 100% Free & Legal Streams: Internet Archive, Public Domain, Official Studio Distributors.
 * Theatrical / Upcoming Movies: Official Studio 4K Trailers & Release Tracking.
 * 0% Ads · 0% Subscriptions · 0% Popups or Redirects · 0% Sandbox Errors
 */

import { dbClient } from './supabase-client.js?v=31';
import { authManager } from './auth.js?v=31';
import { getMediaDetails, getFreeStreamForMedia } from './api.js?v=31';

class WatchXCinemaPlayer {
  constructor() {
    this.currentMedia = null;
    this.currentSeason = 1;
    this.currentEpisode = 1;
    this.totalEpisodesInSeason = 24;
    this.currentTrailerKey = null;

    // Precision Playback State
    this.currentSeconds = 0;
    this.totalDurationSeconds = 7200; // Default 2 hours, updated on media load
    this.progressInterval = null;
    this.lastSavedTimestamp = 0;

    // DOM Elements
    this.playerModal = null;
    this.playerIframe = null;
    this.playerVideo = null;
    this.playerTitle = null;
    this.playerSubtitle = null;
    this.playerSourceBadge = null;
    this.playerSourceLabel = null;
    this.prevEpisodeBtn = null;
    this.nextEpisodeBtn = null;
    this.loadingSpinner = null;
    this.resumeToast = null;
    this.episodeControls = null;

    // Advanced Player UI Elements
    this.skipBackBtn = null;
    this.skipForwardBtn = null;
    this.speedBtn = null;
    this.speedLabel = null;
    this.pipBtn = null;
    this.timelineTrack = null;
    this.timelineProgress = null;
    this.timeCurrentEl = null;
    this.timeTotalEl = null;
    this.currentSpeed = 1.0;
    this.speedOptions = [0.5, 1.0, 1.25, 1.5, 2.0];
  }

  init() {
    this.playerModal = document.getElementById('player-modal');
    this.playerIframe = document.getElementById('player-iframe');
    this.playerVideo = document.getElementById('player-native-video');
    this.playerTitle = document.getElementById('player-title');
    this.playerSubtitle = document.getElementById('player-subtitle');
    this.playerSourceBadge = document.getElementById('player-source-badge');
    this.playerSourceLabel = document.getElementById('player-source-label');
    this.prevEpisodeBtn = document.getElementById('player-prev-ep');
    this.nextEpisodeBtn = document.getElementById('player-next-ep');
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

    this.setupSecurityShield();
    this.setupEpisodeButtons();
    this.setupGeneralButtons();
    this.setupAdvancedControls();
    this.setupNativeVideoListeners();
  }

  setupNativeVideoListeners() {
    if (!this.playerVideo) return;
    this.playerVideo.addEventListener('timeupdate', () => {
      if (this.playerVideo.currentTime > 0) {
        this.currentSeconds = Math.floor(this.playerVideo.currentTime);
        if (this.playerVideo.duration && !isNaN(this.playerVideo.duration)) {
          this.totalDurationSeconds = Math.floor(this.playerVideo.duration);
        }
        this.updateTimelineUI();
      }
    });

    this.playerVideo.addEventListener('loadedmetadata', () => {
      if (this.playerVideo.duration && !isNaN(this.playerVideo.duration)) {
        this.totalDurationSeconds = Math.floor(this.playerVideo.duration);
        this.updateTimelineUI();
      }
      if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
    });

    this.playerVideo.addEventListener('waiting', () => {
      if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';
    });

    this.playerVideo.addEventListener('playing', () => {
      if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
    });
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
    if (this.playerVideo && this.playerVideo.style.display !== 'none' && !this.playerVideo.paused) {
      this.playerVideo.currentTime = Math.max(0, Math.min(this.totalDurationSeconds, this.playerVideo.currentTime + delta));
      return;
    }
    this.currentSeconds = Math.max(0, Math.min(this.totalDurationSeconds, this.currentSeconds + delta));
    this.updateTimelineUI();
  }

  seekTo(seconds) {
    this.currentSeconds = Math.max(0, Math.min(this.totalDurationSeconds, seconds));
    if (this.playerVideo && this.playerVideo.style.display !== 'none') {
      this.playerVideo.currentTime = this.currentSeconds;
    }
    this.updateTimelineUI();
  }

  cycleSpeed() {
    const currIdx = this.speedOptions.indexOf(this.currentSpeed);
    const nextIdx = (currIdx + 1) % this.speedOptions.length;
    this.currentSpeed = this.speedOptions[nextIdx];
    if (this.speedLabel) {
      this.speedLabel.textContent = `${this.currentSpeed}x`;
    }
    if (this.playerVideo) {
      this.playerVideo.playbackRate = this.currentSpeed;
    }
  }

  togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (this.playerVideo && this.playerVideo.style.display !== 'none') {
        this.playerVideo.requestPictureInPicture().catch(() => {});
      } else {
        this.toggleFullscreen();
      }
    } catch (e) {}
  }

  mountCleanIframe(srcUrl) {
    const mountContainer = document.getElementById('player-mount-point') || document.getElementById('player-media-container') || document.querySelector('.player-container');
    if (!mountContainer) return null;

    if (this.playerVideo) {
      this.playerVideo.pause();
      this.playerVideo.style.display = 'none';
      this.playerVideo.src = '';
    }

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
    iframe.style.display = 'block';
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

  setupSecurityShield() {
    const originalOpen = window.open;
    window.open = (url, target, features) => {
      if (url && (String(url).includes('accounts.google.com') || String(url).includes('supabase.co'))) {
        return originalOpen.call(window, url, target, features);
      }
      console.warn('[WatchX Shield] Intercepted and blocked unauthorized popup attempt:', url);
      return null;
    };

    if (this.playerIframe) {
      this.playerIframe.removeAttribute('sandbox');
      this.playerIframe.setAttribute('referrerpolicy', 'origin');
    }
  }

  setupEpisodeButtons() {
    if (this.prevEpisodeBtn) {
      this.prevEpisodeBtn.addEventListener('click', () => {
        if (this.currentEpisode > 1) {
          this.currentEpisode--;
          this.play(this.currentMedia, this.currentSeason, this.currentEpisode);
        }
      });
    }

    if (this.nextEpisodeBtn) {
      this.nextEpisodeBtn.addEventListener('click', () => {
        this.currentEpisode++;
        this.play(this.currentMedia, this.currentSeason, this.currentEpisode);
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
      }
    });
  }

  isTV() {
    if (!this.currentMedia) return false;
    if (this.currentMedia.media_type === 'tv') return true;
    if (this.currentMedia.media_type === 'movie') return false;
    return Boolean(this.currentMedia.name && !this.currentMedia.title);
  }

  // ==========================================================================
  // Primary Playback Engine: 100% Legal & Ad-Free
  // ==========================================================================
  async play(media, season = 1, episode = 1) {
    if (!media) return;
    this.currentMedia = { ...media };
    this.currentSeason = season;
    this.currentEpisode = episode;
    this.currentTrailerKey = null;

    const mediaType = media.media_type || (media.name && !media.title ? 'tv' : 'movie');
    this.currentMedia.media_type = mediaType;

    const title = media.display_title || media.title || media.name || 'Cinema';
    const yearStr = String(media.display_year || media.release_date || media.first_air_date || '').substring(0, 4);
    const releaseYear = parseInt(yearStr || '2024');

    // 1. Check if title is available in Verified Free & Legal Streaming Registry
    const freeStream = getFreeStreamForMedia(media);

    if (freeStream) {
      // 100% Free & Legal Full Movie Stream
      if (this.episodeControls) this.episodeControls.style.display = 'none';
      if (this.playerTitle) this.playerTitle.textContent = freeStream.display_title || title;
      if (this.playerSubtitle) {
        this.playerSubtitle.textContent = `100% Free & Legal Cinema · ${freeStream.provider} (${freeStream.license})`;
      }
      if (this.playerSourceLabel) {
        this.playerSourceLabel.textContent = `${freeStream.provider} 1080p`;
      }
      if (this.playerSourceBadge) {
        this.playerSourceBadge.style.display = 'inline-flex';
      }

      const upcomingBanner = document.getElementById('player-upcoming-banner');
      if (upcomingBanner) upcomingBanner.style.display = 'none';

      this.openModal();
      if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';

      // Restore saved progress if applicable
      const activeProfile = authManager.getActiveProfile();
      if (activeProfile) {
        const history = await dbClient.getWatchHistory(activeProfile.id);
        const saved = history.find(h => h.media_id == media.id);
        if (saved && saved.stopped_at_seconds > 10) {
          this.currentSeconds = saved.stopped_at_seconds;
          this.showResumeToast(this.currentSeconds, this.totalDurationSeconds);
        } else {
          this.currentSeconds = 0;
        }
      }

      if (freeStream.direct_mp4 && this.playerVideo) {
        // Mode A: Direct High-Speed MP4 via Native HTML5 Video
        if (this.playerIframe) {
          this.playerIframe.src = 'about:blank';
          this.playerIframe.style.display = 'none';
        }
        this.playerVideo.style.display = 'block';
        this.playerVideo.src = freeStream.direct_mp4;
        if (this.currentSeconds > 0) {
          this.playerVideo.currentTime = this.currentSeconds;
        }
        this.playerVideo.play().catch(() => {});
      } else if (freeStream.stream_type === 'youtube_full') {
        // Mode B: Official YouTube Distributor Full Movie
        if (this.playerVideo) {
          this.playerVideo.pause();
          this.playerVideo.style.display = 'none';
        }
        this.mountCleanIframe(`https://www.youtube-nocookie.com/embed/${freeStream.youtube_key}?autoplay=1&rel=0&modestbranding=1&controls=1`);
      } else {
        // Mode C: Internet Archive Universal Cinema Embed
        if (this.playerVideo) {
          this.playerVideo.pause();
          this.playerVideo.style.display = 'none';
        }
        this.mountCleanIframe(freeStream.stream_url);
      }

      this.startProgressTicker();
      return;
    }

    // 2. Movie is NOT in the free stream registry (e.g. 2026/2027 theatrical release or commercial film)
    // As per user specification:
    // "If a movie is not available for free, display its information but mark it as unavailable for free streaming."
    // "Every movie must have a working Watch Now button."
    // -> Provide the official 4K Studio Trailer seamlessly with zero ads and zero sandbox issues!

    if (this.episodeControls) this.episodeControls.style.display = 'none';
    if (this.playerSourceLabel) {
      this.playerSourceLabel.textContent = 'Official Studio 4K Trailer';
    }
    if (this.playerSourceBadge) {
      this.playerSourceBadge.style.display = 'inline-flex';
    }

    if (this.playerTitle) this.playerTitle.textContent = title;
    if (this.playerSubtitle) {
      this.playerSubtitle.textContent = `Official Studio 4K Trailer · Theatrical Release (Free Stream Unavailable)`;
    }

    this.openModal();
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'flex';

    let trailerKey = media.trailer_key;
    if (!trailerKey) {
      try {
        const details = await getMediaDetails(mediaType, media.id);
        const videos = details?.videos?.results || [];
        const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
          || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
          || videos.find(v => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip'));
        if (trailer?.key) trailerKey = trailer.key;
      } catch (e) {
        console.warn('[WatchX] Error fetching official trailer:', e);
      }
    }

    if (trailerKey) {
      if (this.playerVideo) {
        this.playerVideo.pause();
        this.playerVideo.style.display = 'none';
      }
      this.playTrailer(trailerKey, title, `Official Studio 4K Trailer · Theatrical Release · ${releaseYear}`);
      return;
    }

    // 3. If no trailer exists on YouTube, show the elegant upcoming theatrical premiere alert card
    this.showUpcomingPremiereCard(media, releaseYear);
  }

  showUpcomingPremiereCard(media, releaseYear) {
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
    if (this.playerSourceBadge) this.playerSourceBadge.style.display = 'none';
    if (this.episodeControls) this.episodeControls.style.display = 'none';

    if (this.playerVideo) {
      this.playerVideo.pause();
      this.playerVideo.style.display = 'none';
    }

    const mountContainer = document.getElementById('player-mount-point') || document.getElementById('player-media-container') || document.querySelector('.player-container');
    const existing = document.getElementById('player-iframe');
    if (existing) {
      existing.src = 'about:blank';
      existing.style.display = 'none';
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
        <div style="display: inline-block; padding: 4px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 16px;">Theatrical Release · Premiere ${date}</div>
        <p style="font-size: 14px; color: #a0a0a0; line-height: 1.6; margin-bottom: 28px;">This title is scheduled for commercial theatrical and studio release. Free streaming is not yet legally available. Track release notifications below.</p>
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

  playTrailer(trailerKey, mediaTitle, customSubtitle = 'Official Studio 4K Trailer') {
    if (!trailerKey) return;
    this.currentTrailerKey = trailerKey;
    this.currentMedia = { title: `${mediaTitle} (Official Trailer)`, media_type: 'trailer' };

    const upcomingBanner = document.getElementById('player-upcoming-banner');
    if (upcomingBanner) upcomingBanner.style.display = 'none';

    if (this.playerTitle) this.playerTitle.textContent = `${mediaTitle}`;
    if (this.playerSubtitle) this.playerSubtitle.textContent = customSubtitle;
    if (this.playerSourceLabel) this.playerSourceLabel.textContent = 'Official Studio 4K Trailer';
    if (this.playerSourceBadge) this.playerSourceBadge.style.display = 'inline-flex';
    if (this.episodeControls) this.episodeControls.style.display = 'none';

    this.openModal();
    if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';

    const embedUrl = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0`;
    this.mountCleanIframe(embedUrl);
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
    this.progressInterval = setInterval(() => {
      if (this.playerVideo && this.playerVideo.style.display !== 'none' && !this.playerVideo.paused) {
        // Native video handles its own timeupdate
      } else {
        this.currentSeconds++;
        if (this.currentSeconds > this.totalDurationSeconds) {
          this.currentSeconds = this.totalDurationSeconds;
        }
        this.updateTimelineUI();
      }
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

    if (this.playerVideo) {
      this.playerVideo.pause();
      this.playerVideo.src = '';
      this.playerVideo.style.display = 'none';
    }

    if (this.playerIframe) {
      this.playerIframe.src = 'about:blank';
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

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
}

export const player = new WatchXCinemaPlayer();
window.player = player;
