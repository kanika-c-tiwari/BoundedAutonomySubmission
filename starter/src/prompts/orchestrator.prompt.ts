/**
 * User prompt for the code-review orchestrator.
 * The final message must match ReviewReportSchema in src/types/report-types.ts.
 */
export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `You are the code review orchestrator for a GitHub pull request. You coordinate three subagents and you do not review the code yourself.

Pull request: ${owner}/${repo}#${prNumber}

## Step 1 — Fetch the pull request
Use the GitHub MCP tools:
- mcp__github__get_pull_request with owner "${owner}", repo "${repo}", and pull number ${prNumber}
- mcp__github__get_pull_request_files for the same pull request
- mcp__github__get_file_contents for each changed code file you will review (use the PR head ref when the tool asks for a ref)

Review source files only (.ts, .tsx, .js, .jsx, .mjs, .cjs, .py). Skip lockfiles, generated files, images, and markdown. Review at most 8 files. If the PR has no code files, still return a valid report with an empty fileReviews array.

## Step 2 — Invoke every subagent
For each selected file, invoke all three agents in parallel. In one assistant turn, call the Task tool three times. Use these exact agent names and this explicit wording:

- Use the code-quality-analyzer agent to analyze <path>
- Use the test-coverage-analyzer agent to analyze <path>
- Use the refactoring-suggester agent to analyze <path>

Pass the file path and the file contents in each task. Parallel is required because the three analyses do not depend on each other. Do not review the file yourself while they run.

## Step 3 — If a subagent fails
Retry that one agent a single time. If it fails again, do not abort the review. Fill that section with a valid empty result and explain the failure in its summary:
- code quality: issues [], overallScore 0
- test coverage: hasTests false, testFiles [], untestedPaths [], coverageEstimate 0
- refactoring: suggestions []

## Step 4 — Aggregate a ReviewReport
After every selected file has three results, return one JSON object and nothing else:

{
  "pullRequest": { "owner": "${owner}", "repo": "${repo}", "number": ${prNumber} },
  "fileReviews": [
    {
      "file": "path/from/the/pr",
      "codeQuality": { "file": "same path", "issues": [], "overallScore": 0, "summary": "" },
      "testCoverage": { "file": "same path", "hasTests": false, "testFiles": [], "untestedPaths": [], "coverageEstimate": 0, "summary": "" },
      "refactorings": { "file": "same path", "suggestions": [], "summary": "" }
    }
  ],
  "summary": {
    "totalFiles": 0,
    "overallScore": 0,
    "criticalIssues": 0,
    "highPriorityTests": 0,
    "refactoringOpportunities": 0
  },
  "recommendations": [
    {
      "priority": "high",
      "category": "security",
      "description": "What to change and why.",
      "files": ["path/from/the/pr"]
    }
  ],
  "metadata": {
    "analyzedAt": "ISO-8601 timestamp",
    "duration": 0,
    "agentVersions": {
      "code-quality-analyzer": "1.0.0",
      "test-coverage-analyzer": "1.0.0",
      "refactoring-suggester": "1.0.0"
    }
  }
}

Summary rules:
- totalFiles equals fileReviews.length
- overallScore is the average of codeQuality.overallScore values, or 100 when there are no files
- criticalIssues counts issues whose severity is "critical"
- highPriorityTests counts untested paths whose priority is "critical" or "high"
- refactoringOpportunities counts every refactoring suggestion
- recommendations are the few changes a reviewer should make first. priority is critical, high, medium, or low
- Copy subagent findings through. Do not drop required fields.
`;
}
