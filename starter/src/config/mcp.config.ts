/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP Servers:
 * 1. GitHub - For PR/repo operations
 * 2. ESLint - For code linting and style analysis
 *
 * Documentation:
 * - MCP Protocol: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 *
 * Authentication is read from the environment. No API keys are hardcoded.
 * The GitHub server expects GITHUB_PERSONAL_ACCESS_TOKEN, so GITHUB_TOKEN
 * from .env is mapped to that name at runtime.
 */

import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

export const mcpServersConfig = {
  /**
   * GitHub MCP Server
   * Provides tools for GitHub API operations (pull requests, files, reviews).
   * Package: @modelcontextprotocol/server-github
   * Transport: stdio, launched with npx so the package does not need a local install.
   */
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
    }
  },

  /**
   * ESLint MCP Server
   * Provides tools for linting and code quality analysis.
   * Package: @eslint/mcp
   * No authentication is required.
   */
  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
} satisfies Record<string, McpServerConfig>;
