import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
* Suggests structural improvements (extraction, renaming, modernization,
* simplification, pattern upgrades). This is separate from defect finding.
*/
export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies refactoring opportunities that improve structure, naming, modernization, simplification, and clearer patterns. Use when you need design and clarity suggestions for a pull request file. This agent does not report security bugs or missing tests. This agent can invoke Skill guidance for language-specific refactoring patterns.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'inherit'
};
