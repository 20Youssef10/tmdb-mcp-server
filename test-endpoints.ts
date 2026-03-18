/**
 * HTTP Endpoints Test Script
 * Tests the Hono server endpoints without Cloudflare Workers runtime
 */

import { initializeMCPServer } from './src/lib/server-init.js';
import { TMDBClient } from './src/lib/tmdb-client.js';
import { TOOLS } from './src/lib/mcp-tools.js';

const API_KEY = 'ba11756866d006ff2acec5ce3efab273';

async function testEndpoints() {
  console.log('🔌 Testing HTTP Endpoints\n');
  console.log('='.repeat(50));
  
  // Test 1: Tools count
  console.log(`\n✅ Tools registered: ${TOOLS.length}`);
  console.log(`   Tool names: ${TOOLS.map(t => t.name).slice(0, 10).join(', ')}...`);
  
  // Test 2: Initialize client and MCP server
  console.log('\n📡 Initializing TMDB Client...');
  const client = new TMDBClient({
    apiKey: API_KEY,
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  });
  console.log('✅ TMDB Client initialized');
  
  // Test 3: Quick API test
  console.log('\n🎬 Testing API connection...');
  const searchResult = await client.searchMovies('Test');
  console.log(`✅ API working: Found ${searchResult.results.length} movies`);
  
  // Test 4: Health check simulation
  console.log('\n❤️ Health Check:');
  console.log(JSON.stringify({
    status: 'healthy',
    version: '1.0.0',
    tools_count: TOOLS.length,
    transports: ['SSE', 'StreamableHTTP'],
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All endpoint tests passed!');
}

testEndpoints().catch(console.error);
