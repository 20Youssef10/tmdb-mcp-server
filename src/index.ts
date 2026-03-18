/**
 * TMDB MCP Server for Cloudflare Workers
 * 
 * Simplified implementation that works with Cloudflare Workers runtime.
 * Uses manual SSE implementation instead of MCP SDK transport.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TMDBClient } from './lib/tmdb-client.js';
import { TOOLS } from './lib/mcp-tools.js';
import { zodSchemaToJsonSchema } from './lib/json-schema.js';

// Cloudflare Workers global types
declare const TextEncoder: { new(): { encode(input: string): Uint8Array } };
declare const setInterval: (callback: () => void, ms: number) => number;
declare const clearInterval: (id: number) => void;

interface ReadableStreamDefaultController<T> {
  enqueue(chunk: T): void;
  close(): void;
  error(e?: unknown): void;
}

interface HeadersInit {
  [name: string]: string;
}

type BodyInit = unknown | string | Uint8Array | null;

// Cloudflare Workers environment
export interface Env {
  TMDB_API_KEY: string;
  TMDB_BASE_URL: string;
  TMDB_IMAGE_BASE_URL: string;
}

const SERVER_INFO = {
  name: 'tmdb-mcp-server',
  version: '1.0.0',
};

// Global state
const state = {
  client: null as TMDBClient | null,
  clientConfigKey: null as string | null,
  sessions: new Map<string, { id: string; createdAt: number }>(),
};

// Initialize TMDB client
function initializeClient(env: Env): TMDBClient {
  const client = new TMDBClient({
    apiKey: env.TMDB_API_KEY,
    baseUrl: env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    imageBaseUrl: env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
  });
  void client.initializeCache();
  return client;
}

function getClientConfigKey(env: Env): string {
  return JSON.stringify({
    apiKey: env.TMDB_API_KEY,
    baseUrl: env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    imageBaseUrl: env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
  });
}

function getClient(env: Env): TMDBClient {
  const configKey = getClientConfigKey(env);
  if (!state.client || state.clientConfigKey !== configKey) {
    state.client = initializeClient(env);
    state.clientConfigKey = configKey;
  }

  return state.client;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors());

// Root endpoint
app.get('/', (c) => {
  return c.json({
    ...SERVER_INFO,
    status: 'running',
    tools_count: TOOLS.length,
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: SERVER_INFO.version,
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

// SSE endpoint - Manual implementation
app.get('/sse', async (c) => {
  const apiKey = c.env.TMDB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
  }

  // Initialize client
  getClient(c.env);

  // Create session
  const sessionId = generateId();
  state.sessions.set(sessionId, { id: sessionId, createdAt: Date.now() });

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('X-Session-Id', sessionId);

  // Create SSE stream using global ReadableStream
  const encoder = new TextEncoder();
  let pingInterval: number | null = null;

  const stream = new (globalThis as any).ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      // Send initial endpoint event with session ID
      const endpointEvent = `event: endpoint\ndata: ${JSON.stringify({ endpoint: `/message?sessionId=${sessionId}` })}\n\n`;
      controller.enqueue(encoder.encode(endpointEvent));

      // Send ping every 30 seconds to keep connection alive
      pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 30000);
    },
    cancel() {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      state.sessions.delete(sessionId);
    },
  });

  return new (globalThis as any).Response(stream as BodyInit, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Session-Id': sessionId,
    } as HeadersInit,
  });
});

// Message endpoint - Handle JSON-RPC
app.post('/message', async (c) => {
  const apiKey = c.env.TMDB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
  }

  // Initialize client if needed
  const client = getClient(c.env);

  const sessionId = c.req.query('sessionId');
  if (!sessionId) {
    return c.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const session = state.sessions.get(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const body = await c.req.json();
    const message = body as {
      jsonrpc: '2.0';
      method: string;
      params?: unknown;
      id: string | number;
    };

    // Handle MCP protocol messages
    if (message.method === 'initialize') {
      return c.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'tmdb-mcp-server',
            version: SERVER_INFO.version,
          },
        },
      });
    }

    if (message.method === 'initialized') {
      // Client acknowledges initialization
      return c.json({ jsonrpc: '2.0', id: message.id, result: {} });
    }

    if (message.method === 'tools/list') {
      return c.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodSchemaToJsonSchema(tool.inputSchema),
          })),
        },
      });
    }

    if (message.method === 'tools/call') {
      const params = message.params as { name: string; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === params.name);

      if (!tool) {
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Tool not found: ${params.name}` },
        });
      }

      try {
        const result = await tool.handler(client, params.arguments || {});
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: result.content,
            isError: result.isError,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
            isError: true,
          },
        });
      }
    }

    // Unknown method
    return c.json({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${errorMessage}` },
    });
  }
});

// Streamable HTTP endpoint
app.post('/mcp', async (c) => {
  const apiKey = c.env.TMDB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
  }

  const client = getClient(c.env);

  try {
    const body = await c.req.json();
    const message = body as {
      jsonrpc: '2.0';
      method: string;
      params?: unknown;
      id: string | number;
    };

    // Handle initialize
    if (message.method === 'initialize') {
      return c.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'tmdb-mcp-server',
            version: SERVER_INFO.version,
          },
        },
      });
    }

    if (message.method === 'tools/list') {
      return c.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodSchemaToJsonSchema(tool.inputSchema),
          })),
        },
      });
    }

    if (message.method === 'tools/call') {
      const params = message.params as { name: string; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === params.name);

      if (!tool) {
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Tool not found: ${params.name}` },
        });
      }

      try {
        const result = await tool.handler(client, params.arguments || {});
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: result.content,
            isError: result.isError,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return c.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
            isError: true,
          },
        });
      }
    }

    return c.json({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${errorMessage}` },
    });
  }
});

// GET /mcp for capabilities
app.get('/mcp', (c) => {
  return c.json({
    ...SERVER_INFO,
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    tools_count: TOOLS.length,
  });
});

// Error handler
app.onError((err, c) => {
  return c.json(
    {
      error: 'Server error',
      message: err.message,
    },
    { status: 500 }
  );
});

export default app;
