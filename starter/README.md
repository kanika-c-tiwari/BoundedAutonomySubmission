# Enterprise Multi-Agent Code Review Orchestrator

 
# Multi-Agent Code Review System
Reviews a GitHub pull request with three specialized agents and writes a JSON, Markdown, and HTML report.
The orchestrator fetches the pull request through the GitHub MCP server, then runs these agents in parallel:
| Agent | What it reviews |
| --- | --- |
| `code-quality-analyzer` | Security, performance, bugs, and maintainability. Uses project skills and ESLint. |
| `test-coverage-analyzer` | Compares source files with tests and suggests missing cases. |
| `refactoring-suggester` | Structure, naming, and modernization, separate from bug findings. |
## Prerequisites
- Node.js 18 or newer (`node -v`)
- An Anthropic API key, or AWS Bedrock credentials
- A GitHub personal access token is optional. Public repositories work without one. A token with `repo` and `read:org` raises the rate limit.
## Setup
From the repository root, install dependencies:
```bash
npm install
cd project/starter
```
If you are already inside `project/starter` and dependencies are installed, stay in that directory for every command below.
Create a local env file and edit it:
```bash
cp .env.example .env
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env
```
`.env` is gitignored. Do not commit it and do not put real keys in source files.
### Environment variables
```bash
# Required for the Anthropic API. Omit this if you use Bedrock instead.
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Required when your key is served through a gateway. Use the URL from your course workspace.
# Direct Anthropic access:
ANTHROPIC_BASE_URL=https://api.anthropic.com
# Required. Bedrock model IDs look like us.anthropic.claude-sonnet-4-5-20250929-v1:0
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
# Required. Absolute path to this directory. It must contain .claude/skills/.
PROJECT_ROOT=/absolute/path/to/project/starter
# Optional
# GITHUB_TOKEN=ghp_your-token-here
LOG_LEVEL=info
```
Bedrock instead of an API key:
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```
`PROJECT_ROOT` examples:
```bash
# Windows
PROJECT_ROOT=C:\Users\you\Downloads\cd14715-claude-code-classroom-main\project\starter
```
## Usage
Run all commands from `project/starter`.
```bash
npm run dev -- <owner> <repo> <pr-number>
```
`owner` is the GitHub account, `repo` is the repository name, and `pr-number` is the pull request number. The `--` passes those three values through to the program.
Example:
```bash
npm run dev -- octocat Hello-World 1
```
A successful run prints the score and the three saved files. Reports land in `reports/`:
```text
reports/<owner>_<repo>_<pr-number>.json
reports/<owner>_<repo>_<pr-number>.md
reports/<owner>_<repo>_<pr-number>.html
```
### Submission reviews
These three pull requests are in the public repository [udacity/cd14715-simple-todo-app](https://github.com/udacity/cd14715-simple-todo-app):
```bash
npm run dev -- udacity cd14715-simple-todo-app 1
npm run dev -- udacity cd14715-simple-todo-app 2
npm run dev -- udacity cd14715-simple-todo-app 3
```
That produces nine files, three formats for each pull request.
### Build, tests, and production
```bash
npm test
npm run build
npm start -- <owner> <repo> <pr-number>
```
`npm test` runs the unit tests. One integration test is skipped because it calls the live API. `npm start` runs the compiled program in `dist/`.
## What a report contains
Each JSON report matches the review schema:
- `pullRequest` — owner, repository, and number
- `fileReviews` — code quality, test coverage, and refactoring suggestions per file
- `summary` — file count, overall score from 0 to 100, critical issues, high-priority tests, and refactoring count
- `recommendations` — the changes to make first
- `metadata` — timestamp, duration, and agent versions
The Markdown and HTML files are the same review in readable form.
## Troubleshooting
**Authentication required.** Set `ANTHROPIC_API_KEY`, or all three of `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`. `ANTHROPIC_MODEL` is required either way.
**`spawn node ENOENT`.** The shell running npm cannot find Node. Run `node -v`. On Windows, also run `where.exe node`, then open a new terminal. `PROJECT_ROOT` must be the Windows path to `project/starter` on that machine.
**Skills not loading.** `PROJECT_ROOT` must be the absolute path of the folder that contains `.claude/skills/`.
**GitHub rate limit or private repository.** Set `GITHUB_TOKEN`. The app maps it to `GITHUB_PERSONAL_ACCESS_TOKEN` for the GitHub MCP server.
**Empty or invalid report.** Confirm the log shows the `Task` tool for `code-quality-analyzer`, `test-coverage-analyzer`, and `refactoring-suggester`.
 
 