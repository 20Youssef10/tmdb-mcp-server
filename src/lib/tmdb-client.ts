/**
 * TMDB API Client Module
 * 
 * Provides a robust, type-safe wrapper around The Movie Database API v3
 * with error handling, rate-limit awareness, and Cloudflare Cache integration.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface TMDBConfig {
  apiKey: string;
  baseUrl: string;
  imageBaseUrl: string;
}

export interface TMDBErrorResponse {
  status_code: number;
  status_message: string;
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }

  const cause = error.cause;
  if (cause && typeof cause === 'object') {
    const code = 'code' in cause ? String((cause as { code?: unknown }).code) : undefined;
    const message = 'message' in cause ? String((cause as { message?: unknown }).message) : undefined;
    const nestedErrors = 'errors' in cause ? (cause as { errors?: unknown[] }).errors : undefined;
    const nestedMessage = Array.isArray(nestedErrors) && nestedErrors[0] instanceof Error
      ? nestedErrors[0].message
      : undefined;

    if (code && message) {
      return `${error.message} (${code}: ${message})`;
    }
    if (message && nestedMessage && message !== nestedMessage) {
      return `${error.message} (${message}; ${nestedMessage})`;
    }
    if (message) {
      return `${error.message} (${message})`;
    }
    if (nestedMessage) {
      return `${error.message} (${nestedMessage})`;
    }
  }

  return error.message;
}

// Cloudflare Workers global types
declare const caches: {
  open(cacheName: string): Promise<Cache>;
};

interface Cache {
  match(request: string | object): Promise<Response | undefined>;
  put(request: string | object, response: Response): Promise<void>;
}

interface Response {
  clone(): Response;
  json(): Promise<unknown>;
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: { get?: (name: string) => string | null };
}

// Global URLSearchParams for Cloudflare Workers
declare const URLSearchParams: {
  new(init?: string | Record<string, string>): URLSearchParams;
  prototype: URLSearchParams;
};

interface URLSearchParams {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  sort(): void;
  toString(): string;
  [Symbol.iterator](): IterableIterator<[string, string]>;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(callback: (value: string, name: string) => void): void;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  video: boolean;
  original_language: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  budget: number;
  revenue: number;
  runtime: number | null;
  status: string;
  tagline: string;
  imdb_id: string | null;
  homepage: string | null;
  production_companies: Array<{ id: number; name: string; logo_path: string | null }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string; english_name: string }>;
  genres: Array<{ id: number; name: string }>;
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      order: number;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  };
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
}

export interface TMDBTVShowDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  last_air_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  status: string;
  type: string;
  tagline: string;
  homepage: string | null;
  in_production: boolean;
  languages: string[];
  last_episode_to_air: Record<string, unknown> | null;
  next_episode_to_air: Record<string, unknown> | null;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_path: string | null }>;
  seasons: Array<{
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }>;
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      order: number;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }>;
  };
}

export interface TMDBPerson {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  popularity: number;
  known_for_department: string;
  known_for: Array<TMDBMovie | TMDBTVShow>;
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  original_name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  popularity: number;
  known_for_department: string;
  also_known_as: string[];
  homepage: string | null;
  imdb_id: string | null;
  credits: {
    cast: Array<{
      id: number;
      title?: string;
      name?: string;
      character: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
    }>;
    crew: Array<{
      id: number;
      title?: string;
      name?: string;
      job: string;
      department: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
    }>;
  };
}

export interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface DiscoverOptions {
  with_genres?: string;
  primary_release_year?: number;
  year?: number;
  'vote_average.gte'?: number;
  sort_by?: string;
  page?: number;
  language?: string;
}

export type TrendingMediaType = 'movie' | 'tv' | 'person' | 'all';
export type TrendingTimeWindow = 'day' | 'week';

// ============================================================================
// Error Classes
// ============================================================================

export class TMDBError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusMessage?: string
  ) {
    super(message);
    this.name = 'TMDBError';
  }
}

export class TMDBRateLimitError extends Error {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'TMDBRateLimitError';
  }
}

// ============================================================================
// Image URL Helpers
// ============================================================================

export const IMAGE_SIZES = {
  poster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
  backdrop: ['w300', 'w780', 'w1280', 'original'],
  profile: ['w45', 'w185', 'h632', 'original'],
  logo: ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'],
} as const;

export type ImageSize = typeof IMAGE_SIZES[keyof typeof IMAGE_SIZES][number];

/**
 * Constructs a full TMDB image URL from a path and size.
 * @param imageBaseUrl - The base URL for TMDB images
 * @param path - The image path from TMDB API (e.g., "/abc123.jpg")
 * @param size - The desired image size (default: "w500")
 * @returns Full image URL or null if path is null/empty
 */
