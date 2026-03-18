# TMDB MCP Server

A production-ready Model Context Protocol (MCP) server that integrates with The Movie Database (TMDB) API, designed to run on Cloudflare Workers using Hono.js framework.

## Features

- **34 MCP Tools** for comprehensive TMDB API access
- **Dual Transport Support**: SSE (legacy) and Streamable HTTP (new standard)
- **Cloudflare Cache** integration for improved performance
- **Robust Error Handling** with graceful error messages
- **Type-Safe** with full TypeScript support
- **Rate Limit Aware** with proper error responses

## Available Tools

### Search & Discovery
| Tool | Description |
|------|-------------|
| `search_movies` | Search for movies by title with optional year filter |
| `search_tv_shows` | Search for TV shows by name |
| `search_person` | Search for actors, directors, and crew |
| `discover_movies` | Advanced movie discovery with filters |
| `discover_tv` | Advanced TV show discovery with filters |
| `get_trending` | Get trending movies, TV shows, or people |

### Movie Details
| Tool | Description |
|------|-------------|
| `get_movie_details` | Get comprehensive movie details including cast & crew |
| `get_movie_recommendations` | Get movie recommendations based on a movie |
| `get_similar_movies` | Get movies similar to a specific movie |
| `get_movie_videos` | Get all videos (trailers, teasers, clips) for a movie |
| `get_movie_images` | Get all images (posters, backdrops, logos) for a movie |
| `get_movie_reviews` | Get user reviews for a movie |

### TV Show Details
| Tool | Description |
|------|-------------|
| `get_tv_details` | Get TV show details including seasons and episodes |
| `get_tv_recommendations` | Get TV show recommendations based on a show |
| `get_similar_tv` | Get TV shows similar to a specific show |
| `get_tv_videos` | Get all videos for a TV show |
| `get_tv_images` | Get all images for a TV show |
| `get_tv_reviews` | Get user reviews for a TV show |
| `get_season_details` | Get detailed information about a TV show season |
| `get_episode_details` | Get detailed information about a TV show episode |

### Person Details
| Tool | Description |
|------|-------------|
| `get_person_details` | Get person biography and filmography |
| `get_person_images` | Get all profile images for a person |

### Lists & Charts
| Tool | Description |
|------|-------------|
| `get_now_playing` | Get movies currently playing in theaters |
| `get_upcoming` | Get movies being released in the next 2 weeks |
| `get_popular_movies` | Get current popular movies |
| `get_top_rated_movies` | Get top rated movies of all time |
| `get_latest_movie` | Get the most recently added movie |
| `get_airing_today` | Get TV shows airing today |
| `get_on_the_air` | Get TV shows currently on the air |
| `get_popular_tv` | Get current popular TV shows |
| `get_top_rated_tv` | Get top rated TV shows of all time |
| `get_latest_tv` | Get the most recently added TV show |

### Reference Data
| Tool | Description |
|------|-------------|
| `get_movie_certifications` | Get movie certifications by country |
| `get_tv_certifications` | Get TV show certifications by country |

## Prerequisites

- Node.js 18+
- npm or yarn
- [TMDB API Key](https://www.themoviedb.org/settings/api) (Read Access Token)
- Cloudflare account (for deployment)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file for local development:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and add your TMDB API key:

```
TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Local Development

Start the development server:

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

### 4. Test Endpoints

**Offline test suite:**
```bash
npm test
```

**Live integration tests (require `TMDB_API_KEY` and outbound access to `api.themoviedb.org`):**
```bash
npm run test:endpoints
npm run test:integration
```

**Health Check:**
```bash
curl http://localhost:8787/health
```

**List Available Tools:**
```bash
curl http://localhost:8787/tools
```

**SSE Connection (for MCP clients):**
```bash
curl -N http://localhost:8787/sse
```

## Deployment

### Deploy to Cloudflare Workers

1. Set the TMDB API key as a secret:
```bash
wrangler secret put TMDB_API_KEY
```

2. Deploy:
```bash
npm run deploy
```

## MCP Client Configuration

### SSE Transport (Legacy)

Configure your MCP client to connect using SSE:

```json
{
  "mcpServers": {
    "tmdb": {
      "url": "http://localhost:8787/sse",
      "transport": "sse"
    }
  }
}
```

### Streamable HTTP Transport (Recommended)

The newer, more efficient transport protocol:

```json
{
  "mcpServers": {
    "tmdb": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http"
    }
  }
}
```

For deployed workers:
```json
{
  "mcpServers": {
    "tmdb": {
      "url": "https://tmdb-mcp-server.<your-subdomain>.workers.dev/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and server info |
| `/tools` | GET | List all available tools |
| `/sse` | GET | SSE transport connection (legacy) |
| `/message` | POST | SSE transport messages (legacy) |
| `/mcp` | GET/POST/DELETE | Streamable HTTP transport |

## Tool Usage Examples

### Search Movies
```json
{
  "name": "search_movies",
  "arguments": {
    "query": "The Matrix",
    "year": 1999
  }
}
```

### Get Movie Details
```json
{
  "name": "get_movie_details",
  "arguments": {
    "movie_id": 603
  }
}
```

### Discover Movies
```json
{
  "name": "discover_movies",
  "arguments": {
    "genres": "28,12",
    "min_rating": 7.5,
    "sort_by": "popularity.desc"
  }
}
```

### Get Trending
```json
{
  "name": "get_trending",
  "arguments": {
    "media_type": "movie",
    "time_window": "week"
  }
}
```

## Project Structure

```
tmdb-mcp/
├── src/
│   ├── index.ts           # Main server entry point
│   └── lib/
│       ├── tmdb-client.ts # TMDB API client with caching
│       └── mcp-tools.ts   # MCP tool definitions
├── package.json
├── wrangler.toml
├── tsconfig.json
└── .dev.vars.example
```

## API Reference

### TMDBClient

The `TMDBClient` class provides a type-safe wrapper around the TMDB API:

- Automatic error handling
- Rate limit detection (429 responses)
- Cloudflare Cache integration
- Image URL transformation

### Image URLs

All image paths returned by tools are converted to full URLs using the format:
```
https://image.tmdb.org/t/p/w500/{path}
```

Available sizes: w92, w154, w185, w342, w500, w780, original

## Error Handling

The server handles various error scenarios:

- **TMDB API Errors**: Returns descriptive error messages
- **Rate Limiting**: Returns 429 with retry-after header
- **Network Errors**: Graceful error messages
- **Invalid Input**: Zod validation errors

## License

MIT
