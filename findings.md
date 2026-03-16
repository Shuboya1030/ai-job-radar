# Findings & Research

## 2026-03-15: Initial Assessment

### Claude Agent SDK
- Package: `anthropic` (not a separate `claude_agent_sdk` package)
- The Anthropic Python SDK includes tool use / agent capabilities natively
- Tool definitions use JSON Schema format
- Agent loop: send messages with tools → Claude calls tools → process results → repeat
- Docs: https://docs.anthropic.com/en/docs/build-with-claude/tool-use

### Current Data State
- 215+ companies, 84 with known funding (40% coverage — need >50%)
- 390+ jobs from 4 sources
- Companies missing: `funding_source_url`, `discovered_via` columns
- Jobs missing: `listing_source_url` column
- No `agent_runs` table exists yet

### Admin Dashboard Current State
- Shows: DAU, total views, unique visitors, active jobs, companies count, top pages
- Missing: funding coverage gauge, agent run history, source breakdown, traceability

### Key Constraint: Anthropic SDK Tool Use Pattern
```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "supabase_query",
        "description": "Execute a query against the Supabase database",
        "input_schema": {
            "type": "object",
            "properties": {
                "operation": {"type": "string", "enum": ["select", "insert", "update"]},
                "table": {"type": "string"},
                "data": {"type": "object"}
            },
            "required": ["operation", "table"]
        }
    }
]

# Agent loop
messages = [{"role": "user", "content": "Run the daily pipeline..."}]
while True:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        tools=tools,
        messages=messages
    )
    if response.stop_reason == "tool_use":
        # Process tool calls, add results, continue
        ...
    else:
        break  # Agent is done
```
