/**
 * MCP Tools Definition for TMDB
 * 
 * Defines all available tools with Zod validation schemas and detailed descriptions
 * to guide LLM usage.
 */

import { z } from 'zod';
import { TMDBClient, buildImageUrl } from './tmdb-client.js';

// ============================================================================
// Tool Input Schemas (Zod)
// ============================================================================

/**
 * Schema for searching movies by title.
 */
export const searchMoviesSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').describe('The movie title to search for'),
  year: z.number().int().min(1900).max(2100).optional().describe('Filter by release year'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination (default: 1)'),
  language: z.string().optional().default('en-US').describe('Language code (e.g., en-US, es-ES)'),
});

/**
 * Schema for getting detailed movie information.
 */
export const getMovieDetailsSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  language: z.string().optional().default('en-US').describe('Language code for localized data'),
});

/**
 * Schema for searching TV shows.
 */
export const searchTVShowsSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').describe('The TV show name to search for'),
  year: z.number().int().min(1900).max(2100).optional().describe('Filter by first air date year'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination (default: 1)'),
  language: z.string().optional().default('en-US').describe('Language code (e.g., en-US, es-ES)'),
});

/**
 * Schema for getting detailed TV show information.
 */
export const getTVShowDetailsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  language: z.string().optional().default('en-US').describe('Language code for localized data'),
});

/**
 * Schema for searching people (actors, directors, crew).
 */
export const searchPersonSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').describe('The person name to search for'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination (default: 1)'),
});

/**
 * Schema for getting detailed person information.
 */
export const getPersonDetailsSchema = z.object({
  person_id: z.number().int().positive('Person ID must be a positive integer').describe('The TMDB person ID'),
});

/**
 * Schema for discovering movies with advanced filters.
 */
