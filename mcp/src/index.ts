#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "gadson32-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "calculate_roic",
  {
    title: "Calculate ROIC",
    description:
      "Compute return on invested capital (ROIC) as a percentage: (gain - cost) / cost * 100.",
    inputSchema: {
      investedCapital: z.number().positive().describe("Capital put in, e.g. token/infra/tool spend"),
      returnValue: z.number().describe("Value or revenue generated from that spend"),
    },
  },
  async ({ investedCapital, returnValue }) => {
    const roicPercent = ((returnValue - investedCapital) / investedCapital) * 100;
    return {
      content: [
        {
          type: "text",
          text: `ROIC: ${roicPercent.toFixed(2)}% (invested ${investedCapital}, returned ${returnValue})`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error running MCP server:", err);
  process.exit(1);
});
