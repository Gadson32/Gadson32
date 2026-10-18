# Gadson32 MCP Server

Minimal Model Context Protocol (MCP) server scaffold. Runs over stdio and exposes one tool, `calculate_roic`, which computes return on invested capital — the Buffett-style "did this spend pay for itself" check for token/infra/tool costs.

## Run it

```bash
cd mcp
npm install
npm run build
npm start
```

This starts the server on stdio. It is meant to be launched by an MCP client (Claude Code, claude.ai), not run standalone for interactive use.

## Register in Claude Code

From the repo root:

```bash
claude mcp add gadson32 -- node mcp/dist/index.js
```

Verify it's registered:

```bash
claude mcp list
```

Then in any Claude Code session, the `calculate_roic` tool is available.

## Register in claude.ai as a custom connector

1. Deploy this server somewhere reachable over HTTP/SSE, or use a tunnel (e.g. `ngrok`) if testing locally — claude.ai custom connectors require a network-reachable endpoint, not stdio.
2. In claude.ai, go to **Settings → Connectors → Add custom connector**.
3. Enter the server's URL and complete the connector setup flow.
4. Enable the connector in a project or conversation to use `calculate_roic`.

> Note: this scaffold ships the stdio transport (for Claude Code / local MCP clients). To expose it to claude.ai directly, swap `StdioServerTransport` in `src/index.ts` for an HTTP/SSE transport per the [MCP SDK docs](https://github.com/modelcontextprotocol/typescript-sdk).

## Adding more tools

Add additional `server.registerTool(...)` calls in `src/index.ts`. Keep each tool's `inputSchema` strict (zod) and its description short enough that a model picks it correctly on the first try.
