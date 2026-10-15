/**
 * Subagent exports
 */

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzer } from './code-quality-analyzer.js';
import { testCoverageAnalyzer } from './test-coverage-analyzer.js';
import { refactoringSuggester } from './refactoring-suggester.js';

export { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester };

/**
 * Agent names are the keys the orchestrator passes to the Task tool.
 * Prompt text must use these same names.
 */
export const reviewAgents: Record<string, AgentDefinition> = {
  'code-quality-analyzer': codeQualityAnalyzer,
  'test-coverage-analyzer': testCoverageAnalyzer,
  'refactoring-suggester': refactoringSuggester
};
