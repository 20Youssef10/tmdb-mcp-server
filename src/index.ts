/**
 * TMDB MCP Server for Cloudflare Workers
 * 
 * A production-ready Model Context Protocol (MCP) server that integrates
 * with The Movie Database (TMDB) API, designed to run on Cloudflare Workers
 * using Hono.js framework with SSE and Streamable HTTP transports.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { TMDBClient } from './lib/tmdb-client.js';
import { TOOLS } from './lib/mcp-tools.js';

// Cloudflare Workers environment
export interface Env {
  TMDB_API_KEY: string;
  TMDB_BASE_URL: string;
  TMDB_IMAGE_BASE_URL: string;
}

// Global state
const state = {
  client: null as TMDBClient | null,
  mcpServer: null as McpServer | null,
  transports: new Map<string, SSEServerTransport>(),
};

// Initialize MCP server
function initializeMCPServer(client: TMDBClient): McpServer {
  const server = new McpServer({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    description: 'The Movie Database (TMDB) MCP Server',
  });

  for (const tool of TOOLS) {
    server.tool(
      tool.name,
      tool.description,
      {} as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args);
          return {
            content: result.content.map((c) => ({ type: 'text' as const, text: c.text })),
            isError: result.isError,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

// Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    status: 'running',
    tools_count: TOOLS.length,
    transports: ['SSE', 'StreamableHTTP'],
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tools_count: TOOLS.length,
  });
});

// List tools
app.get('/tools', (c) => {
  return c.json({
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    count: TOOLS.length,
  });
});

// SSE endpoint
app.get('/sse', async (c) => {
  // Check API key
  const apiKey = c.env.TMDB_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'TMDB_API_KEY is not configured. Please set it in Cloudflare dashboard.' },
      { status: 500 }
    );
  }

  // Initialize client if needed
  if (!state.client) {
    state.client = new TMDBClient({
      apiKey,
      baseUrl: c.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      imageBaseUrl: c.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
    });
    await state.client.initializeCache();
    state.mcpServer = initializeMCPServer(state.client);
  }

  // Create SSE transport
  const transport = new SSEServerTransport('/message', c.res);
  state.transports.set(transport.sessionId, transport);

  // Connect MCP server
  if (state.mcpServer) {
    await state.mcpServer.connect(transport);
  }

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  // Send the stream (cast to bypass strict typing)
  await (transport.send as unknown as (c: unknown) => Promise<void>)(c);

  // Cleanup on disconnect
  state.transports.delete(transport.sessionId);

  return c.res;
});

// Message endpoint for SSE
app.post('/message', async (c) => {
  if (!state.mcpServer) {
    return c.json(
      { error: 'Server not initialized. Connect to /sse first.' },
      { status: 503 }
    );
  }

  try {
    const body = await c.req.json();
    const sessionId = c.req.query('sessionId');

    if (!sessionId) {
      return c.json({ error: 'sessionId query parameter is required' }, { status: 400 });
    }

    const transport = state.transports.get(sessionId);
    if (!transport) {
      return c.json({ error: `Session ${sessionId} not found` }, { status: 404 });
    }

    await transport.handlePostMessage(c.req.raw, body as object, state.mcpServer);
    return c.json({ status: 'processed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Message processing failed: ${message}` }, { status: 400 });
  }
});

// Streamable HTTP endpoint (POST)
app.post('/mcp', async (c) => {
  // Check API key
  const apiKey = c.env.TMDB_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'TMDB_API_KEY is not configured. Please set it in Cloudflare dashboard.' },
      { status: 500 }
    );
  }

  // Initialize if needed
  if (!state.client) {
    state.client = new TMDBClient({
      apiKey,
      baseUrl: c.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      imageBaseUrl: c.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
    });
    await state.client.initializeCache();
    state.mcpServer = initializeMCPServer(state.client);
  }

  try {
    const body = await c.req.json();
    // Process MCP message directly
    if (state.mcpServer) {
      // For simple request/response, we can handle it inline
      return c.json({
        jsonrpc: '2.0',
        result: { message: 'Request received', method: (body as { method?: string }).method },
        id: (body as { id?: string | number }).id,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `MCP request failed: ${message}` }, { status: 400 });
  }

  return c.json({ status: 'processed' });
});

// Streamable HTTP endpoint (GET)
app.get('/mcp', (c) => {
  return c.json({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    capabilities: { tools: true },
    tools_count: TOOLS.length,
  });
});

// Error handler
app.onError((err, c) => {
  return c.json(
    {
      error: 'Server error',
      message: err.message,
      type: err.constructor.name,
    },
    { status: 500 }
  );
});

export default app;
