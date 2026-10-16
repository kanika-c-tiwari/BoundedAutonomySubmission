import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
* Estimates test coverage by comparing a source file with its test files
* and proposes specific missing cases. It does not run the test suite.
*/
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Estimates test coverage for a changed source file by comparing it with existing test files and suggests concrete missing test cases. Use when you need to know which functions, branches, or edge cases in a pull request file are untested. This agent can invoke Skill guidance for language-specific testing patterns.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'inherit'
};
