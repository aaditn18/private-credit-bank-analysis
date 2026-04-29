"""stdio MCP server exposing the four tools.

Run with::

    python -m pc_analyst.mcp_server

Claude Desktop / Cursor can connect via its standard MCP config:

    {
      "mcpServers": {
        "private-credit": {
          "command": "python",
          "args": ["-m", "pc_analyst.mcp_server"],
          "cwd": "<repo>/backend"
        }
      }
    }
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .mcp_tools import TOOLS

server = Server("pc-analyst")


@server.list_tools()
async def _list_tools() -> list[Tool]:
    return [
        Tool(name=spec.name, description=spec.description, inputSchema=spec.schema)
        for spec in TOOLS.values()
    ]


@server.call_tool()
async def _call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    spec = TOOLS.get(name)
    if not spec:
        return [TextContent(type="text", text=json.dumps({"error": f"unknown tool {name}"}))]
    try:
        result = spec.handler(**arguments)
    except TypeError as e:
        result = {"error": f"bad arguments: {e}"}
    except Exception as e:  # pragma: no cover
        result = {"error": f"tool {name} failed: {e!r}"}
    return [TextContent(type="text", text=json.dumps(result, default=str))]


async def _main() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
