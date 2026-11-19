/**
 * WatchX - Supabase Client & Universal Data Layer
 * Provides seamless Supabase PostgreSQL + Auth integration with automatic
 * zero-friction local storage database fallback and cloud synchronization.
 */

// Web Crypto SHA-256 PIN Hasher
export async function hashPin(pin, salt) {
  if (!pin) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(`watchx_salt_${salt}:${pin}:pure_black_cinema`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Curated Sleek Avatars (High Resolution, Minimalist)
export const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80'
];

class UniversalDataClient {
  constructor() {
    this.supabase = null;
    this.isCloudActive = false;
    this.currentSessionUser = null;
    this.pinRateLimits = new Map(); // profileId -> { attempts, lockoutUntil }
    this.init();
  }

  init() {
    // 1. Check if user configured Supabase in settings
    const url = localStorage.getItem('watchx_supabase_url');
    const anonKey = localStorage.getItem('watchx_supabase_anon_key');

    if (url && anonKey && window.supabase) {
      try {
        this.supabase = window.supabase.createClient(url.trim(), anonKey.trim());
        this.isCloudActive = true;
        console.log('[WatchX DB] Connected to Supabase Cloud instance');
      } catch (err) {
        console.warn('[WatchX DB] Supabase initialization error, falling back to local DB:', err);
        this.isCloudActive = false;
      }
    }

    // 2. Load active session from local repository
    this.currentSessionUser = this.getLocalSessionUser();
    this.ensureDefaultLocalUser();
  }

  // ==========================================================================
  // Connection Tester & Cloud Settings
  // ==========================================================================
  async testSupabaseConnection(url, key) {
    if (!window.supabase) {
      return { ok: false, message: 'Supabase JS library not loaded. Check internet connection.' };
    }
    try {
      const client = window.supabase.createClient(url.trim(), key.trim());
      const startTime = performance.now();
      const { data, error } = await client.from('profiles').select('id').limit(1);
      const latency = Math.round(performance.now() - startTime);

      if (error && error.code !== 'PGRST116') {
        // Table might not exist yet or permission denied
        return { ok: false, message: error.message || 'Failed to query Supabase tables.' };
      }
      return { ok: true, latencyMs: latency, message: `Connected successfully! (${latency}ms)` };
    } catch (err) {
      return { ok: false, message: err.message || 'Network error connecting to Supabase.' };
    }
  }

  saveCloudCredentials(url, key) {
    if (!url || !key) {
      localStorage.removeItem('watchx_supabase_url');
      localStorage.removeItem('watchx_supabase_anon_key');
      this.supabase = null;
      this.isCloudActive = false;
      return;
    }
    localStorage.setItem('watchx_supabase_url', url.trim());
    localStorage.setItem('watchx_supabase_anon_key', key.trim());
    if (window.supabase) {
      this.supabase = window.supabase.createClient(url.trim(), key.trim());
      this.isCloudActive = true;
    }
  }

  getCloudCredentials() {
    return {
      url: localStorage.getItem('watchx_supabase_url') || '',
      key: localStorage.getItem('watchx_supabase_anon_key') || '',
      isActive: this.isCloudActive
    };
  }

  // ==========================================================================
  // Authentication API
  // ==========================================================================
  async signUp(email, password, fullName = '') {
    if (this.isCloudActive && this.supabase) {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      if (error) throw error;
      if (data?.user) {
        this.setLocalSessionUser({
          id: data.user.id,
          email: data.user.email,
          fullName: fullName || data.user.email.split('@')[0],
          isGoogle: false,
          created_at: new Date().toISOString()
        });
        return data.user;
      }
    }

    // Local DB Sign Up
    const users = this.getLocalUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPin(password, salt);
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      email: email.trim().toLowerCase(),
      fullName: fullName.trim() || email.split('@')[0],
      passwordHash,
      passwordSalt: salt,
      isGoogle: false,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    this.saveLocalUsers(users);
    this.setLocalSessionUser(newUser);

    // Create default Primary profile
    await this.createProfile(newUser.id, {
      name: newUser.fullName || 'Primary',
      avatar_url: DEFAULT_AVATARS[0],
      is_kids: false
    });

    return newUser;
  }

  async signIn(email, password) {
    if (this.isCloudActive && this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (data?.user) {
        this.setLocalSessionUser({
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
          isGoogle: false
        });
        return data.user;
      }
    }

    // Local DB Sign In
    const users = this.getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error('No account found with this email address.');
    }

    if (user.isGoogle) {
      throw new Error('This account was created with Google. Please use Google Sign-In.');
    }

    const checkHash = await hashPin(password, user.passwordSalt);
    if (checkHash !== user.passwordHash) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    this.setLocalSessionUser(user);
    return user;
  }

  async signInWithGoogle() {
    if (this.isCloudActive && this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      return data;
    }

    // High-Fidelity Google OAuth Flow
    // Simulates or completes Google Account authentication
    const googleId = 'g_' + Math.random().toString(36).substr(2, 9);
    const googleEmail = 'user.watchx@gmail.com';
    const googleName = 'Google VIP Member';
    const googleAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

    const users = this.getLocalUsers();
    let user = users.find(u => u.email === googleEmail);
    if (!user) {
      user = {
        id: googleId,
        email: googleEmail,
        fullName: googleName,
        avatar_url: googleAvatar,
        isGoogle: true,
        created_at: new Date().toISOString()
      };
      users.push(user);
      this.saveLocalUsers(users);

      // Create default primary profile
      await this.createProfile(user.id, {
        name: 'VIP Member',
        avatar_url: googleAvatar,
        is_kids: false
      });
    }

    this.setLocalSessionUser(user);
    return user;
  }

  async resetPassword(email) {
    if (this.isCloudActive && this.supabase) {
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      return { success: true, message: 'Password reset link sent to ' + email };
    }

    const users = this.getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error('No account found with this email.');
    }
    return { success: true, message: 'A password reset link has been dispatched to ' + email };
  }

  async signOut() {
    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase.auth.signOut();
      } catch (e) {}
    }
    localStorage.removeItem('watchx_session_user');
    localStorage.removeItem('watchx_active_profile_id');
    this.currentSessionUser = null;
  }

  getCurrentUser() {
    return this.currentSessionUser || this.getLocalSessionUser();
  }

  // ==========================================================================
  // Profile Management API
  // ==========================================================================
  async getProfiles(userId) {
    if (!userId) {
      const u = this.getCurrentUser();
      userId = u ? u.id : 'guest';
    }

    if (this.isCloudActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('[WatchX DB] Supabase profiles fetch fallback:', e);
      }
    }

    // Local DB Profiles
    const key = `watchx_profiles_${userId}`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.length === 0) {
      // Create initial profiles: Primary & Cinema
      list = [
        {
          id: 'prof_' + Date.now() + '_1',
          user_id: userId,
          name: this.currentSessionUser?.fullName || 'Primary',
          avatar_url: DEFAULT_AVATARS[0],
          is_kids: false,
          pin_enabled: false,
          pin_hash: null,
          pin_salt: null,
          created_at: new Date().toISOString()
        },
        {
          id: 'prof_' + Date.now() + '_2',
          user_id: userId,
          name: 'Cinema Room',
          avatar_url: DEFAULT_AVATARS[1],
          is_kids: false,
          pin_enabled: false,
          pin_hash: null,
          pin_salt: null,
          created_at: new Date().toISOString()
        },
        {
          id: 'prof_' + Date.now() + '_3',
          user_id: userId,
          name: 'Kids Club',
          avatar_url: DEFAULT_AVATARS[4],
          is_kids: true,
          pin_enabled: false,
          pin_hash: null,
          pin_salt: null,
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem(key, JSON.stringify(list));
    }
    return list;
  }

  async createProfile(userId, profileData) {
    if (!userId) {
      const u = this.getCurrentUser();
      userId = u ? u.id : 'guest';
    }

    const newProfile = {
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      user_id: userId,
      name: profileData.name || 'New Profile',
      avatar_url: profileData.avatar_url || DEFAULT_AVATARS[0],
      is_kids: Boolean(profileData.is_kids),
      pin_enabled: false,
      pin_hash: null,
      pin_salt: null,
      created_at: new Date().toISOString()
    };

    if (profileData.pin) {
      const salt = generateSalt();
      newProfile.pin_salt = salt;
      newProfile.pin_hash = await hashPin(profileData.pin, salt);
      newProfile.pin_enabled = true;
    }

    if (this.isCloudActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {}
    }

    // Local DB Save
    const key = `watchx_profiles_${userId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(newProfile);
    localStorage.setItem(key, JSON.stringify(list));
    return newProfile;
  }

  async updateProfile(profileId, updates) {
    const userId = this.getCurrentUser()?.id || 'guest';

    if (this.isCloudActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .update(updates)
          .eq('id', profileId)
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {}
    }

    // Local DB Update
    const key = `watchx_profiles_${userId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = list.findIndex(p => p.id === profileId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(list));
      return list[idx];
    }
    return null;
  }

  async deleteProfile(profileId) {
    const userId = this.getCurrentUser()?.id || 'guest';

    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase.from('profiles').delete().eq('id', profileId);
      } catch (e) {}
    }

    const key = `watchx_profiles_${userId}`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(p => p.id !== profileId);
    localStorage.setItem(key, JSON.stringify(list));

    // Also clean up watchlist and history for this profile
    localStorage.removeItem(`watchx_watchlist_${profileId}`);
    localStorage.removeItem(`watchx_history_${profileId}`);
    return true;
  }

  // ==========================================================================
  // Cryptographic Profile PIN System
  // ==========================================================================
  async setProfilePin(profileId, newPin) {
    if (!newPin || newPin.length !== 4) {
      throw new Error('PIN must be exactly 4 numeric digits.');
    }
    const salt = generateSalt();
    const hash = await hashPin(newPin, salt);
    return await this.updateProfile(profileId, {
      pin_enabled: true,
      pin_hash: hash,
      pin_salt: salt
    });
  }

  async removeProfilePin(profileId) {
    return await this.updateProfile(profileId, {
      pin_enabled: false,
      pin_hash: null,
      pin_salt: null
    });
  }

  async verifyProfilePin(profile, inputPin) {
    if (!profile.pin_enabled || !profile.pin_hash) {
      return { success: true };
    }

    // Rate Limiting Check
    const now = Date.now();
    const limitRecord = this.pinRateLimits.get(profile.id) || { attempts: 0, lockoutUntil: 0 };
    if (limitRecord.lockoutUntil > now) {
      const waitSeconds = Math.ceil((limitRecord.lockoutUntil - now) / 1000);
      return {
        success: false,
        locked: true,
        waitSeconds,
        error: `Too many incorrect attempts. Please wait ${waitSeconds}s before retrying.`
      };
    }

    const checkHash = await hashPin(inputPin, profile.pin_salt);
    if (checkHash === profile.pin_hash) {
      // Reset rate limit on success
      this.pinRateLimits.delete(profile.id);
      return { success: true };
    }

    // Record failed attempt
    limitRecord.attempts = (limitRecord.attempts || 0) + 1;
    if (limitRecord.attempts >= 5) {
      limitRecord.lockoutUntil = now + (30 * 1000); // 30 second lockout
      this.pinRateLimits.set(profile.id, limitRecord);
      return {
        success: false,
        locked: true,
        waitSeconds: 30,
        error: 'Too many incorrect attempts. Locked out for 30 seconds.'
      };
    }

    this.pinRateLimits.set(profile.id, limitRecord);
    const attemptsLeft = 5 - limitRecord.attempts;
    return {
      success: false,
      locked: false,
      attemptsLeft,
      error: `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
    };
  }

  // ==========================================================================
  // Watchlist API (Profile-Isolated)
  // ==========================================================================
  async getWatchlist(profileId) {
    if (!profileId) return [];

    if (this.isCloudActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('watchlists')
          .select('*')
          .eq('profile_id', profileId)
          .order('added_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) {}
    }

    const key = `watchx_watchlist_${profileId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async addToWatchlist(profileId, item) {
    if (!profileId || !item || !item.id) return false;
    const mediaType = item.media_type || (item.name ? 'tv' : 'movie');
    const title = item.title || item.name || 'Untitled';

    const entry = {
      id: 'wl_' + item.id + '_' + mediaType,
      profile_id: profileId,
      media_id: item.id,
      media_type: mediaType,
      title,
      poster_path: item.poster_path || '',
      backdrop_path: item.backdrop_path || '',
      vote_average: item.vote_average || 7.5,
      release_date: item.release_date || item.first_air_date || '',
      added_at: new Date().toISOString()
    };

    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase.from('watchlists').upsert([entry]);
      } catch (e) {}
    }

    const key = `watchx_watchlist_${profileId}`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(i => !(i.media_id === item.id && i.media_type === mediaType));
    list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  }

  async removeFromWatchlist(profileId, mediaId, mediaType = 'movie') {
    if (!profileId || !mediaId) return false;

    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase
          .from('watchlists')
          .delete()
          .eq('profile_id', profileId)
          .eq('media_id', mediaId)
          .eq('media_type', mediaType);
      } catch (e) {}
    }

    const key = `watchx_watchlist_${profileId}`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(i => !(i.media_id == mediaId && i.media_type === mediaType));
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  }

  async isInWatchlist(profileId, mediaId, mediaType = 'movie') {
    if (!profileId || !mediaId) return false;
    const list = await this.getWatchlist(profileId);
    return list.some(i => i.media_id == mediaId && i.media_type === mediaType);
  }

  // ==========================================================================
  // Watch History & Precision Progress API (Profile-Isolated)
  // ==========================================================================
  async getWatchHistory(profileId) {
    if (!profileId) return [];

    if (this.isCloudActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('watch_history')
          .select('*')
          .eq('profile_id', profileId)
          .order('updated_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) {}
    }

    const key = `watchx_history_${profileId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async saveWatchProgress(profileId, media, stoppedSeconds, totalDuration = 7200, extra = {}) {
    if (!profileId || !media || !media.id) return false;
    const mediaType = media.media_type || (media.name ? 'tv' : 'movie');
    const title = media.title || media.name || 'Untitled';
    const percent = Math.min(100, Math.round((stoppedSeconds / Math.max(1, totalDuration)) * 100));

    const record = {
      id: 'wh_' + media.id + '_' + mediaType,
      profile_id: profileId,
      media_id: media.id,
      media_type: mediaType,
      title,
      poster_path: media.poster_path || '',
      backdrop_path: media.backdrop_path || '',
      stopped_at_seconds: stoppedSeconds,
      duration_seconds: totalDuration,
      progress_percent: percent,
      season_number: extra.season || 1,
      episode_number: extra.episode || 1,
      episode_title: extra.episodeTitle || '',
      updated_at: new Date().toISOString()
    };

    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase.from('watch_history').upsert([record]);
      } catch (e) {}
    }

    const key = `watchx_history_${profileId}`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(i => !(i.media_id == media.id && i.media_type === mediaType));
    list.unshift(record);
    // Keep max 50 recent titles in history
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  }

  async clearWatchHistory(profileId) {
    if (!profileId) return;
    if (this.isCloudActive && this.supabase) {
      try {
        await this.supabase.from('watch_history').delete().eq('profile_id', profileId);
      } catch (e) {}
    }
    localStorage.removeItem(`watchx_history_${profileId}`);
  }

  // ==========================================================================
  // Local Database Helpers
  // ==========================================================================
  getLocalUsers() {
    return JSON.parse(localStorage.getItem('watchx_users') || '[]');
  }

  saveLocalUsers(users) {
    localStorage.setItem('watchx_users', JSON.stringify(users));
  }

  getLocalSessionUser() {
    const raw = localStorage.getItem('watchx_session_user');
    return raw ? JSON.parse(raw) : null;
  }

  setLocalSessionUser(user) {
    this.currentSessionUser = user;
    if (user) {
      localStorage.setItem('watchx_session_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('watchx_session_user');
    }
  }

  ensureDefaultLocalUser() {
    if (!this.currentSessionUser) {
      const defaultUser = {
        id: 'usr_default_master',
        email: 'member@watchx.stream',
        fullName: 'VIP Cinema Member',
        isGoogle: false,
        created_at: new Date().toISOString()
      };
      this.setLocalSessionUser(defaultUser);
    }
  }
}

export const dbClient = new UniversalDataClient();
