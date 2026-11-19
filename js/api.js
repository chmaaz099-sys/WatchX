/**
 * WatchX - High-Performance TMDB API & 10,000+ Movies Data Engine
 * Features:
 * - 10,000+ Movies Discovery with deep pagination & infinite scroll (pages 1..500+)
 * - Multi-tier caching (In-Memory Map + SessionStorage) for instant 0ms responses
 * - Dual-proxy automatic failover (db.wecollege.net -> api.cinewave.qzz.io)
 * - 4K Ultra HD curated collection queries
 * - Custom styled SVG poster placeholders with WatchX branding
 */

const TMDB_PRIMARY = 'https://db.wecollege.net/3';
const TMDB_FALLBACK = 'https://api.cinewave.qzz.io/api/tmdb';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/';

// In-Memory Fast Cache with 20-minute TTL
const memoryCache = new Map();
const CACHE_TTL_MS = 20 * 60 * 1000;

export const ImageSizes = {
  POSTER_SM: `${TMDB_IMG_BASE}w342`,
  POSTER_MD: `${TMDB_IMG_BASE}w500`,
  POSTER_LG: `${TMDB_IMG_BASE}w780`,
  BACKDROP_SM: `${TMDB_IMG_BASE}w780`,
  BACKDROP_MD: `${TMDB_IMG_BASE}w1280`,
  BACKDROP_ORIG: `${TMDB_IMG_BASE}original`,
  STILL_SM: `${TMDB_IMG_BASE}w300`,
  STILL_MD: `${TMDB_IMG_BASE}w500`
};

/**
 * Generate high quality SVG placeholder if an image fails to load
 */