export const discoverMoviesSchema = z.object({
  genres: z.string().optional().describe('Comma-separated genre IDs (e.g., "28,12" for Action & Adventure)'),
  year: z.number().int().min(1900).max(2100).optional().describe('Filter by release year'),
  min_rating: z.number().min(0).max(10).optional().describe('Minimum vote average (0-10)'),
  sort_by: z.enum([
    'popularity.asc',
    'popularity.desc',
    'primary_release_date.asc',
    'primary_release_date.desc',
    'original_title.asc',
    'original_title.desc',
    'vote_average.asc',
    'vote_average.desc',
    'vote_count.asc',
    'vote_count.desc',
  ]).optional().default('popularity.desc').describe('Sort order for results'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination (default: 1)'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

/**
 * Schema for getting trending content.
 */
export const getTrendingSchema = z.object({
  media_type: z.enum(['movie', 'tv', 'person', 'all']).optional().default('all').describe('Type of content to fetch'),
  time_window: z.enum(['day', 'week']).optional().default('week').describe('Time window for trending'),
});

// ============================================================================
// Tool Handlers
// ============================================================================

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Creates a standardized error response.
 */
function createErrorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

/**
 * Creates a standardized success response.
 */
function createSuccessResponse(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Search for movies by title.
 * 
 * @description
 * Search for movies using a title query. Optionally filter by release year.
 * Returns a paginated list of matching movies with basic information.
 * 
 * @example
 * // Search for "The Matrix"
 * search_movies({ query: "The Matrix" })
 * 
 * @example
 * // Search for movies from 1999
 * search_movies({ query: "Matrix", year: 1999 })
 */
export async function searchMovies(
  client: TMDBClient,
  args: z.infer<typeof searchMoviesSchema>
): Promise<ToolResult> {
  try {
    const options: { year?: number; page?: number; language?: string } = {
      page: args.page,
      language: args.language,
    };
    if (args.year !== undefined) options.year = args.year;
    
    const result = await client.searchMovies(args.query, options);

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    const transformedResults = {
      ...result,
      results: result.results.map((movie) => ({
        ...movie,
        poster_url: buildImageUrl(imageBaseUrl, movie.poster_path),
        backdrop_url: buildImageUrl(imageBaseUrl, movie.backdrop_path),
      })),
    };

    return createSuccessResponse(transformedResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to search movies: ${message}`);
  }
}

/**
 * Get detailed information for a specific movie.
 * 
 * @description
 * Retrieve comprehensive details about a movie including:
 * - Basic info (title, overview, release date, runtime)
 * - Ratings and popularity metrics
 * - Full cast and crew credits
 * - Production companies and countries
 * - Genres and spoken languages
 * - Budget and revenue
 * 
 * @example
 * // Get details for The Matrix (ID: 603)
 * get_movie_details({ movie_id: 603 })
 */
export async function getMovieDetails(
  client: TMDBClient,
  args: z.infer<typeof getMovieDetailsSchema>
): Promise<ToolResult> {
  try {
    const movie = await client.getMovieDetails(args.movie_id, {
      language: args.language,
    });

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    const transformedMovie = {
      ...movie,
      poster_url: buildImageUrl(imageBaseUrl, movie.poster_path),
      backdrop_url: buildImageUrl(imageBaseUrl, movie.backdrop_path),
      credits: {
        cast: movie.credits.cast.map((person) => ({
          ...person,
          profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
        })),
        crew: movie.credits.crew.map((person) => ({
          ...person,
          profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
        })),
      },
    };

    return createSuccessResponse(transformedMovie);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to get movie details: ${message}`);
  }
}

/**
 * Search for TV shows by name.
 * 
 * @description
 * Search for TV series using a name query. Optionally filter by first air date year.
 * Returns a paginated list of matching shows with basic information.
 * 
 * @example
 * // Search for "Breaking Bad"
 * search_tv_shows({ query: "Breaking Bad" })
 * 
 * @example
 * // Search for shows from 2008
 * search_tv_shows({ query: "Breaking Bad", year: 2008 })
 */
export async function searchTVShows(
  client: TMDBClient,
  args: z.infer<typeof searchTVShowsSchema>
): Promise<ToolResult> {
  try {
    const options: { year?: number; page?: number; language?: string } = {
      page: args.page,
      language: args.language,
    };
    if (args.year !== undefined) options.year = args.year;
    
    const result = await client.searchTVShows(args.query, options);

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

    const transformedResults = {
      ...result,
      results: result.results.map((show) => ({
        ...show,
        poster_url: buildImageUrl(imageBaseUrl, show.poster_path),
        backdrop_url: buildImageUrl(imageBaseUrl, show.backdrop_path),
      })),
    };

    return createSuccessResponse(transformedResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to search TV shows: ${message}`);
  }
}

/**
 * Get detailed information for a specific TV show.
 * 
 * @description
 * Retrieve comprehensive details about a TV series including:
 * - Basic info (name, overview, first/last air dates)
 * - Status and type (Scripted, Reality, etc.)
 * - Number of seasons and episodes
 * - Full cast and crew credits
 * - Networks and genres
 * - Season listings with episode counts
 * 
 * @example
 * // Get details for Breaking Bad (ID: 1396)
 * get_tv_details({ tv_id: 1396 })
 */
export async function getTVShowDetails(
  client: TMDBClient,
  args: z.infer<typeof getTVShowDetailsSchema>
): Promise<ToolResult> {
  try {
    const show = await client.getTVShowDetails(args.tv_id, {
      language: args.language,
    });

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    const transformedShow = {
      ...show,
      poster_url: buildImageUrl(imageBaseUrl, show.poster_path),
      backdrop_url: buildImageUrl(imageBaseUrl, show.backdrop_path),
      seasons: show.seasons.map((season) => ({
        ...season,
        poster_url: buildImageUrl(imageBaseUrl, season.poster_path),
      })),
      credits: {
        cast: show.credits.cast.map((person) => ({
          ...person,
          profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
        })),
        crew: show.credits.crew.map((person) => ({
          ...person,
          profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
        })),
      },
    };

    return createSuccessResponse(transformedShow);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to get TV show details: ${message}`);
  }
}

/**
 * Search for people (actors, directors, crew members).
 * 
 * @description
 * Search for people in the TMDB database by name.
 * Returns a paginated list of matching people with basic information
 * and their known-for works.
 * 
 * @example
 * // Search for "Tom Hanks"
 * search_person({ query: "Tom Hanks" })
 * 
 * @example
 * // Search for "Christopher Nolan"
 * search_person({ query: "Christopher Nolan" })
 */
export async function searchPerson(
  client: TMDBClient,
  args: z.infer<typeof searchPersonSchema>
): Promise<ToolResult> {
  try {
    const result = await client.searchPeople(args.query, {
      page: args.page,
    });

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    const transformedResults = {
      ...result,
      results: result.results.map((person) => ({
        ...person,
        profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
      })),
    };

    return createSuccessResponse(transformedResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to search person: ${message}`);
  }
}

/**
 * Get detailed information for a specific person.
 * 
 * @description
 * Retrieve comprehensive details about a person including:
 * - Biography and personal info (birthday, birthplace)
 * - Known for department
 * - Full filmography (cast and crew credits)
 * - Also known as names
 * 
 * @example
 * // Get details for Tom Hanks (ID: 31)
 * get_person_details({ person_id: 31 })
 */
export async function getPersonDetails(
  client: TMDBClient,
  args: z.infer<typeof getPersonDetailsSchema>
): Promise<ToolResult> {
  try {
    const person = await client.getPersonDetails(args.person_id);

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    const transformedPerson = {
      ...person,
      profile_url: buildImageUrl(imageBaseUrl, person.profile_path),
      credits: {
        cast: person.credits.cast.map((credit) => ({
          ...credit,
          title: credit.title || credit.name,
        })),
        crew: person.credits.crew.map((credit) => ({
          ...credit,
          title: credit.title || credit.name,
        })),
      },
    };

    return createSuccessResponse(transformedPerson);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to get person details: ${message}`);
  }
}

/**
 * Discover movies with advanced filtering options.
 * 
 * @description
 * Advanced movie discovery with powerful filtering capabilities:
 * - Filter by genre(s)
 * - Filter by release year
 * - Filter by minimum rating
 * - Sort by popularity, rating, release date, or title
 * 
 * Genre IDs reference:
 * - 28: Action, 12: Adventure, 16: Animation, 35: Comedy
 * - 80: Crime, 99: Documentary, 18: Drama, 10751: Family
 * - 14: Fantasy, 36: History, 27: Horror, 10402: Music
 * - 9648: Mystery, 10749: Romance, 878: Sci-Fi, 53: Thriller
 * - 10752: War, 37: Western
 * 
 * @example
 * // Get popular action movies
 * discover_movies({ genres: "28", sort_by: "popularity.desc" })
 * 
 * @example
 * // Get highly rated sci-fi movies from 2023
 * discover_movies({ genres: "878", year: 2023, min_rating: 7.5 })
 */
export async function discoverMovies(
  client: TMDBClient,
  args: z.infer<typeof discoverMoviesSchema>
): Promise<ToolResult> {
  try {
    const options: {
      with_genres?: string;
      year?: number;
      'vote_average.gte'?: number;
      sort_by?: string;
      page?: number;
      language?: string;
    } = {
      sort_by: args.sort_by,
      page: args.page,
      language: args.language,
    };
    if (args.genres !== undefined) options.with_genres = args.genres;
    if (args.year !== undefined) options.year = args.year;
    if (args.min_rating !== undefined) options['vote_average.gte'] = args.min_rating;
    
    const result = await client.discoverMovies(options);

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

    const transformedResults = {
      ...result,
      results: result.results.map((movie) => ({
        ...movie,
        poster_url: buildImageUrl(imageBaseUrl, movie.poster_path),
        backdrop_url: buildImageUrl(imageBaseUrl, movie.backdrop_path),
      })),
    };

    return createSuccessResponse(transformedResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to discover movies: ${message}`);
  }
}

/**
 * Get trending content.
 * 
 * @description
 * Fetch trending movies, TV shows, or people on TMDB.
 * Trending is calculated based on user interactions and API requests.
 * 
 * @example
 * // Get trending movies this week
 * get_trending({ media_type: "movie", time_window: "week" })
 * 
 * @example
 * // Get trending TV shows today
 * get_trending({ media_type: "tv", time_window: "day" })
 */
export async function getTrending(
  client: TMDBClient,
  args: z.infer<typeof getTrendingSchema>
): Promise<ToolResult> {
  try {
    const result = await client.getTrending(args.media_type, args.time_window);

    // Transform image paths to full URLs
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    
    const transformedResults = {
      ...result,
      results: result.results.map((item) => {
        const base = {
          ...item,
          poster_url: buildImageUrl(imageBaseUrl, (item as { poster_path?: string | null }).poster_path || null),
          backdrop_url: buildImageUrl(imageBaseUrl, (item as { backdrop_path?: string | null }).backdrop_path || null),
        };
        
        // Add profile_url for people
        if ('profile_path' in item) {
          return {
            ...base,
            profile_url: buildImageUrl(imageBaseUrl, (item as { profile_path?: string | null }).profile_path || null),
          };
        }
        
        return base;
      }),
    };

    return createSuccessResponse(transformedResults);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return createErrorResponse(`Failed to get trending: ${message}`);
  }
}

// ============================================================================
// Additional Tool Schemas
// ============================================================================

export const getMovieRecommendationsSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getSimilarMoviesSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getMovieVideosSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getMovieImagesSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  include_languages: z.array(z.string()).optional().describe('Include images for specific languages'),
});

export const getMovieReviewsSchema = z.object({
  movie_id: z.number().int().positive('Movie ID must be a positive integer').describe('The TMDB movie ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getNowPlayingSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
  region: z.string().optional().default('US').describe('ISO 3166-1 country code'),
});

export const getUpcomingSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
  region: z.string().optional().default('US').describe('ISO 3166-1 country code'),
});

export const getPopularMoviesSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
  region: z.string().optional().default('US').describe('ISO 3166-1 country code'),
});

export const getTopRatedMoviesSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
  region: z.string().optional().default('US').describe('ISO 3166-1 country code'),
});

export const getLatestMovieSchema = z.object({
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getTVRecommendationsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getSimilarTVShowsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getTVVideosSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getTVImagesSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  include_languages: z.array(z.string()).optional().describe('Include images for specific languages'),
});

export const getTVReviewsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getSeasonDetailsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  season_number: z.number().int().min(0).describe('Season number (0 for specials)'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getEpisodeDetailsSchema = z.object({
  tv_id: z.number().int().positive('TV Show ID must be a positive integer').describe('The TMDB TV show ID'),
  season_number: z.number().int().min(0).describe('Season number (0 for specials)'),
  episode_number: z.number().int().min(0).describe('Episode number'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getAiringTodaySchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
  timezone: z.string().optional().default('America/New_York').describe('Timezone'),
});

export const getOnTheAirSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getPopularTVSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getTopRatedTVSchema = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getLatestTVSchema = z.object({
  language: z.string().optional().default('en-US').describe('Language code'),
});

export const getPersonImagesSchema = z.object({
  person_id: z.number().int().positive('Person ID must be a positive integer').describe('The TMDB person ID'),
});

export const getMovieCertificationsSchema = z.object({});

export const getTVCertificationsSchema = z.object({});

export const discoverTVShowsSchema = z.object({
  genres: z.string().optional().describe('Comma-separated genre IDs'),
  year: z.number().int().min(1900).max(2100).optional().describe('Filter by first air date year'),
  min_rating: z.number().min(0).max(10).optional().describe('Minimum vote average (0-10)'),
  sort_by: z.enum([
    'popularity.asc',
    'popularity.desc',
    'first_air_date.asc',
    'first_air_date.desc',
    'original_name.asc',
    'original_name.desc',
    'vote_average.asc',
    'vote_average.desc',
    'vote_count.asc',
    'vote_count.desc',
  ]).optional().default('popularity.desc').describe('Sort order'),
  page: z.number().int().min(1).optional().default(1).describe('Page number'),
  language: z.string().optional().default('en-US').describe('Language code'),
});

// ============================================================================
// Additional Tool Handlers
// ============================================================================

export async function getMovieRecommendations(client: TMDBClient, args: z.infer<typeof getMovieRecommendationsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getMovieRecommendations(args.movie_id, { page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get movie recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSimilarMovies(client: TMDBClient, args: z.infer<typeof getSimilarMoviesSchema>): Promise<ToolResult> {
  try {
    const result = await client.getSimilarMovies(args.movie_id, { page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get similar movies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getMovieVideos(client: TMDBClient, args: z.infer<typeof getMovieVideosSchema>): Promise<ToolResult> {
  try {
    const result = await client.getMovieVideos(args.movie_id, { language: args.language });
    return createSuccessResponse({
      ...result,
      results: result.results.map(v => ({
        ...v,
        youtube_url: v.site === 'YouTube' ? `https://www.youtube.com/watch?v=${v.key}` : null,
      })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get movie videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getMovieImages(client: TMDBClient, args: z.infer<typeof getMovieImagesSchema>): Promise<ToolResult> {
  try {
    const options: { includeLanguages?: string[] } = {};
    if (args.include_languages) options.includeLanguages = args.include_languages;
    const result = await client.getMovieImages(args.movie_id, options);
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      backdrops: result.backdrops.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w1280') })),
      posters: result.posters.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w500') })),
      logos: result.logos.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w500') })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get movie images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getMovieReviews(client: TMDBClient, args: z.infer<typeof getMovieReviewsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getMovieReviews(args.movie_id, { page: args.page, language: args.language });
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to get movie reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getNowPlaying(client: TMDBClient, args: z.infer<typeof getNowPlayingSchema>): Promise<ToolResult> {
  try {
    const result = await client.getNowPlayingMovies({ page: args.page, language: args.language, region: args.region });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get now playing movies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getUpcoming(client: TMDBClient, args: z.infer<typeof getUpcomingSchema>): Promise<ToolResult> {
  try {
    const result = await client.getUpcomingMovies({ page: args.page, language: args.language, region: args.region });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get upcoming movies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPopularMovies(client: TMDBClient, args: z.infer<typeof getPopularMoviesSchema>): Promise<ToolResult> {
  try {
    const result = await client.getPopularMovies({ page: args.page, language: args.language, region: args.region });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get popular movies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTopRatedMovies(client: TMDBClient, args: z.infer<typeof getTopRatedMoviesSchema>): Promise<ToolResult> {
  try {
    const result = await client.getTopRatedMovies({ page: args.page, language: args.language, region: args.region });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(m => ({ ...m, poster_url: buildImageUrl(imageBaseUrl, m.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, m.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get top rated movies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getLatestMovie(client: TMDBClient, args: z.infer<typeof getLatestMovieSchema>): Promise<ToolResult> {
  try {
    const result = await client.getLatestMovie({ language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      poster_url: buildImageUrl(imageBaseUrl, result.poster_path),
      backdrop_url: buildImageUrl(imageBaseUrl, result.backdrop_path),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get latest movie: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTVRecommendations(client: TMDBClient, args: z.infer<typeof getTVRecommendationsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getTVRecommendations(args.tv_id, { page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get TV recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSimilarTVShows(client: TMDBClient, args: z.infer<typeof getSimilarTVShowsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getSimilarTVShows(args.tv_id, { page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get similar TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTVVideos(client: TMDBClient, args: z.infer<typeof getTVVideosSchema>): Promise<ToolResult> {
  try {
    const result = await client.getTVVideos(args.tv_id, { language: args.language });
    return createSuccessResponse({
      ...result,
      results: result.results.map(v => ({
        ...v,
        youtube_url: v.site === 'YouTube' ? `https://www.youtube.com/watch?v=${v.key}` : null,
      })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get TV videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTVImages(client: TMDBClient, args: z.infer<typeof getTVImagesSchema>): Promise<ToolResult> {
  try {
    const options: { includeLanguages?: string[] } = {};
    if (args.include_languages) options.includeLanguages = args.include_languages;
    const result = await client.getTVImages(args.tv_id, options);
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      backdrops: result.backdrops.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w1280') })),
      posters: result.posters.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w500') })),
      logos: result.logos.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'w500') })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get TV images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTVReviews(client: TMDBClient, args: z.infer<typeof getTVReviewsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getTVReviews(args.tv_id, { page: args.page, language: args.language });
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to get TV reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSeasonDetails(client: TMDBClient, args: z.infer<typeof getSeasonDetailsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getSeasonDetails(args.tv_id, args.season_number, { language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      poster_url: buildImageUrl(imageBaseUrl, result.poster_path),
      episodes: result.episodes.map(e => ({ ...e, still_url: buildImageUrl(imageBaseUrl, e.still_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get season details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getEpisodeDetails(client: TMDBClient, args: z.infer<typeof getEpisodeDetailsSchema>): Promise<ToolResult> {
  try {
    const result = await client.getEpisodeDetails(args.tv_id, args.season_number, args.episode_number, { language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      still_url: buildImageUrl(imageBaseUrl, result.still_path),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get episode details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getAiringToday(client: TMDBClient, args: z.infer<typeof getAiringTodaySchema>): Promise<ToolResult> {
  try {
    const result = await client.getAiringToday({ page: args.page, language: args.language, timezone: args.timezone });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get airing today TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getOnTheAir(client: TMDBClient, args: z.infer<typeof getOnTheAirSchema>): Promise<ToolResult> {
  try {
    const result = await client.getOnTheAir({ page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get on the air TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPopularTV(client: TMDBClient, args: z.infer<typeof getPopularTVSchema>): Promise<ToolResult> {
  try {
    const result = await client.getPopularTV({ page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get popular TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTopRatedTV(client: TMDBClient, args: z.infer<typeof getTopRatedTVSchema>): Promise<ToolResult> {
  try {
    const result = await client.getTopRatedTV({ page: args.page, language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get top rated TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getLatestTV(client: TMDBClient, args: z.infer<typeof getLatestTVSchema>): Promise<ToolResult> {
  try {
    const result = await client.getLatestTV({ language: args.language });
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      poster_url: buildImageUrl(imageBaseUrl, result.poster_path),
      backdrop_url: buildImageUrl(imageBaseUrl, result.backdrop_path),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get latest TV show: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPersonImages(client: TMDBClient, args: z.infer<typeof getPersonImagesSchema>): Promise<ToolResult> {
  try {
    const result = await client.getPersonImages(args.person_id);
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      profiles: result.profiles.map(i => ({ ...i, url: buildImageUrl(imageBaseUrl, i.file_path, 'h632') })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to get person images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getMovieCertifications(client: TMDBClient): Promise<ToolResult> {
  try {
    const result = await client.getMovieCertifications();
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to get movie certifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getTVCertifications(client: TMDBClient): Promise<ToolResult> {
  try {
    const result = await client.getTVCertifications();
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(`Failed to get TV certifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function discoverTVShows(client: TMDBClient, args: z.infer<typeof discoverTVShowsSchema>): Promise<ToolResult> {
  try {
    const options: { with_genres?: string; first_air_date_year?: number; 'vote_average.gte'?: number; sort_by?: string; page?: number; language?: string } = {
      sort_by: args.sort_by,
      page: args.page,
      language: args.language,
    };
    if (args.genres !== undefined) options.with_genres = args.genres;
    if (args.year !== undefined) options.first_air_date_year = args.year;
    if (args.min_rating !== undefined) options['vote_average.gte'] = args.min_rating;
    
    const result = await client.discoverTVShows(options);
    const imageBaseUrl = (globalThis as unknown as { TMDB_IMAGE_BASE_URL?: string }).TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';
    return createSuccessResponse({
      ...result,
      results: result.results.map(s => ({ ...s, poster_url: buildImageUrl(imageBaseUrl, s.poster_path), backdrop_url: buildImageUrl(imageBaseUrl, s.backdrop_path) })),
    });
  } catch (error) {
    return createErrorResponse(`Failed to discover TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (client: TMDBClient, args: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * Registry of all available MCP tools.
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_movies',
    description: 'Search for movies by title. Use this to find movies when you know the title or keywords. Returns basic movie info with pagination.',
    inputSchema: searchMoviesSchema,
    handler: (client, args) => searchMovies(client, searchMoviesSchema.parse(args)),
  },
  {
    name: 'get_movie_details',
    description: 'Get comprehensive details for a specific movie including cast, crew, production info, and more. Requires a movie ID from search_movies.',
    inputSchema: getMovieDetailsSchema,
    handler: (client, args) => getMovieDetails(client, getMovieDetailsSchema.parse(args)),
  },
  {
    name: 'search_tv_shows',
    description: 'Search for TV shows by name. Use this to find TV series when you know the show name. Returns basic show info with pagination.',
    inputSchema: searchTVShowsSchema,
    handler: (client, args) => searchTVShows(client, searchTVShowsSchema.parse(args)),
  },
  {
    name: 'get_tv_details',
    description: 'Get comprehensive details for a specific TV show including seasons, episodes, cast, and crew. Requires a TV show ID from search_tv_shows.',
    inputSchema: getTVShowDetailsSchema,
    handler: (client, args) => getTVShowDetails(client, getTVShowDetailsSchema.parse(args)),
  },
  {
    name: 'search_person',
    description: 'Search for people (actors, directors, crew) by name. Use this to find people in the film industry.',
    inputSchema: searchPersonSchema,
    handler: (client, args) => searchPerson(client, searchPersonSchema.parse(args)),
  },
  {
    name: 'get_person_details',
    description: 'Get detailed information about a person including biography and full filmography. Requires a person ID from search_person.',
    inputSchema: getPersonDetailsSchema,
    handler: (client, args) => getPersonDetails(client, getPersonDetailsSchema.parse(args)),
  },
  {
    name: 'discover_movies',
    description: 'Advanced movie discovery with filters for genre, year, rating, and sorting options. Use for browsing movies by criteria rather than searching by title.',
    inputSchema: discoverMoviesSchema,
    handler: (client, args) => discoverMovies(client, discoverMoviesSchema.parse(args)),
  },
  {
    name: 'get_trending',
    description: 'Get trending movies, TV shows, or people on TMDB. Trending is based on user activity and API requests.',
    inputSchema: getTrendingSchema,
    handler: (client, args) => getTrending(client, getTrendingSchema.parse(args)),
  },
  {
    name: 'get_movie_recommendations',
    description: 'Get movie recommendations based on a specific movie. Returns similar movies that users who liked the given movie also enjoyed.',
    inputSchema: getMovieRecommendationsSchema,
    handler: (client, args) => getMovieRecommendations(client, getMovieRecommendationsSchema.parse(args)),
  },
  {
    name: 'get_similar_movies',
    description: 'Get movies similar to a specific movie based on metadata and style. More strict than recommendations.',
    inputSchema: getSimilarMoviesSchema,
    handler: (client, args) => getSimilarMovies(client, getSimilarMoviesSchema.parse(args)),
  },
  {
    name: 'get_movie_videos',
    description: 'Get all videos (trailers, teasers, clips) for a movie. Returns YouTube URLs when available.',
    inputSchema: getMovieVideosSchema,
    handler: (client, args) => getMovieVideos(client, getMovieVideosSchema.parse(args)),
  },
  {
    name: 'get_movie_images',
    description: 'Get all images (posters, backdrops, logos) for a movie. Returns full image URLs.',
    inputSchema: getMovieImagesSchema,
    handler: (client, args) => getMovieImages(client, getMovieImagesSchema.parse(args)),
  },
  {
    name: 'get_movie_reviews',
    description: 'Get user reviews for a movie including author, content, and rating.',
    inputSchema: getMovieReviewsSchema,
    handler: (client, args) => getMovieReviews(client, getMovieReviewsSchema.parse(args)),
  },
  {
    name: 'get_now_playing',
    description: 'Get movies currently playing in theaters. Updated weekly.',
    inputSchema: getNowPlayingSchema,
    handler: (client, args) => getNowPlaying(client, getNowPlayingSchema.parse(args)),
  },
  {
    name: 'get_upcoming',
    description: 'Get movies being released in the next 2 weeks.',
    inputSchema: getUpcomingSchema,
    handler: (client, args) => getUpcoming(client, getUpcomingSchema.parse(args)),
  },
  {
    name: 'get_popular_movies',
    description: 'Get the current popular movies on TMDB based on user activity.',
    inputSchema: getPopularMoviesSchema,
    handler: (client, args) => getPopularMovies(client, getPopularMoviesSchema.parse(args)),
  },
  {
    name: 'get_top_rated_movies',
    description: 'Get the top rated movies of all time based on user ratings.',
    inputSchema: getTopRatedMoviesSchema,
    handler: (client, args) => getTopRatedMovies(client, getTopRatedMoviesSchema.parse(args)),
  },
  {
    name: 'get_latest_movie',
    description: 'Get the most recently added movie to the TMDB database.',
    inputSchema: getLatestMovieSchema,
    handler: (client, args) => getLatestMovie(client, getLatestMovieSchema.parse(args)),
  },
  {
    name: 'get_tv_recommendations',
    description: 'Get TV show recommendations based on a specific show.',
    inputSchema: getTVRecommendationsSchema,
    handler: (client, args) => getTVRecommendations(client, getTVRecommendationsSchema.parse(args)),
  },
  {
    name: 'get_similar_tv',
    description: 'Get TV shows similar to a specific show. More strict than recommendations.',
    inputSchema: getSimilarTVShowsSchema,
    handler: (client, args) => getSimilarTVShows(client, getSimilarTVShowsSchema.parse(args)),
  },
  {
    name: 'get_tv_videos',
    description: 'Get all videos (trailers, teasers, clips) for a TV show.',
    inputSchema: getTVVideosSchema,
    handler: (client, args) => getTVVideos(client, getTVVideosSchema.parse(args)),
  },
  {
    name: 'get_tv_images',
    description: 'Get all images (posters, backdrops, logos) for a TV show.',
    inputSchema: getTVImagesSchema,
    handler: (client, args) => getTVImages(client, getTVImagesSchema.parse(args)),
  },
  {
    name: 'get_tv_reviews',
    description: 'Get user reviews for a TV show.',
    inputSchema: getTVReviewsSchema,
    handler: (client, args) => getTVReviews(client, getTVReviewsSchema.parse(args)),
  },
  {
    name: 'get_season_details',
    description: 'Get detailed information about a specific TV show season including all episodes.',
    inputSchema: getSeasonDetailsSchema,
    handler: (client, args) => getSeasonDetails(client, getSeasonDetailsSchema.parse(args)),
  },
  {
    name: 'get_episode_details',
    description: 'Get detailed information about a specific TV show episode.',
    inputSchema: getEpisodeDetailsSchema,
    handler: (client, args) => getEpisodeDetails(client, getEpisodeDetailsSchema.parse(args)),
  },
  {
    name: 'get_airing_today',
    description: 'Get TV shows that are airing today in the specified timezone.',
    inputSchema: getAiringTodaySchema,
    handler: (client, args) => getAiringToday(client, getAiringTodaySchema.parse(args)),
  },
  {
    name: 'get_on_the_air',
    description: 'Get TV shows that are currently on the air (broadcasting new episodes).',
    inputSchema: getOnTheAirSchema,
    handler: (client, args) => getOnTheAir(client, getOnTheAirSchema.parse(args)),
  },
  {
    name: 'get_popular_tv',
    description: 'Get the current popular TV shows on TMDB.',
    inputSchema: getPopularTVSchema,
    handler: (client, args) => getPopularTV(client, getPopularTVSchema.parse(args)),
  },
  {
    name: 'get_top_rated_tv',
    description: 'Get the top rated TV shows of all time.',
    inputSchema: getTopRatedTVSchema,
    handler: (client, args) => getTopRatedTV(client, getTopRatedTVSchema.parse(args)),
  },
  {
    name: 'get_latest_tv',
    description: 'Get the most recently added TV show to the TMDB database.',
    inputSchema: getLatestTVSchema,
    handler: (client, args) => getLatestTV(client, getLatestTVSchema.parse(args)),
  },
  {
    name: 'get_person_images',
    description: 'Get all profile images for a person.',
    inputSchema: getPersonImagesSchema,
    handler: (client, args) => getPersonImages(client, getPersonImagesSchema.parse(args)),
  },
  {
    name: 'get_movie_certifications',
    description: 'Get all movie certifications by country (e.g., PG-13, R in US).',
    inputSchema: getMovieCertificationsSchema,
    handler: (client) => getMovieCertifications(client),
  },
  {
    name: 'get_tv_certifications',
    description: 'Get all TV show certifications by country.',
    inputSchema: getTVCertificationsSchema,
    handler: (client) => getTVCertifications(client),
  },
  {
    name: 'discover_tv',
    description: 'Advanced TV show discovery with filters for genre, year, rating, and sorting.',
    inputSchema: discoverTVShowsSchema,
    handler: (client, args) => discoverTVShows(client, discoverTVShowsSchema.parse(args)),
  },
];
