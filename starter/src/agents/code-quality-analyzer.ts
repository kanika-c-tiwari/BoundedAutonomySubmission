import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Reviews a file for security, performance, and maintainability issues.
 * The Skill tool is required so this agent can apply project skills
 * such as javascript-best-practices and security-analysis.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes a source file for security vulnerabilities, performance problems, bug risk, and maintainability issues. Use when a pull request file needs a code quality review. This agent invokes the Skill tool (javascript-best-practices, typescript-patterns, security-analysis, python-code-review) and can lint with ESLint.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__eslint__lint'],
  model: 'inherit',
  mcpServers: ['eslint']
};