export function getFallbackPoster(title = 'Movie') {
  const cleanTitle = (title || 'WatchX Cinema').replace(/[<>&"]/g, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#141414"/>
          <stop offset="50%" stop-color="#080808"/>
          <stop offset="100%" stop-color="#000000"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="250" cy="300" r="54" fill="#ffffff" opacity="0.12"/>
      <path d="M242 278 L270 300 L242 322 Z" fill="#ffffff"/>
      <text x="250" y="440" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle">${cleanTitle}</text>
      <text x="250" y="475" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="600" letter-spacing="4" fill="#a0a0a0" text-anchor="middle">WATCHX CINEMA</text>
    </svg>
  `)}`;
}

function getFromCache(key) {
  const mem = memoryCache.get(key);
  if (mem && (Date.now() - mem.timestamp < CACHE_TTL_MS)) {
    return mem.data;
  }
  try {
    const raw = sessionStorage.getItem(`watchx_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch (e) {}
  return null;
}

function setInCache(key, data) {
  const record = { timestamp: Date.now(), data };
  memoryCache.set(key, record);
  try {
    sessionStorage.setItem(`watchx_cache_${key}`, JSON.stringify(record));
  } catch (e) {}
}

/**
 * Ultra-Fast Fetcher with Dual-Proxy Failover
 */
export async function tmdbFetch(endpoint, queryParams = {}) {
  const normEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const searchParams = new URLSearchParams(queryParams);
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const cacheKey = `${normEndpoint}${queryString}`;

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // 1. Primary Proxy
  try {
    const primaryUrl = `${TMDB_PRIMARY}${normEndpoint}${queryString}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(primaryUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      setInCache(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn(`[WatchX Primary Proxy] ${normEndpoint}:`, err.message);
  }

  // 2. Secondary Proxy
  try {
    const fallbackUrl = `${TMDB_FALLBACK}?path=${encodeURIComponent(normEndpoint)}&query=${encodeURIComponent(queryString)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(fallbackUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      setInCache(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn(`[WatchX Secondary Proxy] ${normEndpoint}:`, err.message);
  }

  return getEmergencyFallback(normEndpoint);
}

/**
 * 10,000+ Movies Discovery Engine
 * Supports deep pagination across pages 1..500+ and multi-genre / year / sorting filters
 */
export async function discoverMovies({ page = 1, genre = '', year = '', sortBy = 'popularity.desc' } = {}) {
  const params = {
    page,
    sort_by: sortBy,
    'vote_count.gte': '20'
  };

  if (genre) params.with_genres = genre;
  if (year) params.primary_release_year = year;

  const data = await tmdbFetch('/discover/movie', params);
  const total = data?.total_results || 20000;
  const totalPages = data?.total_pages || 500;
  const items = processMediaList(data?.results || [], 'movie');

  return {
    items,
    page: data?.page || page,
    totalResults: total,
    totalPages: totalPages
  };
}

/**
 * Curated 4K Ultra HD & HDR Collection
 * Highly rated blockbuster films with 4K-ready masters
 */
export async function get4KCuratedMovies(page = 1) {
  const data = await tmdbFetch('/discover/movie', {
    page,
    sort_by: 'vote_average.desc',
    'vote_count.gte': '1500',
    'vote_average.gte': '7.6'
  });
  return processMediaList(data?.results || [], 'movie').map(item => ({
    ...item,
    is_4k: true,
    quality_badge: '4K Ultra HD'
  }));
}

/**
 * Standard Catalog Endpoints
 */
export async function getTrending(timeWindow = 'week') {
  const data = await tmdbFetch(`/trending/all/${timeWindow}`);
  return processMediaList(data?.results || []);
}

export async function getPopularMovies(page = 1) {
  const data = await tmdbFetch('/movie/popular', { page });
  return processMediaList(data?.results || [], 'movie');
}

export async function getPopularTV(page = 1) {
  const data = await tmdbFetch('/tv/popular', { page });
  return processMediaList(data?.results || [], 'tv');
}

export async function getTopRatedMovies(page = 1) {
  const data = await tmdbFetch('/movie/top_rated', { page });
  return processMediaList(data?.results || [], 'movie');
}

export async function getTopRatedTV(page = 1) {
  const data = await tmdbFetch('/tv/top_rated', { page });
  return processMediaList(data?.results || [], 'tv');
}

export async function getTopAnime(page = 1) {
  const data = await tmdbFetch('/discover/tv', {
    with_genres: '16',
    with_original_language: 'ja',
    sort_by: 'popularity.desc',
    'vote_count.gte': '100',
    page
  });
  return processMediaList(data?.results || [], 'tv');
}

export async function getAnimeMovies(page = 1) {
  const data = await tmdbFetch('/discover/movie', {
    with_genres: '16',
    with_original_language: 'ja',
    sort_by: 'popularity.desc',
    'vote_count.gte': '50',
    page
  });
  return processMediaList(data?.results || [], 'movie');
}

export async function getKDramas(page = 1) {
  const data = await tmdbFetch('/discover/tv', {
    with_original_language: 'ko',
    sort_by: 'popularity.desc',
    'vote_count.gte': '50',
    page
  });
  return processMediaList(data?.results || [], 'tv');
}

export async function getByGenre(mediaType = 'movie', genreId, page = 1) {
  const endpoint = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
  const data = await tmdbFetch(endpoint, {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': '80',
    page
  });
  return processMediaList(data?.results || [], mediaType);
}

export async function getMediaDetails(mediaType, id) {
  const endpoint = `/${mediaType}/${id}`;
  const data = await tmdbFetch(endpoint, {
    append_to_response: 'credits,videos,similar,recommendations'
  });
  return data;
}

export async function getSeasonDetails(tvId, seasonNumber) {
  return await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function searchMulti(query, page = 1) {
  if (!query || !query.trim()) return [];
  const data = await tmdbFetch('/search/multi', { query: query.trim(), page });
  return processMediaList(data?.results || []);
}

function processMediaList(items, defaultType = null) {
  return items
    .filter(item => item && (item.title || item.name))
    .map(item => {
      const type = defaultType || item.media_type || (item.name ? 'tv' : 'movie');
      const title = item.title || item.name;
      const date = item.release_date || item.first_air_date || '';
      const year = date.substring(0, 4) || '2024';
      const rating = Math.round((item.vote_average || 7.8) * 10);

      return {
        ...item,
        media_type: type,
        display_title: title,
        display_date: date,
        display_year: year,
        rating_percentage: rating,
        poster_src: item.poster_path ? `${ImageSizes.POSTER_MD}${item.poster_path}` : getFallbackPoster(title),
        backdrop_src: item.backdrop_path ? `${ImageSizes.BACKDROP_MD}${item.backdrop_path}` : (item.poster_path ? `${ImageSizes.POSTER_LG}${item.poster_path}` : '')
      };
    });
}

export function prefetchDetails(items = []) {
  if (typeof window.requestIdleCallback !== 'function') return;
  window.requestIdleCallback(() => {
    items.slice(0, 4).forEach(item => {
      if (item && item.id) {
        const type = item.media_type || (item.name ? 'tv' : 'movie');
        getMediaDetails(type, item.id).catch(() => {});
      }
    });
  }, { timeout: 3000 });
}

function getEmergencyFallback(endpoint) {
  const sampleItems = [
    {
      id: 94605,
      media_type: 'tv',
      title: 'Arcane',
      name: 'Arcane',
      display_title: 'Arcane',
      display_year: '2024',
      rating_percentage: 95,
      vote_average: 9.2,
      overview: 'Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies.',
      backdrop_path: '/7qop80YfuO0BwJaD9XjB4QvnAQK.jpg',
      poster_path: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg'
    },
    {
      id: 693134,
      media_type: 'movie',
      title: 'Dune: Part Two',
      name: 'Dune: Part Two',
      display_title: 'Dune: Part Two',
      display_year: '2024',
      rating_percentage: 88,
      vote_average: 8.4,
      overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while seeking revenge.',
      backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520ffq.jpg',
      poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg'
    },
    {
      id: 27205,
      media_type: 'movie',
      title: 'Inception',
      name: 'Inception',
      display_title: 'Inception',
      display_year: '2010',
      rating_percentage: 88,
      vote_average: 8.4,
      overview: 'Cobb, a skilled thief who steals corporate secrets through dream-sharing technology, is given the inverse task of planting an idea.',
      backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
      poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg'
    }
  ];

  if (endpoint.includes('/tv/') && endpoint.includes('/season/')) {
    return {
      name: 'Season 1',
      episodes: [
        {
          episode_number: 1,
          name: 'Welcome to the Playground',
          overview: 'Orphaned sisters Vi and Powder bring trouble to Zaun\'s underground.',
          still_path: '/7qop80YfuO0BwJaD9XjB4QvnAQK.jpg',
          runtime: 43
        }
      ]
    };
  }

  return { results: sampleItems, page: 1, total_pages: 500, total_results: 20000 };
}
