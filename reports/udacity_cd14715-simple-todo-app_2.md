# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 25/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 9 |
| **Refactoring Opportunities** | 6 |

## 🎯 Top Recommendations

1. 🚨 **security**: Fix SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser by replacing string concatenation with parameterized queries. These functions allow attackers to execute arbitrary SQL commands and compromise the entire database.
   - Files: src/todo.ts

2. 🚨 **testing**: Add security tests for the three vulnerable SQL injection functions to demonstrate the vulnerability and verify the fix. Include tests with malicious inputs like "'; DROP TABLE todos; --" and "' OR '1'='1".
   - Files: src/todo.ts

3. ⚠️ **testing**: Implement comprehensive unit tests for all functions, especially security-critical validation and sanitization logic. Currently at 0% test coverage for a file handling user data.
   - Files: src/todo.ts

4. ⚠️ **maintainability**: Refactor database operations into a repository pattern to reduce code duplication and centralize query management. This will make it easier to maintain and audit SQL queries for security issues.
   - Files: src/todo.ts

5. 📝 **security**: Replace weak ID generation (Date.now() + Math.random()) with cryptographically secure UUIDs using crypto.randomUUID() to prevent ID prediction and collision attacks.
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 25/100 | **Coverage:** ~0%

#### Issues (10)
  - Line 119: `critical` SQL injection vulnerability through direct string interpolation. The keyword parameter is concatenated directly into the SQL query without parameterization, allowing an attacker to inject arbitrary SQL commands (e.g., keyword = "'; DROP TABLE todos; --").
  - Line 129: `critical` SQL injection vulnerability through string concatenation. The completed parameter is concatenated directly without validation or parameterization, allowing SQL injection attacks. Additionally, no type validation ensures completed is actually a boolean.
  - Line 139: `critical` SQL injection vulnerability in template literal. The userId parameter is embedded directly in the query without sanitization or parameterization, allowing attackers to inject SQL (e.g., userId = "1' OR '1'='1").

  *...and 7 more*

#### Test Gaps (16)
  - `validateTodoInput() with empty title` (high priority)
  - `validateTodoInput() with title exceeding 200 characters` (high priority)

  *...and 14 more*

#### Refactoring Opportunities (6)
  - **extract-function**: Input validation and sanitization logic is interleaved with todo object construction and database insertion in createTodo.
  - **simplify**: Multiple early-return guards can be combined with guard clauses for better readability.

  *...and 4 more*

---

*Generated at 2026-10-15T21:20:40.965Z • Duration: 462207ms*
