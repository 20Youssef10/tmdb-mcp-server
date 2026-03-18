/**
 * Test Script for TMDB MCP Server
 * 
 * This script tests the TMDB client directly without requiring
 * the Cloudflare Workers runtime.
 * 
 * Usage: 
 * 1. Create a .dev.vars file with your TMDB_API_KEY
 * 2. Run: node --experimental-strip-types test.ts
 */

import { TMDBClient } from './src/lib/tmdb-client.js';

// Load environment variables from .dev.vars
async function loadEnvVars(): Promise<Record<string, string>> {
  try {
    const fs = await import('fs');
    const content = fs.readFileSync('.dev.vars', 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    return env;
  } catch {
    console.error('Error: Could not load .dev.vars file');
    console.error('Please create a .dev.vars file with your TMDB_API_KEY');
    process.exit(1);
  }
}

async function runTests() {
  const env = await loadEnvVars();
  const apiKey = env.TMDB_API_KEY;

  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    console.error('Error: Please set a valid TMDB_API_KEY in .dev.vars');
    process.exit(1);
  }

  const client = new TMDBClient({
    apiKey,
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  });

  console.log('🎬 TMDB MCP Server - Test Suite\n');
  console.log('================================\n');

  const tests = [
    {
      name: 'search_movies',
      fn: async () => {
        const result = await client.searchMovies('The Matrix', { year: 1999 });
        console.log(`✅ Found ${result.results.length} movies`);
        if (result.results[0]) {
          console.log(`   First result: ${result.results[0].title} (${result.results[0].release_date?.split('-')[0]})`);
        }
      },
    },
    {
      name: 'get_movie_details',
      fn: async () => {
        const result = await client.getMovieDetails(603); // The Matrix
        console.log(`✅ Got details for: ${result.title}`);
        console.log(`   Runtime: ${result.runtime} min`);
        console.log(`   Cast: ${result.credits.cast.slice(0, 3).map(c => c.name).join(', ')}`);
      },
    },
    {
      name: 'search_tv_shows',
      fn: async () => {
        const result = await client.searchTVShows('Breaking Bad');
        console.log(`✅ Found ${result.results.length} TV shows`);
        if (result.results[0]) {
          console.log(`   First result: ${result.results[0].name} (${result.results[0].first_air_date?.split('-')[0]})`);
        }
      },
    },
    {
      name: 'get_tv_details',
      fn: async () => {
        const result = await client.getTVShowDetails(1396); // Breaking Bad
        console.log(`✅ Got details for: ${result.name}`);
        console.log(`   Seasons: ${result.number_of_seasons}`);
        console.log(`   Episodes: ${result.number_of_episodes}`);
      },
    },
    {
      name: 'search_person',
      fn: async () => {
        const result = await client.searchPeople('Tom Hanks');
        console.log(`✅ Found ${result.results.length} people`);
        if (result.results[0]) {
          console.log(`   First result: ${result.results[0].name} (${result.results[0].known_for_department})`);
        }
      },
    },
    {
      name: 'get_person_details',
      fn: async () => {
        const result = await client.getPersonDetails(31); // Tom Hanks
        console.log(`✅ Got details for: ${result.name}`);
        console.log(`   Known for: ${result.known_for_department}`);
        console.log(`   Filmography: ${result.credits.cast.length} acting credits`);
      },
    },
    {
      name: 'discover_movies',
      fn: async () => {
        const result = await client.discoverMovies({
          with_genres: '28', // Action
          'vote_average.gte': 7,
          sort_by: 'popularity.desc',
        });
        console.log(`✅ Found ${result.results.length} action movies (rating >= 7)`);
        if (result.results[0]) {
          console.log(`   Top result: ${result.results[0].title} (Rating: ${result.results[0].vote_average})`);
        }
      },
    },
    {
      name: 'get_trending',
      fn: async () => {
        const result = await client.getTrending('movie', 'week');
        console.log(`✅ Found ${result.results.length} trending movies`);
        if (result.results[0]) {
          const movie = result.results[0] as { title?: string; name?: string };
          console.log(`   Top trending: ${movie.title || movie.name}`);
        }
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error('❌ FAILED');
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('');
  }

  console.log('================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
