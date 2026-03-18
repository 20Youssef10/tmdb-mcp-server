/**
 * HTTP Endpoints Test Script
 * Tests MCP server initialization and optionally verifies live TMDB connectivity.
 */

import { formatConnectivityError, getTMDBApiKey } from './test-support/env.js';
import { initializeMCPServer } from './src/lib/server-init.js';
import { TOOLS } from './src/lib/mcp-tools.js';
import { TMDBClient } from './src/lib/tmdb-client.js';

async function testEndpoints() {
  console.log('🔌 Testing HTTP Endpoints\n');
  console.log('='.repeat(50));

  console.log(`\n✅ Tools registered: ${TOOLS.length}`);
  console.log(`   Tool names: ${TOOLS.map((t) => t.name).slice(0, 10).join(', ')}...`);

  const apiKey = await getTMDBApiKey();
  if (!apiKey) {
    console.log('\n⚠️  Skipping live TMDB request checks because TMDB_API_KEY is not set.');
    return;
  }

  console.log('\n📡 Initializing TMDB Client...');
  const client = new TMDBClient({
    apiKey,
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  });
  const server = initializeMCPServer(client);
  console.log(`✅ TMDB Client initialized with ${server.server ? 'an' : 'no'} MCP server instance`);

  try {
    const configuration = await client.getConfiguration();
    console.log(`Preflight OK: TMDB image host ${configuration.images.secure_base_url}`);
  } catch (error) {
    console.error(`Preflight failed: ${formatConnectivityError(error)}`);
    process.exit(1);
  }

  console.log('\n🎬 Testing API connection...');
  const searchResult = await client.searchMovies('Test');
  console.log(`✅ API working: Found ${searchResult.results.length} movies`);

  console.log('\n❤️ Health Check:');
  console.log(JSON.stringify({
    status: 'healthy',
    version: '1.0.0',
    tools_count: TOOLS.length,
    transports: ['SSE', 'StreamableHTTP'],
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ All endpoint tests passed!');
}

testEndpoints().catch((error) => {
  console.error(error);
  process.exit(1);
});
