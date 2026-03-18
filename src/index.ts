/**
 * TMDB MCP Server for Cloudflare Workers
 * 
 * A production-ready Model Context Protocol (MCP) server that integrates
 * with The Movie Database (TMDB) API, designed to run on Cloudflare Workers
 * using Hono.js framework with SSE and Streamable HTTP transports.
 * 
 * @module tmdb-mcp-server
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TMDBClient, TMDBError, TMDBRateLimitError } from './lib/tmdb-client.js';
import { TOOLS } from './lib/mcp-tools.js';

// Cloudflare Workers global types
declare const crypto: {
  randomUUID(): string;
};
declare const setTimeout: (callback: () => void, delay: number) => number;
declare const Response: {
  new(body?: BodyInit | null, init?: ResponseInit): Response;
  prototype: Response;
};
declare const ReadableStream: {
  new(underlyingSource?: UnderlyingSource): ReadableStream;
  prototype: ReadableStream;
};
declare const TextEncoder: {
  new(): TextEncoder;
  prototype: TextEncoder;
};

interface Response {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  json<T>(): Promise<T>;
  text(): Promise<string>;
  clone(): Response;
}

interface Headers {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
}

interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

interface HeadersInit {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
}

type BodyInit = ReadableStream | string | Uint8Array | ArrayBuffer | null;

interface UnderlyingSource {
  start?: (controller: ReadableStreamDefaultController) => void;
  pull?: (controller: ReadableStreamDefaultController) => void | PromiseLike<void>;
  cancel?: (reason?: unknown) => void | PromiseLike<void>;
  type?: string;
}

interface ReadableStream {
  readonly locked: boolean;
  cancel(reason?: unknown): Promise<void>;
  getReader(): ReadableStreamDefaultReader;
  pipeThrough(transform: ReadableWritablePair): ReadableStream;
  pipeTo(destination: WritableStream): Promise<void>;
  tee(): [ReadableStream, ReadableStream];
}

interface ReadableStreamDefaultReader {
  cancel(reason?: unknown): Promise<void>;
  closed: Promise<void>;
  read(): Promise<ReadableStreamReadResult>;
  releaseLock(): void;
}

interface ReadableStreamReadResult {
  done: boolean;
  value?: unknown;
}

interface ReadableWritablePair {
  readable: ReadableStream;
  writable: WritableStream;
}

interface WritableStream {
  readonly locked: boolean;
  abort(reason?: unknown): Promise<void>;
  close(): Promise<void>;
  getWriter(): WritableStreamDefaultWriter;
}

interface WritableStreamDefaultWriter {
  abort(reason?: unknown): Promise<void>;
  close(): Promise<void>;
  closed: Promise<void>;
  desiredSize: number | null;
  ready: Promise<void>;
  write(chunk?: unknown): Promise<void>;
}

interface TextEncoder {
  readonly encoding: string;
  encode(input?: string): Uint8Array;
  encodeInto(input: string, dest: Uint8Array): { read: number; written: number };
}

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  TMDB_API_KEY: string;
  TMDB_BASE_URL: string;
  TMDB_IMAGE_BASE_URL: string;
}

// ============================================================================
// Application State
// ============================================================================

interface AppState {
  client: TMDBClient | null;
  mcpServer: McpServer | null;
  // Store active HTTP transports by session ID
  httpTransports: Map<string, StreamableHTTPServerTransport>;
  // Store SSE transports by session ID
  sseTransports: Map<string, SSEServerTransport>;
}

// Global state for the worker
const state: AppState = {
  client: null,
  mcpServer: null,
  httpTransports: new Map(),
  sseTransports: new Map(),
};

// ============================================================================
// MCP Server Initialization
// ============================================================================

/**
 * Initialize the MCP server with all registered tools.
 * 
 * @param client - The TMDB API client instance
 * @returns Configured McpServer instance
 */