export function buildImageUrl(
  imageBaseUrl: string,
  path: string | null | undefined,
  size: ImageSize = 'w500'
): string | null {
  if (!path) return null;
  return `${imageBaseUrl}/${size}${path}`;
}

/**
 * Transforms a TMDB response object, converting all image paths to full URLs.
 */
export function transformImages<T extends Record<string, unknown>>(
  imageBaseUrl: string,
  data: T,
  size: ImageSize = 'w500'
): T {
  const result = { ...data } as Record<string, unknown>;

  // Handle common image path fields
  const imageFields = ['poster_path', 'backdrop_path', 'profile_path', 'logo_path'];
  for (const field of imageFields) {
    if (field in result && typeof result[field] === 'string') {
      result[field] = buildImageUrl(imageBaseUrl, result[field] as string, size);
    }
  }

  return result as T;
}

// ============================================================================
// TMDB Client Class
// ============================================================================

export class TMDBClient {
  private config: TMDBConfig;
  private cache: Cache | null = null;

  constructor(config: TMDBConfig) {
    this.config = config;
  }

  /**
   * Initialize the cache (Cloudflare Cache API)
   */
  async initializeCache(): Promise<void> {
    if ('caches' in globalThis) {
      try {
        this.cache = await caches.open('tmdb-mcp');
      } catch {
        this.cache = null;
      }
    }
  }

  /**
   * Build the full URL for a TMDB API request.
   */
  private buildUrl(endpoint: string, params: Record<string, string | number | boolean> = {}): string {
    const baseUrl = `${this.config.baseUrl}${endpoint}`;
    const searchParams = new URLSearchParams();
    searchParams.set('api_key', this.config.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }

    return `${baseUrl}?${searchParams.toString()}`;
  }

