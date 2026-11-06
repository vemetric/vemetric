import type { CallToolResult } from '@modelcontextprotocol/server';
import { resolveCallerContext, type McpCaller } from './caller';
import { getErrorCode, getRateLimitMessage, getToolErrorMessage, UNEXPECTED_ERROR_MESSAGE } from './errors';
import { consumeRateLimit } from '../api/middleware/rate-limit';
import type { ApiServiceContext } from '../api/services/context';
import { logger } from '../api/utils/api-logger';
import { ApiError } from '../api/utils/errors';

type ToolData = Record<string, unknown>;

export function toolResult(data: ToolData): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/** Rate limit hits become tool errors, so the model can explain them and wait instead of the client failing. */
class RateLimitError extends Error {
  constructor(readonly resetSec: number) {
    super('MCP rate limit exceeded');
  }
}

async function countToolCall(redisKey: string) {
  const { exceeded, resetSec } = await consumeRateLimit(redisKey);
  if (exceeded) {
    throw new RateLimitError(resetSec);
  }
}

type RunToolOptions = {
  tool: string;
  caller: McpCaller;
  input?: unknown;
};

/**
 * Runs a tool about one project: resolves the project from the optional `projectId`, counts the call against the
 * project's MCP rate limit (separate from the REST one) and turns errors into tool results.
 */
export async function runProjectTool<Input extends { projectId?: string }>(
  { tool, caller, input }: RunToolOptions & { input: Input },
  execute: (ctx: ApiServiceContext) => Promise<ToolData>,
): Promise<CallToolResult> {
  return runTool({ tool, caller, input }, async (log) => {
    let ctx: ApiServiceContext;
    try {
      ctx = await resolveCallerContext(caller, input.projectId);
    } catch (error) {
      // Failed lookups count against the key, so guessing project ids is rate limited too.
      await countToolCall(`ratelimit:mcp:key:${caller.apiKey.id}`);
      throw error;
    }
    log.projectId = ctx.project.id;

    await countToolCall(`ratelimit:mcp:${ctx.project.id}`);
    return execute(ctx);
  });
}

/** Runs a tool that isn't about one project (e.g. `list_projects`), counted against the key's MCP rate limit. */
export async function runCallerTool(
  { tool, caller }: RunToolOptions,
  execute: () => Promise<ToolData>,
): Promise<CallToolResult> {
  return runTool({ tool, caller }, async () => {
    await countToolCall(`ratelimit:mcp:key:${caller.apiKey.id}`);
    return execute();
  });
}

async function runTool(
  { tool, caller, input }: RunToolOptions,
  execute: (log: { projectId?: string }) => Promise<ToolData>,
): Promise<CallToolResult> {
  const start = Date.now();
  const log: { projectId?: string; errorCode?: string } = {};

  try {
    return toolResult(await execute(log));
  } catch (error) {
    if (error instanceof RateLimitError) {
      log.errorCode = 'RATE_LIMIT_EXCEEDED';
      return toolError(getRateLimitMessage(error.resetSec));
    }

    log.errorCode = getErrorCode(error);
    if (error instanceof ApiError) {
      return toolError(getToolErrorMessage(error, { organizationId: caller.apiKey.organizationId, input }));
    }

    logger.error(
      {
        err: error,
        tool,
        apiKeyId: caller.apiKey.id,
        organizationId: caller.apiKey.organizationId,
        projectId: log.projectId,
      },
      'Unhandled MCP tool error',
    );
    return toolError(UNEXPECTED_ERROR_MESSAGE);
  } finally {
    logger.info({
      type: 'mcp.tool',
      tool,
      latencyMs: Date.now() - start,
      apiKeyId: caller.apiKey.id,
      organizationId: caller.apiKey.organizationId,
      projectId: log.projectId,
      errorCode: log.errorCode,
    });
  }
}
