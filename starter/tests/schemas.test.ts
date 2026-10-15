import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultJSONSchema,
  CodeQualityResultSchema,
  RefactoringSuggestionJSONSchema,
  RefactoringSuggestionSchema,
  TestCoverageResultJSONSchema,
  TestCoverageResultSchema
} from '../src/types/analysis-results.js';
import { ReviewReportJSONSchema, ReviewReportSchema } from '../src/types/report-types.js';
import type {
  CodeQualityResult,
  RefactoringSuggestion,
  TestCoverageResult
} from '../src/types/analysis-results.js';
import type { ReviewReport } from '../src/types/report-types.js';

const validQuality = (overallScore: number): CodeQualityResult => ({
  file: 'src/todos.ts',
  issues: [
    {
      line: 12,
      severity: 'high',
      category: 'bug-risk',
      description: 'The filter compares ids with ==, so a numeric id matches a numeric string.',
      suggestion: 'Compare with === after normalizing both ids to strings.'
    }
  ],
  overallScore,
  summary: 'One equality bug in the filter; the rest of the module is small and direct.'
});

const validCoverage = (coverageEstimate: number): TestCoverageResult => ({
  file: 'src/todos.ts',
  hasTests: true,
  testFiles: ['src/todos.test.ts'],
  untestedPaths: [
    {
      type: 'branch',
      location: 'searchTodos() when the query is empty',
      priority: 'high',
      reasoning: 'An empty query currently returns every todo, and no test locks that in.',
      suggestedTest: 'Call searchTodos with an empty string and assert the full list is returned unchanged.'
    }
  ],
  coverageEstimate,
  summary: 'The happy path is tested. The empty-query branch is not.'
});

const validRefactoring = (): RefactoringSuggestion => ({
  file: 'src/todos.ts',
  suggestions: [
    {
      type: 'extract-function',
      location: 'searchTodos lines 20-40',
      impact: 'medium',
      description: 'Matching and sorting are interleaved in one loop.',
      before: 'for (const todo of todos) { /* match and sort inline */ }',
      after: 'return sortMatches(todos.filter((todo) => matches(todo, query)));',
      benefits: 'The match rule can change without touching the sort.'
    }
  ],
  summary: 'Extracting the match predicate would make the search easier to test.'
});

const validReport = (): ReviewReport => ({
  pullRequest: { owner: 'udacity', repo: 'cd14715-simple-todo-app', number: 2 },
  fileReviews: [
    {
      file: 'src/todos.ts',
      codeQuality: validQuality(80),
      testCoverage: validCoverage(60),
      refactorings: validRefactoring()
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 80,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1
  },
  recommendations: [
    {
      priority: 'high',
      category: 'bug-risk',
      description: 'Normalize todo ids before comparison.',
      files: ['src/todos.ts']
    }
  ],
  metadata: {
    analyzedAt: '2026-10-15T12:00:00.000Z',
    duration: 1200,
    agentVersions: {
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0'
    }
  }
});

describe('Zod schemas', () => {
  describe('valid data', () => {
    it('parses a code quality result', () => {
      expect(CodeQualityResultSchema.parse(validQuality(80))).toMatchObject({ file: 'src/todos.ts' });
    });

    it('parses a test coverage result', () => {
      expect(TestCoverageResultSchema.parse(validCoverage(60)).hasTests).toBe(true);
    });

    it('parses a refactoring suggestion', () => {
      expect(RefactoringSuggestionSchema.parse(validRefactoring()).suggestions).toHaveLength(1);
    });

    it('parses a full review report', () => {
      expect(ReviewReportSchema.parse(validReport()).pullRequest.number).toBe(2);
    });
  });

  describe('invalid data', () => {
    it('rejects a code quality issue with an unknown severity', () => {
      const invalid = validQuality(80);
      invalid.issues[0]!.severity = 'urgent' as CodeQualityResult['issues'][number]['severity'];
      expect(() => CodeQualityResultSchema.parse(invalid)).toThrow(ZodError);
    });

    it('rejects a coverage path with the wrong type', () => {
      const invalid = validCoverage(60);
      invalid.untestedPaths[0]!.location = 12 as unknown as string;
      expect(() => TestCoverageResultSchema.parse(invalid)).toThrow(ZodError);
    });

    it('rejects a refactoring suggestion that omits the after example', () => {
      const invalid = validRefactoring();
      delete (invalid.suggestions[0] as Partial<RefactoringSuggestion['suggestions'][number]>).after;
      expect(() => RefactoringSuggestionSchema.parse(invalid)).toThrow(ZodError);
    });

    it('rejects a report that is missing the summary', () => {
      const invalid = validReport() as Partial<ReviewReport>;
      delete invalid.summary;
      expect(() => ReviewReportSchema.parse(invalid)).toThrow(ZodError);
    });
  });

  describe('edge cases', () => {
    it('accepts empty issue, path, and suggestion arrays', () => {
      const quality = validQuality(100);
      quality.issues = [];
      const coverage = validCoverage(0);
      coverage.untestedPaths = [];
      coverage.testFiles = [];
      coverage.hasTests = false;
      const refactoring = validRefactoring();
      refactoring.suggestions = [];

      expect(CodeQualityResultSchema.parse(quality).issues).toEqual([]);
      expect(TestCoverageResultSchema.parse(coverage).coverageEstimate).toBe(0);
      expect(RefactoringSuggestionSchema.parse(refactoring).suggestions).toEqual([]);
    });

    it('accepts scores at both boundaries and rejects scores outside 0-100', () => {
      expect(CodeQualityResultSchema.parse(validQuality(0)).overallScore).toBe(0);
      expect(CodeQualityResultSchema.parse(validQuality(100)).overallScore).toBe(100);
      expect(() => CodeQualityResultSchema.parse(validQuality(-1))).toThrow(ZodError);
      expect(() => CodeQualityResultSchema.parse(validQuality(101))).toThrow(ZodError);
      expect(() => TestCoverageResultSchema.parse(validCoverage(101))).toThrow(ZodError);
    });

    it('accepts an empty agentVersions record and rejects a missing one', () => {
      const report = validReport();
      report.metadata.agentVersions = {};
      expect(ReviewReportSchema.parse(report).metadata.agentVersions).toEqual({});

      const missing = validReport();
      delete (missing.metadata as Partial<ReviewReport['metadata']>).agentVersions;
      expect(() => ReviewReportSchema.parse(missing)).toThrow(ZodError);
    });
  });

  describe('JSON schema export', () => {
    it('exports object schemas whose required fields match the Zod objects', () => {
      for (const schema of [
        CodeQualityResultJSONSchema,
        TestCoverageResultJSONSchema,
        RefactoringSuggestionJSONSchema,
        ReviewReportJSONSchema
      ]) {
        expect(schema.type).toBe('object');
        expect(Array.isArray(schema.required)).toBe(true);
      }

      expect(CodeQualityResultJSONSchema.required).toEqual(
        expect.arrayContaining(['file', 'issues', 'overallScore', 'summary'])
      );
      expect(TestCoverageResultJSONSchema.required).toEqual(
        expect.arrayContaining(['file', 'hasTests', 'testFiles', 'untestedPaths', 'coverageEstimate', 'summary'])
      );
      expect(RefactoringSuggestionJSONSchema.required).toEqual(
        expect.arrayContaining(['file', 'suggestions', 'summary'])
      );
      expect(ReviewReportJSONSchema.required).toEqual(
        expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
      );
    });
  });
});