function initializeMCPServer(client: TMDBClient): McpServer {
  const server = new McpServer({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    description: 'The Movie Database (TMDB) MCP Server - Access movie, TV show, and person data',
  });

  // Register all tools using the simpler API
  for (const tool of TOOLS) {
    const schema = zodSchemaToJsonSchema(tool.inputSchema) as {
      type: string;
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required: string[];
      additionalProperties: boolean;
    };
    
    // Register tool with schema and annotations
    server.tool(
      tool.name,
      tool.description,
      {
        inputSchema: schema,
      } as unknown as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args);
          return {
            content: result.content.map((c) => ({ type: 'text' as const, text: c.text })),
            isError: result.isError,
          };
        } catch (error) {
          // Catch any unexpected errors
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
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

/**
 * Convert a Zod schema to JSON Schema format for MCP.
 * 
 * @param schema - Zod schema to convert
 * @returns JSON Schema object
 */
function zodSchemaToJsonSchema(schema: unknown): Record<string, unknown> {
  // If it's already a Zod schema, extract the shape
  if (schema && typeof schema === 'object' && '_def' in schema) {
    const zodSchema = schema as Record<string, unknown>;
    const def = zodSchema._def as Record<string, unknown>;
    
    if (def.typeName === 'ZodObject') {
      const shape = def.shape as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldDef = value as Record<string, unknown>;
        const fieldTypeDef = fieldDef._def as Record<string, unknown>;
        
        // Get the type
        let type = 'string';
        if (fieldTypeDef.typeName === 'ZodNumber') {
          type = 'number';
        } else if (fieldTypeDef.typeName === 'ZodBoolean') {
          type = 'boolean';
        } else if (fieldTypeDef.typeName === 'ZodEnum') {
          type = 'string';
        }

        // Get description
        const description = fieldDef.description as string | undefined;

        // Get enum values if applicable
        let enumValues: string[] | undefined;
        if (fieldTypeDef.typeName === 'ZodEnum') {
          const values = fieldTypeDef.values as string[];
          enumValues = values;
        }

        // Check if required (no default and no optional)
        const isOptional = fieldTypeDef.typeName === 'ZodOptional' || fieldTypeDef.typeName === 'ZodDefault';
        
        properties[key] = {
          type,
          ...(description && { description }),
          ...(enumValues && { enum: enumValues }),
        };

        if (!isOptional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      };
    }
  }

  // Fallback
  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
}

// ============================================================================
// Hono Application Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('*', cors());

/**
 * Health check endpoint.
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tools_count: TOOLS.length,
    transports: ['SSE', 'StreamableHTTP'],
  });
});

/**
 * SSE endpoint for MCP connections (legacy transport).
 * 
 * Establishes a Server-Sent Events connection for the MCP client.
 * The connection is used for bidirectional communication between
 * the MCP client and server.
 */
app.get('/sse', async (c) => {
  // Initialize the TMDB client if not already done
  if (!state.client) {
    const apiKey = c.env.TMDB_API_KEY;
    
    if (!apiKey) {
      return c.json(
        { error: 'TMDB_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    state.client = new TMDBClient({
      apiKey,
      baseUrl: c.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      imageBaseUrl: c.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
    });

    // Initialize caching
    await state.client.initializeCache();

    // Initialize the MCP server
    state.mcpServer = initializeMCPServer(state.client);
  }

  // Create SSE transport with the response object
  const transport = new SSEServerTransport('/message', c.res);

  // Connect the MCP server to the transport
  if (state.mcpServer) {
    await state.mcpServer.connect(transport);
  }

  // Store transport by session ID for message handling
  const sessionId = transport.sessionId;
  state.sseTransports.set(sessionId, transport);

  // Clean up transport when connection closes
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('Content-Type', 'text/event-stream');

  // The transport handles sending the SSE stream internally
  // Cast to unknown to bypass strict type checking for MCP SDK compatibility
  await (transport.send as (context: unknown) => Promise<void>)(c as unknown);

  // Clean up on disconnect
  state.sseTransports.delete(sessionId);

  return c.body(null);
});

/**
 * Message endpoint for SSE transport (legacy).
 * 
 * Receives JSON-RPC messages from the MCP client and processes them
 * through the MCP server.
 */
app.post('/message', async (c) => {
  // Ensure the MCP server is initialized
  if (!state.mcpServer || !state.client) {
    return c.json(
      { error: 'MCP server not initialized. Connect to /sse first.' },
      { status: 503 }
    );
  }

  try {
    const body = await c.req.json();
    const sessionId = c.req.query('sessionId');

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const transport = state.sseTransports.get(sessionId);
    if (!transport) {
      return c.json({ error: 'Session not found' }, { status: 404 });
    }

    // Handle the message through the transport
    await transport.handlePostMessage(c.req.raw, body as object, state.mcpServer);

    return c.json({ status: 'processed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      { error: `Failed to process message: ${message}` },
      { status: 400 }
    );
  }
});

// ============================================================================
// Streamable HTTP Transport (New MCP Standard)
// ============================================================================

/**
 * Streamable HTTP endpoint for MCP connections.
 * 
 * This is the newer, more efficient transport protocol for MCP.
 * It supports both request/response and streaming modes.
 * 
 * @see https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#streamable-http
 */
app.post('/mcp', async (c) => {
  // Initialize the TMDB client if not already done
  if (!state.client) {
    const apiKey = c.env.TMDB_API_KEY;
    
    if (!apiKey) {
      return c.json(
        { error: 'TMDB_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    state.client = new TMDBClient({
      apiKey,
      baseUrl: c.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      imageBaseUrl: c.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
    });

    // Initialize caching
    await state.client.initializeCache();

    // Initialize the MCP server
    state.mcpServer = initializeMCPServer(state.client);
  }

  try {
    const body = await c.req.json();
    
    // Create a new HTTP transport for this request
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => generateSessionId(),
    });

    // Connect the MCP server to the transport
    // Cast to bypass strict type checking for MCP SDK compatibility
    if (state.mcpServer) {
      await state.mcpServer.connect(transport as unknown as never);
    }

    // Store transport by session ID
    const sessionId = transport.sessionId;
    if (sessionId) {
      state.httpTransports.set(sessionId, transport);
    }

    // Handle the message
    await transport.handleRequest(c.req.raw, body as object, state.mcpServer!);

    // Get the response from the transport
    const response = await getTransportResponse(transport);
    
    // Clean up transport after response (for stateless mode)
    // For persistent sessions, you might want to keep the transport
    if (sessionId) {
      cleanupTransport(state, sessionId, transport);
    }

    return response || c.json({ status: 'processed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      { error: `Failed to process MCP request: ${message}` },
      { status: 400 }
    );
  }
});

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  // Use crypto if available, otherwise fallback to random string
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get response from transport with proper typing.
 */
async function getTransportResponse(transport: StreamableHTTPServerTransport): Promise<Response | null> {
  // The transport may or may not have a getResponse method depending on SDK version
  if ('getResponse' in transport && typeof transport.getResponse === 'function') {
    return await (transport.getResponse as () => Promise<Response | null>)();
  }
  return null;
}

/**
 * Clean up transport after use.
 */
function cleanupTransport(state: AppState, sessionId: string, transport: StreamableHTTPServerTransport): void {
  // Use setTimeout if available, otherwise clean up immediately
  const cleanup = () => {
    state.httpTransports.delete(sessionId);
    if (transport.close) {
      transport.close();
    }
  };
  
  if (typeof setTimeout !== 'undefined') {
    setTimeout(cleanup, 5000);
  } else {
    cleanup();
  }
}

/**
 * GET endpoint for Streamable HTTP transport.
 * 
 * Used for establishing a streaming session or checking server capabilities.
 */
app.get('/mcp', async (c) => {
  // Check if client wants to establish a streaming session
  const acceptHeader = c.req.header('Accept');
  
  if (acceptHeader?.includes('text/event-stream')) {
    // Initialize if needed
    if (!state.client) {
      const apiKey = c.env.TMDB_API_KEY;
      
      if (!apiKey) {
        return c.json(
          { error: 'TMDB_API_KEY environment variable is not set' },
          { status: 500 }
        );
      }

      state.client = new TMDBClient({
        apiKey,
        baseUrl: c.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
        imageBaseUrl: c.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
      });

      await state.client.initializeCache();
      state.mcpServer = initializeMCPServer(state.client);
    }

    // Create streaming transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => generateSessionId(),
    });

    if (state.mcpServer) {
      // Cast to bypass strict type checking for MCP SDK compatibility
      await state.mcpServer.connect(transport as unknown as never);
    }

    const sessionId = transport.sessionId;
    if (sessionId) {
      state.httpTransports.set(sessionId, transport);
    }

    // Set up SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    if (sessionId) {
      c.header('X-Session-Id', sessionId);
    }

    // Send initial connection event using TextEncoder
    const stream = createEventStream(sessionId || 'unknown');

    const responseInit: ResponseInit = {
      headers: {
        append: () => {},
        delete: () => {},
        get: (name: string) => {
          const headers: Record<string, string> = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Session-Id': sessionId || '',
          };
          return headers[name] || null;
        },
        has: (name: string) => ['Content-Type', 'Cache-Control', 'Connection', 'X-Session-Id'].includes(name),
        set: () => {},
      } as unknown as Headers,
    };

    return new Response(stream as unknown as BodyInit, responseInit);
  }

  // Return server info for regular GET requests
  return c.json({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    description: 'The Movie Database (TMDB) MCP Server',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
    tools_count: TOOLS.length,
    transports: ['SSE', 'StreamableHTTP'],
  });
});

