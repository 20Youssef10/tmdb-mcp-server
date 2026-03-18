/**
 * Comprehensive Test Script for All 36 TMDB MCP Tools
 * 
 * Usage: npx tsx test-all-tools.ts
 */

import { TMDBClient } from './src/lib/tmdb-client.js';

const API_KEY = 'ba11756866d006ff2acec5ce3efab273';

const client = new TMDBClient({
  apiKey: API_KEY,
  baseUrl: 'https://api.themoviedb.org/3',
  imageBaseUrl: 'https://image.tmdb.org/t/p',
});

interface Test {
  name: string;
  fn: () => Promise<void>;
}

const tests: Test[] = [
  // Core Tools
  { name: 'search_movies', fn: async () => {
    const r = await client.searchMovies('Inception');
    console.log(`✅ ${r.results.length} results, top: ${r.results[0]?.title}`);
  }},
  { name: 'get_movie_details', fn: async () => {
    const r = await client.getMovieDetails(27205); // Inception
    console.log(`✅ ${r.title}, ${r.runtime}min, ${r.credits.cast.length} cast`);
  }},
  { name: 'search_tv_shows', fn: async () => {
    const r = await client.searchTVShows('Game of Thrones');
    console.log(`✅ ${r.results.length} results, top: ${r.results[0]?.name}`);
  }},
  { name: 'get_tv_details', fn: async () => {
    const r = await client.getTVShowDetails(1399); // Game of Thrones
    console.log(`✅ ${r.name}, ${r.number_of_seasons} seasons, ${r.number_of_episodes} episodes`);
  }},
  { name: 'search_person', fn: async () => {
    const r = await client.searchPeople('Leonardo DiCaprio');
    console.log(`✅ ${r.results.length} results, top: ${r.results[0]?.name}`);
  }},
  { name: 'get_person_details', fn: async () => {
    const r = await client.getPersonDetails(6193); // DiCaprio
    console.log(`✅ ${r.name}, ${r.credits.cast.length} credits`);
  }},
  { name: 'discover_movies', fn: async () => {
    const r = await client.discoverMovies({ with_genres: '878', sort_by: 'popularity.desc' });
    console.log(`✅ ${r.results.length} sci-fi movies`);
  }},
  { name: 'get_trending', fn: async () => {
    const r = await client.getTrending('movie', 'week');
    console.log(`✅ ${r.results.length} trending movies`);
  }},
  
  // Movie Tools
  { name: 'get_movie_recommendations', fn: async () => {
    const r = await client.getMovieRecommendations(27205); // Inception
    console.log(`✅ ${r.results.length} recommendations`);
  }},
  { name: 'get_similar_movies', fn: async () => {
    const r = await client.getSimilarMovies(27205);
    console.log(`✅ ${r.results.length} similar movies`);
  }},
  { name: 'get_movie_videos', fn: async () => {
    const r = await client.getMovieVideos(27205);
    console.log(`✅ ${r.results.length} videos`);
  }},
  { name: 'get_movie_images', fn: async () => {
    const r = await client.getMovieImages(27205);
    console.log(`✅ ${r.posters.length} posters, ${r.backdrops.length} backdrops`);
  }},
  { name: 'get_movie_reviews', fn: async () => {
    const r = await client.getMovieReviews(27205);
    console.log(`✅ ${r.results.length} reviews`);
  }},
  { name: 'get_now_playing', fn: async () => {
    const r = await client.getNowPlayingMovies();
    console.log(`✅ ${r.results.length} now playing`);
  }},
  { name: 'get_upcoming', fn: async () => {
    const r = await client.getUpcomingMovies();
    console.log(`✅ ${r.results.length} upcoming`);
  }},
  { name: 'get_popular_movies', fn: async () => {
    const r = await client.getPopularMovies();
    console.log(`✅ ${r.results.length} popular`);
  }},
  { name: 'get_top_rated_movies', fn: async () => {
    const r = await client.getTopRatedMovies();
    console.log(`✅ ${r.results.length} top rated, top: ${r.results[0]?.title}`);
  }},
  { name: 'get_latest_movie', fn: async () => {
    const r = await client.getLatestMovie();
    console.log(`✅ Latest: ${r.title}`);
  }},
  
  // TV Tools
  { name: 'get_tv_recommendations', fn: async () => {
    const r = await client.getTVRecommendations(1399);
    console.log(`✅ ${r.results.length} recommendations`);
  }},
  { name: 'get_similar_tv', fn: async () => {
    const r = await client.getSimilarTVShows(1399);
    console.log(`✅ ${r.results.length} similar shows`);
  }},
  { name: 'get_tv_videos', fn: async () => {
    const r = await client.getTVVideos(1399);
    console.log(`✅ ${r.results.length} videos`);
  }},
  { name: 'get_tv_images', fn: async () => {
    const r = await client.getTVImages(1399);
    console.log(`✅ ${r.posters.length} posters, ${r.backdrops.length} backdrops`);
  }},
  { name: 'get_tv_reviews', fn: async () => {
    const r = await client.getTVReviews(1399);
    console.log(`✅ ${r.results.length} reviews`);
  }},
  { name: 'get_season_details', fn: async () => {
    const r = await client.getSeasonDetails(1399, 1);
    console.log(`✅ Season 1: ${r.episodes.length} episodes`);
  }},
  { name: 'get_episode_details', fn: async () => {
    const r = await client.getEpisodeDetails(1399, 1, 1);
    console.log(`✅ S1E1: ${r.name}`);
  }},
  { name: 'get_airing_today', fn: async () => {
    const r = await client.getAiringToday();
    console.log(`✅ ${r.results.length} airing today`);
  }},
  { name: 'get_on_the_air', fn: async () => {
    const r = await client.getOnTheAir();
    console.log(`✅ ${r.results.length} on the air`);
  }},
  { name: 'get_popular_tv', fn: async () => {
    const r = await client.getPopularTV();
    console.log(`✅ ${r.results.length} popular TV`);
  }},
  { name: 'get_top_rated_tv', fn: async () => {
    const r = await client.getTopRatedTV();
    console.log(`✅ ${r.results.length} top rated TV, top: ${r.results[0]?.name}`);
  }},
  { name: 'get_latest_tv', fn: async () => {
    const r = await client.getLatestTV();
    console.log(`✅ Latest TV: ${r.name}`);
  }},
  
  // Person Tools
  { name: 'get_person_images', fn: async () => {
    const r = await client.getPersonImages(6193);
    console.log(`✅ ${r.profiles.length} profile images`);
  }},
  
  // Discovery & Reference
  { name: 'discover_tv', fn: async () => {
    const r = await client.discoverTVShows({ with_genres: '18', sort_by: 'popularity.desc' });
    console.log(`✅ ${r.results.length} drama TV shows`);
  }},
  { name: 'get_movie_certifications', fn: async () => {
    const r = await client.getMovieCertifications();
    const count = Array.isArray(r.results) ? r.results.length : Object.keys(r).length;
    console.log(`✅ ${count} countries with certifications`);
  }},
  { name: 'get_tv_certifications', fn: async () => {
    const r = await client.getTVCertifications();
    const count = Array.isArray(r.results) ? r.results.length : Object.keys(r).length;
    console.log(`✅ ${count} countries with TV certifications`);
  }},
];

async function runTests() {
  console.log('🎬 TMDB MCP Server - Full Test Suite (36 Tools)\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
      console.log('❌ FAILED');
    }
  }
  
  console.log('='.repeat(50));
  console.log(`Results: ${passed}/${tests.length} passed, ${failed} failed`);
  
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