  /**
   * Execute a fetch request to the TMDB API with error handling and caching.
   */
  async fetch<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    options: { useCache?: boolean; cacheTtl?: number } = {}
  ): Promise<T> {
    const { useCache = true } = options;
    const url = this.buildUrl(endpoint, params);
    const cacheKey = url;

    // Try to get from cache first
    if (useCache && this.cache) {
      try {
        const cachedResponse = await this.cache.match(cacheKey);
        if (cachedResponse) {
          const cachedData = await cachedResponse.clone().json() as T;
          return cachedData;
        }
      } catch {
        // Cache miss or error, continue with fetch
      }
    }

    // Execute the fetch
    let response: object;
    try {
      // Use the global fetch function available in Cloudflare Workers
      const fetchFn = (globalThis as unknown as { fetch: (input: string, init?: object) => Promise<object> }).fetch;
      response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (error) {
      throw new TMDBError(
        `Network error: ${describeNetworkError(error)}`,
        0
      );
    }

    // Handle rate limiting
    const respStatus = (response as { status?: number }).status;
    if (respStatus === 429) {
      const respHeaders = (response as { headers?: { get?: (name: string) => string | null } }).headers;
      const retryAfter = respHeaders?.get?.('Retry-After');
      throw new TMDBRateLimitError(
        'TMDB API rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
    }

    // Handle other errors
    const respOk = (response as { ok?: boolean }).ok;
    if (!respOk) {
      let errorData: TMDBErrorResponse | null = null;
      try {
        errorData = await (response as { json: () => Promise<TMDBErrorResponse> }).json();
      } catch {
        // Ignore JSON parse errors
      }

      const resp = response as { status?: number; statusText?: string };
      throw new TMDBError(
        errorData?.status_message || `HTTP ${resp.status}: ${resp.statusText}`,
        resp.status || 500,
        errorData?.status_message
      );
    }

    // Parse the response
    const data = await (response as { clone: () => Response }).clone().json() as T;

    // Cache the response
    if (useCache && this.cache) {
      try {
        await this.cache.put(cacheKey, (response as Response).clone());
      } catch {
        // Ignore cache errors
      }
    }

    return data;
  }

  // ============================================================================
  // Movie Endpoints
  // ============================================================================

  /**
   * Search for movies by title.
   */
  async searchMovies(
    query: string,
    options: { year?: number; page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBMovie>> {
    const params: Record<string, string | number> = {
      query,
      page: options.page || 1,
      language: options.language || 'en-US',
    };
    if (options.year !== undefined) params.year = options.year;
    return this.fetch<TMDBSearchResponse<TMDBMovie>>('/search/movie', params);
  }

  /**
   * Get detailed information for a specific movie.
   */
  async getMovieDetails(
    movieId: number,
    options: { appendToResponse?: string; language?: string } = {}
  ): Promise<TMDBMovieDetails> {
    return this.fetch<TMDBMovieDetails>(`/movie/${movieId}`, {
      append_to_response: options.appendToResponse || 'credits',
      language: options.language || 'en-US',
    });
  }

  // ============================================================================
  // TV Show Endpoints
  // ============================================================================

  /**
   * Search for TV shows by name.
   */
  async searchTVShows(
    query: string,
    options: { year?: number; page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBTVShow>> {
    const params: Record<string, string | number> = {
      query,
      page: options.page || 1,
      language: options.language || 'en-US',
    };
    if (options.year !== undefined) params.first_air_date_year = options.year;
    return this.fetch<TMDBSearchResponse<TMDBTVShow>>('/search/tv', params);
  }

  /**
   * Get detailed information for a specific TV show.
   */
  async getTVShowDetails(
    tvId: number,
    options: { appendToResponse?: string; language?: string } = {}
  ): Promise<TMDBTVShowDetails> {
    return this.fetch<TMDBTVShowDetails>(`/tv/${tvId}`, {
      append_to_response: options.appendToResponse || 'credits',
      language: options.language || 'en-US',
    });
  }

  // ============================================================================
  // Person Endpoints
  // ============================================================================

  /**
   * Search for people (actors, directors, crew).
   */
  async searchPeople(
    query: string,
    options: { page?: number } = {}
  ): Promise<TMDBSearchResponse<TMDBPerson>> {
    return this.fetch<TMDBSearchResponse<TMDBPerson>>('/search/person', {
      query,
      page: options.page || 1,
    });
  }

  /**
   * Get detailed information for a specific person.
   */
  async getPersonDetails(
    personId: number,
    options: { appendToResponse?: string } = {}
  ): Promise<TMDBPersonDetails> {
    return this.fetch<TMDBPersonDetails>(`/person/${personId}`, {
      append_to_response: options.appendToResponse || 'credits',
    });
  }

  // ============================================================================
  // Discover & Trending Endpoints
  // ============================================================================

  /**
   * Discover movies with advanced filtering options.
   */
  async discoverMovies(options: DiscoverOptions = {}): Promise<TMDBSearchResponse<TMDBMovie>> {
    const params: Record<string, string | number> = {
      media_type: 'movie',
      page: options.page || 1,
      language: options.language || 'en-US',
    };

    if (options.with_genres) params.with_genres = options.with_genres;
    if (options.primary_release_year) params.primary_release_year = options.primary_release_year;
    if (options.year) params.year = options.year;
    if (options['vote_average.gte']) params['vote_average.gte'] = options['vote_average.gte'];
    if (options.sort_by) params.sort_by = options.sort_by;

    return this.fetch<TMDBSearchResponse<TMDBMovie>>('/discover/movie', params);
  }

  /**
   * Get trending content.
   */
  async getTrending(
    mediaType: TrendingMediaType = 'all',
    timeWindow: TrendingTimeWindow = 'week'
  ): Promise<TMDBSearchResponse<TMDBMovie | TMDBTVShow | TMDBPerson>> {
    return this.fetch<TMDBSearchResponse<TMDBMovie | TMDBTVShow | TMDBPerson>>(
      `/trending/${mediaType}/${timeWindow}`
    );
  }

  /**
   * Get account-level TMDB configuration for images and change keys.
   */
  async getConfiguration(): Promise<{
    images: {
      base_url: string;
      secure_base_url: string;
      backdrop_sizes: string[];
      logo_sizes: string[];
      poster_sizes: string[];
      profile_sizes: string[];
      still_sizes: string[];
    };
    change_keys: string[];
  }> {
    return this.fetch('/configuration', {}, { useCache: false });
  }

  /**
   * Get the list of genres for movies or TV shows.
   */
  async getGenres(type: 'movie' | 'tv' = 'movie'): Promise<{ genres: TMDBGenre[] }> {
    return this.fetch<{ genres: TMDBGenre[] }>(`/genre/${type}/list`);
  }

  // ============================================================================
  // Additional Movie Endpoints
  // ============================================================================

  /**
   * Get movie recommendations based on a movie.
   */
  async getMovieRecommendations(
    movieId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBMovie>> {
    return this.fetch<TMDBSearchResponse<TMDBMovie>>(`/movie/${movieId}/recommendations`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get movies similar to a specific movie.
   */
  async getSimilarMovies(
    movieId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBMovie>> {
    return this.fetch<TMDBSearchResponse<TMDBMovie>>(`/movie/${movieId}/similar`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get movie videos (trailers, teasers, etc.).
   */
  async getMovieVideos(
    movieId: number,
    options: { language?: string } = {}
  ): Promise<{ id: number; results: Array<{ id: string; key: string; name: string; site: string; size: number; type: string }> }> {
    return this.fetch(`/movie/${movieId}/videos`, {
      language: options.language || 'en-US',
    });
  }

  /**
   * Get movie images (posters, backdrops, logos).
   */
  async getMovieImages(
    movieId: number,
    options: { includeLanguages?: string[] } = {}
  ): Promise<{ id: number; backdrops: ImageData[]; posters: ImageData[]; logos: ImageData[] }> {
    const params: Record<string, string> = {};
    if (options.includeLanguages && options.includeLanguages.length > 0) {
      params.include_image_language = options.includeLanguages.join(',');
    }
    return this.fetch(`/movie/${movieId}/images`, params);
  }

  /**
   * Get movie reviews.
   */
  async getMovieReviews(
    movieId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<{ page: number; results: Array<{ id: string; author: string; content: string; url: string; created_at: string }>; total_pages: number; total_results: number }> {
    return this.fetch(`/movie/${movieId}/reviews`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get now playing movies in theaters.
   */
  async getNowPlayingMovies(
    options: { page?: number; language?: string; region?: string } = {}
  ): Promise<{ page: number; results: TMDBMovie[]; dates: { maximum: string; minimum: string }; total_pages: number; total_results: number }> {
    return this.fetch('/movie/now_playing', {
      page: options.page || 1,
      language: options.language || 'en-US',
      region: options.region || 'US',
    });
  }

  /**
   * Get upcoming movies (next 2 weeks).
   */
  async getUpcomingMovies(
    options: { page?: number; language?: string; region?: string } = {}
  ): Promise<{ page: number; results: TMDBMovie[]; dates: { maximum: string; minimum: string }; total_pages: number; total_results: number }> {
    return this.fetch('/movie/upcoming', {
      page: options.page || 1,
      language: options.language || 'en-US',
      region: options.region || 'US',
    });
  }

  /**
   * Get popular movies.
   */
  async getPopularMovies(
    options: { page?: number; language?: string; region?: string } = {}
  ): Promise<{ page: number; results: TMDBMovie[]; total_pages: number; total_results: number }> {
    return this.fetch('/movie/popular', {
      page: options.page || 1,
      language: options.language || 'en-US',
      region: options.region || 'US',
    });
  }

  /**
   * Get top rated movies.
   */
  async getTopRatedMovies(
    options: { page?: number; language?: string; region?: string } = {}
  ): Promise<{ page: number; results: TMDBMovie[]; total_pages: number; total_results: number }> {
    return this.fetch('/movie/top_rated', {
      page: options.page || 1,
      language: options.language || 'en-US',
      region: options.region || 'US',
    });
  }

  /**
   * Get latest movie.
   */
  async getLatestMovie(options: { language?: string } = {}): Promise<TMDBMovieDetails> {
    return this.fetch<TMDBMovieDetails>('/movie/latest', {
      language: options.language || 'en-US',
    });
  }

  // ============================================================================
  // Additional TV Show Endpoints
  // ============================================================================

  /**
   * Get TV show recommendations.
   */
  async getTVRecommendations(
    tvId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBTVShow>> {
    return this.fetch<TMDBSearchResponse<TMDBTVShow>>(`/tv/${tvId}/recommendations`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get TV shows similar to a specific show.
   */
  async getSimilarTVShows(
    tvId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<TMDBSearchResponse<TMDBTVShow>> {
    return this.fetch<TMDBSearchResponse<TMDBTVShow>>(`/tv/${tvId}/similar`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get TV show images.
   */
  async getTVImages(
    tvId: number,
    options: { includeLanguages?: string[] } = {}
  ): Promise<{ id: number; backdrops: ImageData[]; posters: ImageData[]; logos: ImageData[] }> {
    const params: Record<string, string> = {};
    if (options.includeLanguages && options.includeLanguages.length > 0) {
      params.include_image_language = options.includeLanguages.join(',');
    }
    return this.fetch(`/tv/${tvId}/images`, params);
  }

  /**
   * Get TV show reviews.
   */
  async getTVReviews(
    tvId: number,
    options: { page?: number; language?: string } = {}
  ): Promise<{ page: number; results: Array<{ id: string; author: string; content: string; url: string; created_at: string }>; total_pages: number; total_results: number }> {
    return this.fetch(`/tv/${tvId}/reviews`, {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get TV show videos.
   */
  async getTVVideos(
    tvId: number,
    options: { language?: string } = {}
  ): Promise<{ id: number; results: Array<{ id: string; key: string; name: string; site: string; size: number; type: string }> }> {
    return this.fetch(`/tv/${tvId}/videos`, {
      language: options.language || 'en-US',
    });
  }

  /**
   * Get season details.
   */
  async getSeasonDetails(
    tvId: number,
    seasonNumber: number,
    options: { language?: string; appendToResponse?: string } = {}
  ): Promise<{
    id: number;
    name: string;
    overview: string;
    season_number: number;
    air_date: string | null;
    episodes: Array<{
      id: number;
      name: string;
      episode_number: number;
      overview: string;
      air_date: string | null;
      still_path: string | null;
      vote_average: number;
      vote_count: number;
      crew: Array<{ id: number; name: string; job: string }>;
      guest_stars: Array<{ id: number; name: string; character: string }>;
    }>;
    poster_path: string | null;
  }> {
    const params: Record<string, string> = {
      language: options.language || 'en-US',
    };
    if (options.appendToResponse) params.append_to_response = options.appendToResponse;
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}`, params);
  }

  /**
   * Get episode details.
   */
  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    options: { language?: string; appendToResponse?: string } = {}
  ): Promise<{
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    air_date: string | null;
    still_path: string | null;
    vote_average: number;
    vote_count: number;
    crew: Array<{ id: number; name: string; job: string }>;
    guest_stars: Array<{ id: number; name: string; character: string }>;
  }> {
    const params: Record<string, string> = {
      language: options.language || 'en-US',
    };
    if (options.appendToResponse) params.append_to_response = options.appendToResponse;
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`, params);
  }

  /**
   * Get airing today TV shows.
   */
  async getAiringToday(
    options: { page?: number; language?: string; timezone?: string } = {}
  ): Promise<{ page: number; results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    return this.fetch('/tv/airing_today', {
      page: options.page || 1,
      language: options.language || 'en-US',
      timezone: options.timezone || 'America/New_York',
    });
  }

  /**
   * Get on the air TV shows.
   */
  async getOnTheAir(
    options: { page?: number; language?: string } = {}
  ): Promise<{ page: number; results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    return this.fetch('/tv/on_the_air', {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get popular TV shows.
   */
  async getPopularTV(
    options: { page?: number; language?: string } = {}
  ): Promise<{ page: number; results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    return this.fetch('/tv/popular', {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get top rated TV shows.
   */
  async getTopRatedTV(
    options: { page?: number; language?: string } = {}
  ): Promise<{ page: number; results: TMDBTVShow[]; total_pages: number; total_results: number }> {
    return this.fetch('/tv/top_rated', {
      page: options.page || 1,
      language: options.language || 'en-US',
    });
  }

  /**
   * Get latest TV show.
   */
  async getLatestTV(options: { language?: string } = {}): Promise<TMDBTVShowDetails> {
    return this.fetch<TMDBTVShowDetails>('/tv/latest', {
      language: options.language || 'en-US',
    });
  }

  // ============================================================================
  // Additional Person Endpoints
  // ============================================================================

  /**
   * Get person images.
   */
  async getPersonImages(personId: number): Promise<{ id: number; profiles: ImageData[] }> {
    return this.fetch(`/person/${personId}/images`);
  }

  /**
   * Get latest person.
   */
  async getLatestPerson(): Promise<TMDBPersonDetails> {
    return this.fetch<TMDBPersonDetails>('/person/latest');
  }

  // ============================================================================
  // Discover TV Shows
  // ============================================================================

  /**
   * Discover TV shows with advanced filtering.
   */
  async discoverTVShows(options: {
    with_genres?: string;
    first_air_date_year?: number;
    'vote_average.gte'?: number;
    sort_by?: string;
    page?: number;
    language?: string;
  } = {}): Promise<TMDBSearchResponse<TMDBTVShow>> {
    const params: Record<string, string | number> = {
      page: options.page || 1,
      language: options.language || 'en-US',
    };

    if (options.with_genres) params.with_genres = options.with_genres;
    if (options.first_air_date_year) params.first_air_date_year = options.first_air_date_year;
    if (options['vote_average.gte']) params['vote_average.gte'] = options['vote_average.gte'];
    if (options.sort_by) params.sort_by = options.sort_by;

    return this.fetch<TMDBSearchResponse<TMDBTVShow>>('/discover/tv', params);
  }

  // ============================================================================
  // Certifications
  // ============================================================================

  /**
   * Get certifications for movies.
   */
  async getMovieCertifications(): Promise<{ results: Record<string, Array<{ certification: string; meaning: string; order: number }>> }> {
    return this.fetch('/certification/movie/list');
  }

  /**
   * Get certifications for TV shows.
   */
  async getTVCertifications(): Promise<{ results: Record<string, Array<{ certification: string; meaning: string; order: number }>> }> {
    return this.fetch('/certification/tv/list');
  }
}

// ============================================================================
// Additional Types
// ============================================================================

export interface ImageData {
  aspect_ratio: number;
  height: number;
  iso_639_1: string | null;
  file_path: string;
  vote_average: number;
  vote_count: number;
  width: number;
}
