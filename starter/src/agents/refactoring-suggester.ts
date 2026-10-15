import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Suggests structural improvements (extraction, renaming, modernization,
 * simplification, pattern upgrades). This is separate from defect finding.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies refactoring opportunities that improve structure: extract function, rename, modernize syntax, simplify control flow, and apply clearer patterns. Use when you need design and clarity suggestions for a pull request file. This agent does not report security bugs or missing tests.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: ['Read', 'Grep', 'Glob'],
  model: 'inherit'
};
