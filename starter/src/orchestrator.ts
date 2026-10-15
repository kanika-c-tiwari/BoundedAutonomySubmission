import { query } from '@anthropic-ai/claude-agent-sdk';
import { reviewAgents } from './agents/index.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { ReviewReportSchema } from './types/report-types.js';
import type { ReviewReport } from './types/report-types.js';
import { ReviewReportJSONSchema } from './types/index.js';
import { logReviewComplete, logReviewError, logReviewStart, logger } from './utils/logger.js';
import {
  ErrorCodes,
  ReviewError,
  withRetry,
  withTimeout
} from './utils/error-handler.js';
import { RateLimiter, type RateLimiterConfig } from './utils/rate-limiter.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  /** Override ANTHROPIC_MODEL for this run. */
  model?: string;
  /** Conversation turns available for MCP calls plus three subagents. */
  maxTurns?: number;
  /** Directory that contains .claude/skills. Defaults to PROJECT_ROOT or cwd. */
  projectRoot?: string;
  /** Sliding-window limits applied before each review. */
  rateLimits?: Partial<RateLimiterConfig>;
  /** Token estimate reserved for one pull-request review. */
  estimatedTokens?: number;
  /** Attempts for a failed review, including the first try. */
  maxRetries?: number;
  /** Milliseconds before a single attempt is abandoned. */
  timeoutMs?: number;
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_ESTIMATED_TOKENS = 10_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

const AGENT_VERSIONS: Record<string, string> = {
  'code-quality-analyzer': '1.0.0',
  'test-coverage-analyzer': '1.0.0',
  'refactoring-suggester': '1.0.0'
};

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly options: OrchestratorOptions;
  readonly rateLimiter: RateLimiter;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
    this.rateLimiter = new RateLimiter(options.rateLimits);
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const model = this.options.model ?? process.env.ANTHROPIC_MODEL;
    if (!model) {
      throw new ReviewError(
        'ANTHROPIC_MODEL is not set. Add it to the environment or .env before running a review. Anthropic API example: claude-sonnet-4-5-20250929. Bedrock example: us.anthropic.claude-sonnet-4-5-20250929-v1:0.',
        ErrorCodes.INVALID_CONFIG
      );
    }

    const projectRoot = this.options.projectRoot ?? process.env.PROJECT_ROOT ?? process.cwd();
    const startedAt = Date.now();
    const estimatedTokens = this.options.estimatedTokens ?? DEFAULT_ESTIMATED_TOKENS;
    logReviewStart(owner, repo, prNumber);

    await this.rateLimiter.acquire(estimatedTokens);
    try {
      const report = await withRetry(
        () => withTimeout(
          () => this.collectReport(owner, repo, prNumber, model, projectRoot, startedAt),
          this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          `Code review timed out for ${owner}/${repo}#${prNumber}`
        ),
        this.options.maxRetries ?? 2,
        1000
      );
      logReviewComplete(owner, repo, prNumber, report.summary.overallScore, report.metadata.duration);
      return report;
    } catch (error) {
      const reviewError = error instanceof Error ? error : new Error(String(error));
      logReviewError(owner, repo, prNumber, reviewError);
      throw reviewError;
    } finally {
      this.rateLimiter.release();
    }
  }

  private async collectReport(
    owner: string,
    repo: string,
    prNumber: number,
    model: string,
    projectRoot: string,
    startedAt: number
  ): Promise<ReviewReport> {
    for await (const message of query({
      prompt: buildOrchestratorPrompt(owner, repo, prNumber),
      options: {
        model,
        cwd: projectRoot,
        settingSources: ['project'],
        mcpServers: mcpServersConfig,
        // Task is required to spawn subagents. The other entries are the
        // GitHub, ESLint, skill, and file tools those agents are allowed to use.
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__get_pull_request',
          'mcp__github__get_pull_request_files',
          'mcp__github__get_file_contents',
          'mcp__eslint__lint'
        ],
        agents: reviewAgents,
        permissionMode: 'dontAsk',
        maxTurns: this.options.maxTurns ?? DEFAULT_MAX_TURNS,
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        }
      }
    })) {
      if (message.type === 'system' && message.subtype === 'init') {
        logger.info('MCP servers initialized', { mcpServers: message.mcp_servers });
      }

      if (message.type === 'assistant' && Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            logger.info('Tool invoked', { tool: block.name });
          }
        }
      }

      if (message.type !== 'result') {
        continue;
      }

      if (message.subtype === 'success' && message.structured_output) {
        const parsed = ReviewReportSchema.safeParse(message.structured_output);
        if (!parsed.success) {
          throw new ReviewError(
            `Review report failed schema validation: ${parsed.error.message}`,
            ErrorCodes.STRUCTURED_OUTPUT_FAILED
          );
        }
        return withRunMetadata(parsed.data, owner, repo, prNumber, startedAt);
      }

      if (message.subtype === 'error_max_structured_output_retries') {
        throw new ReviewError(
          'Structured output generation failed after the maximum number of retries.',
          ErrorCodes.STRUCTURED_OUTPUT_FAILED,
          { subtype: message.subtype }
        );
      }

      throw new ReviewError(
        `Code review failed: ${message.subtype}`,
        ErrorCodes.AGENT_FAILED,
        { subtype: message.subtype }
      );
    }

    throw new ReviewError(
      'Code review ended without a structured report',
      ErrorCodes.AGENT_FAILED
    );
  }
}

/** Name used by the Part 1 quick-start snippet. */
export { CodeReviewOrchestrator as Orchestrator };

function withRunMetadata(
  report: ReviewReport,
  owner: string,
  repo: string,
  prNumber: number,
  startedAt: number
): ReviewReport {
  const scores = report.fileReviews.map((review) => review.codeQuality.overallScore);
  const overallScore = scores.length === 0
    ? report.summary.overallScore
    : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);

  const criticalIssues = report.fileReviews.reduce(
    (count, review) => count + review.codeQuality.issues.filter((issue) => issue.severity === 'critical').length,
    0
  );
  const highPriorityTests = report.fileReviews.reduce(
    (count, review) => count + review.testCoverage.untestedPaths.filter(
      (path) => path.priority === 'critical' || path.priority === 'high'
    ).length,
    0
  );
  const refactoringOpportunities = report.fileReviews.reduce(
    (count, review) => count + review.refactorings.suggestions.length,
    0
  );

  return {
    ...report,
    pullRequest: { owner, repo, number: prNumber },
    summary: {
      totalFiles: report.fileReviews.length,
      overallScore,
      criticalIssues,
      highPriorityTests,
      refactoringOpportunities
    },
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: Date.now() - startedAt,
      agentVersions: AGENT_VERSIONS
    }
  };
}
