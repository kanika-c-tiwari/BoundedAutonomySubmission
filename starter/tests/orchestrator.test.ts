import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { reviewAgents } from '../src/agents/index.js';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewReportSchema } from '../src/types/report-types.js';
import type { ReviewReport } from '../src/types/report-types.js';
import { ErrorCodes, ReviewError } from '../src/utils/error-handler.js';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

const mockedQuery = vi.mocked(query);

function sampleReport(): ReviewReport {
  return {
    pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
    fileReviews: [
      {
        file: 'README.md',
        codeQuality: {
          file: 'README.md',
          issues: [],
          overallScore: 90,
          summary: 'No code defects in the changed file.'
        },
        testCoverage: {
          file: 'README.md',
          hasTests: false,
          testFiles: [],
          untestedPaths: [],
          coverageEstimate: 0,
          summary: 'The changed file is documentation, so there is no unit under test.'
        },
        refactorings: {
          file: 'README.md',
          suggestions: [],
          summary: 'No structural refactor is suggested for a short README change.'
        }
      }
    ],
    summary: {
      totalFiles: 1,
      overallScore: 90,
      criticalIssues: 0,
      highPriorityTests: 0,
      refactoringOpportunities: 0
    },
    recommendations: [],
    metadata: {
      analyzedAt: '2026-01-01T00:00:00.000Z',
      duration: 1,
      agentVersions: { orchestrator: '1.0.0' }
    }
  };
}

function mockQueryResult(structuredOutput: unknown) {
  mockedQuery.mockImplementation(() => (async function* () {
    yield {
      type: 'system' as const,
      subtype: 'init' as const,
      mcp_servers: [
        { name: 'github', status: 'connected' },
        { name: 'eslint', status: 'connected' }
      ]
    };
    yield {
      type: 'assistant' as const,
      message: {
        content: [
          { type: 'tool_use' as const, name: 'mcp__github__get_pull_request_files', input: {} },
          { type: 'tool_use' as const, name: 'Task', input: { subagent_type: 'code-quality-analyzer' } },
          { type: 'tool_use' as const, name: 'Task', input: { subagent_type: 'test-coverage-analyzer' } },
          { type: 'tool_use' as const, name: 'Task', input: { subagent_type: 'refactoring-suggester' } }
        ]
      }
    };
    yield {
      type: 'result' as const,
      subtype: 'success' as const,
      structured_output: structuredOutput
    };
  })() as ReturnType<typeof query>);
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator.rateLimiter.getStatus()).toMatchObject({
        activeRequests: 0,
        requestsInWindow: 0,
        availableRequests: 50
      });
    });

    it('gives every subagent the Skill tool', () => {
      expect(Object.keys(reviewAgents)).toEqual([
        'code-quality-analyzer',
        'test-coverage-analyzer',
        'refactoring-suggester'
      ]);

      for (const [name, agent] of Object.entries(reviewAgents)) {
        expect(agent.tools, name).toContain('Skill');
      }
    });

    it('should accept custom rate limit configuration', async () => {
      const orchestrator = new CodeReviewOrchestrator({
        rateLimits: {
          maxRequestsPerMinute: 1,
          maxTokensPerMinute: 100,
          maxConcurrent: 1
        }
      });

      await orchestrator.rateLimiter.acquire(80);
      orchestrator.rateLimiter.release();
      expect(orchestrator.rateLimiter.canProceed(10)).toBe(false);
      expect(orchestrator.rateLimiter.getStatus().availableRequests).toBe(0);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      mockQueryResult(sampleReport());
      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });

      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      const call = mockedQuery.mock.calls[0]?.[0];
      expect(call?.options?.allowedTools).toEqual(expect.arrayContaining([
        'Task',
        'mcp__github__get_pull_request',
        'mcp__github__get_pull_request_files',
        'mcp__github__get_file_contents'
      ]));
      expect(call?.options?.mcpServers).toHaveProperty('github');
      expect(call?.prompt).toContain('octocat/Hello-World#1');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      mockQueryResult(sampleReport());
      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });

      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      const call = mockedQuery.mock.calls[0]?.[0];
      const prompt = String(call?.prompt);
      expect(prompt).toContain('Use the code-quality-analyzer agent');
      expect(prompt).toContain('Use the test-coverage-analyzer agent');
      expect(prompt).toContain('Use the refactoring-suggester agent');
      expect(prompt).toContain('in parallel');
      const agents = call?.options?.agents ?? {};
      expect(Object.keys(agents)).toEqual([
        'code-quality-analyzer',
        'test-coverage-analyzer',
        'refactoring-suggester'
      ]);
      for (const [name, agent] of Object.entries(agents)) {
        expect(agent.tools, name).toContain('Skill');
      }
    });

    it('should aggregate results into ReviewReport', async () => {
      mockQueryResult(sampleReport());
      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });

      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(report.pullRequest).toEqual({ owner: 'octocat', repo: 'Hello-World', number: 1 });
      expect(report.summary.totalFiles).toBe(1);
      expect(report.summary.overallScore).toBe(90);
      expect(report.fileReviews[0]?.file).toBe('README.md');
      expect(report.metadata.agentVersions['code-quality-analyzer']).toBe('1.0.0');
    });

    it('should validate output with Zod schema', async () => {
      mockQueryResult(sampleReport());
      const orchestrator = new CodeReviewOrchestrator({ maxRetries: 1 });
      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      expect(() => ReviewReportSchema.parse(report)).not.toThrow();

      mockQueryResult({ pullRequest: { owner: 'octocat' } });
      await expect(orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toBeInstanceOf(ReviewError);
      await expect(orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)).rejects.toMatchObject({
        code: ErrorCodes.RETRY_EXHAUSTED
      });
    });
  });

  describe('Integration', () => {
    // This file mocks the Claude SDK, so this cannot call the live API.
    // Run a real review with: npm run dev -- octocat Hello-World 1
    it.skip('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      expect(report.pullRequest.number).toBe(1);
    });
  });
});