/**
 * Create an event stream for SSE responses.
 */
function createEventStream(sessionId: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      const event = `data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`;
      controller.enqueue(encoder.encode(event));
    },
  });
}

interface ReadableStreamDefaultController {
  enqueue(chunk?: unknown): void;
  close(): void;
  error(e?: unknown): void;
}

/**
 * DELETE endpoint for Streamable HTTP transport.
 * 
 * Used to close a streaming session.
 */
app.delete('/mcp', async (c) => {
  const sessionId = c.req.query('sessionId') || c.req.header('X-Session-Id');
  
  if (!sessionId) {
    return c.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const transport = state.httpTransports.get(sessionId);
  if (transport) {
    transport.close();
    state.httpTransports.delete(sessionId);
  }

  return c.json({ status: 'closed' });
});

/**
 * Tools listing endpoint (for debugging/testing).
 */
app.get('/tools', (c) => {
  const toolsInfo = TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));

  return c.json({
    tools: toolsInfo,
    count: toolsInfo.length,
  });
});

/**
 * Error handler for graceful error responses.
 */
app.onError((err, c) => {
  // Log error (in Cloudflare Workers, use console.log for debugging)
  const errorLog = {
    message: 'Unhandled error',
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
  };
  // In production, this would go to a logging service
  void errorLog;

  if (err instanceof TMDBRateLimitError) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: err.message,
        retryAfter: err.retryAfter,
      },
      { status: 429 }
    );
  }

  if (err instanceof TMDBError) {
    return c.json(
      {
        error: 'TMDB API Error',
        message: err.message,
        statusCode: err.statusCode,
      },
      { status: err.statusCode || 500 }
    );
  }

  return c.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    },
    { status: 500 }
  );
});

// ============================================================================
// Worker Export
// ============================================================================

export default app;
