#!/usr/bin/env node
/**
 * B-4: LexDiff MCP Server
 *
 * Exposes LexDiff capabilities as MCP tools for AI agents (Claude, etc.).
 * Communicates via stdio using the MCP protocol.
 *
 * Tools:
 *   lexdiff_what_changed(act_eli, since_date) → ChangeEvent[]
 *   lexdiff_search_acts(q, keyword, type)     → ActMetadata[]
 *   lexdiff_get_act(eli)                      → ActMetadata
 *   lexdiff_get_timeline(eli)                 → ChangeEvent[]
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EliClient } from "@lexdiff/core";

const API_BASE =
  process.env["LEXDIFF_API_URL"] ?? "http://localhost:3001";

// Thin fetch wrapper around the LexDiff REST API
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`LexDiff API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "lexdiff_what_changed",
    description:
      "Return all change events for a Polish legal act that occurred on or after a given date. " +
      "Useful for answering 'what changed in act X since date Y?'",
    inputSchema: {
      type: "object" as const,
      properties: {
        act_eli: {
          type: "string",
          description:
            "ELI identifier of the act (slash-separated), e.g. 'DU/2017/2196'",
        },
        since_date: {
          type: "string",
          description: "ISO 8601 date (YYYY-MM-DD). Filter events on or after this date.",
        },
      },
      required: ["act_eli"],
    },
  },
  {
    name: "lexdiff_search_acts",
    description: "Search for Polish legal acts by full-text query, keyword, or type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Full-text search query" },
        keyword: { type: "string", description: "Keyword to filter by" },
        type: {
          type: "string",
          description: "Act type, e.g. 'Ustawa', 'Rozporządzenie'",
        },
      },
    },
  },
  {
    name: "lexdiff_get_act",
    description: "Fetch metadata for a specific Polish legal act by ELI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        eli: {
          type: "string",
          description: "ELI identifier (slash-separated), e.g. 'DU/2017/2196'",
        },
      },
      required: ["eli"],
    },
  },
  {
    name: "lexdiff_get_timeline",
    description: "Return the full change timeline (all stored ChangeEvents) for an act.",
    inputSchema: {
      type: "object" as const,
      properties: {
        eli: {
          type: "string",
          description: "ELI identifier (slash-separated), e.g. 'DU/2017/2196'",
        },
      },
      required: ["eli"],
    },
  },
  {
    name: "lexdiff_diff_versions",
    description:
      "Compute a structural diff between two versions of a legal act. " +
      "Returns UnitAmended / UnitAdded / UnitRepealed / UnitRenumbered events.",
    inputSchema: {
      type: "object" as const,
      properties: {
        eli: { type: "string", description: "Base act ELI" },
        from: { type: "string", description: "ELI of the older version" },
        to: { type: "string", description: "ELI of the newer version" },
      },
      required: ["eli", "from", "to"],
    },
  },
];

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "lexdiff", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "lexdiff_what_changed": {
        const { act_eli, since_date } = args as {
          act_eli: string;
          since_date?: string;
        };
        const eliParam = act_eli.replace(/\//g, ":");
        const res = await apiFetch<{ events: unknown[] }>(
          `/acts/${encodeURIComponent(eliParam)}/timeline`,
        );
        let events = res.events as Array<Record<string, unknown>>;
        if (since_date) {
          events = events.filter(
            (e) =>
              typeof e["effectiveDate"] === "string" &&
              e["effectiveDate"] >= since_date,
          );
        }
        return {
          content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
        };
      }

      case "lexdiff_search_acts": {
        const { q, keyword, type } = args as {
          q?: string;
          keyword?: string;
          type?: string;
        };
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (keyword) params.set("keyword", keyword);
        if (type) params.set("type", type);
        const acts = await apiFetch<unknown[]>(
          `/acts/search?${params.toString()}`,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(acts, null, 2) }],
        };
      }

      case "lexdiff_get_act": {
        const { eli } = args as { eli: string };
        const eliParam = eli.replace(/\//g, ":");
        const act = await apiFetch<unknown>(
          `/acts/${encodeURIComponent(eliParam)}`,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(act, null, 2) }],
        };
      }

      case "lexdiff_get_timeline": {
        const { eli } = args as { eli: string };
        const eliParam = eli.replace(/\//g, ":");
        const res = await apiFetch<{ events: unknown[] }>(
          `/acts/${encodeURIComponent(eliParam)}/timeline`,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.events, null, 2) }],
        };
      }

      case "lexdiff_diff_versions": {
        const { eli, from, to } = args as {
          eli: string;
          from: string;
          to: string;
        };
        const eliParam = eli.replace(/\//g, ":");
        const params = new URLSearchParams({ from, to });
        const res = await apiFetch<{ events: unknown[] }>(
          `/acts/${encodeURIComponent(eliParam)}/diff?${params.toString()}`,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.events, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${String(err)}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
