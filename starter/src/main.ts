import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { formatError } from './utils/error-handler.js';
import { ReportGenerator } from './utils/report-generator.js';

dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev -- <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prNumberStr] = process.argv.slice(2);

  if (!owner || !repo || !prNumberStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- udacity cd14715-simple-todo-app 1');
    process.exit(1);
  }

  const prNumber = parseInt(prNumberStr, 10);
  if (Number.isNaN(prNumber) || prNumber <= 0) {
    console.error(`PR number must be a positive integer. Received: ${prNumberStr}`);
    process.exit(1);
  }

  const hasAnthropicAPI = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const hasAwsRegion = Boolean(process.env.AWS_REGION);

  if (!hasAnthropicAPI && !hasAwsKeys) {
    console.error('Authentication required. Set one of:');
    console.error('  - ANTHROPIC_API_KEY for the Anthropic API, or');
    console.error('  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION for Amazon Bedrock');
    process.exit(1);
  }

  if (!hasAnthropicAPI && hasAwsKeys && !hasAwsRegion) {
    console.error('AWS_REGION is required when using Amazon Bedrock.');
    console.error('Example: AWS_REGION=us-east-1');
    process.exit(1);
  }

  if (hasAnthropicAPI) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.log('🔐 Using AWS Bedrock authentication');
  }

  if (!process.env.ANTHROPIC_MODEL) {
    console.error('ANTHROPIC_MODEL is required for both authentication methods.');
    console.error('  Anthropic API: claude-sonnet-4-5-20250929');
    console.error('  AWS Bedrock:   us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);
    const reportPaths = await writeReports(owner, repo, prNumber, report);

    console.log(`Review complete for ${owner}/${repo}#${prNumber}. Overall score: ${report.summary.overallScore}/100`);
    for (const reportPath of reportPaths) {
      console.log(`Saved ${reportPath}`);
    }
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

async function writeReports(
  owner: string,
  repo: string,
  prNumber: number,
  report: Awaited<ReturnType<CodeReviewOrchestrator['reviewPullRequest']>>
): Promise<string[]> {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });

  const baseName = `${owner}_${repo}_${prNumber}`;
  const generator = new ReportGenerator();
  const files = [
    { suffix: 'json', contents: generator.generateJSONReport(report) },
    { suffix: 'md', contents: generator.generateMarkdownReport(report) },
    { suffix: 'html', contents: generator.generateHTMLReport(report) }
  ];

  const written: string[] = [];
  for (const file of files) {
    const filePath = path.join(reportsDir, `${baseName}.${file.suffix}`);
    await writeFile(filePath, file.contents, 'utf8');
    written.push(filePath);
  }
  return written;
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exit(1);
});
