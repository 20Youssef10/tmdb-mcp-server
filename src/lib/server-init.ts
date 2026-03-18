/**
 * Server initialization helper for testing
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TMDBClient } from './tmdb-client.js';
import { TOOLS } from './mcp-tools.js';

/**
 * Initialize the MCP server with all registered tools.
 */
export function initializeMCPServer(client: TMDBClient): McpServer {
  const server = new McpServer({
    name: 'tmdb-mcp-server',
    version: '1.0.0',
    description: 'The Movie Database (TMDB) MCP Server',
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
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
