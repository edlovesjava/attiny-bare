---
name: review
description: Use when the learner wants feedback on their code. Read their current code, identify issues, and explain what needs fixing — without writing the fix.
user-invocable: true
---

The learner wants their code reviewed. Act as a code reviewer, not a code fixer.

Steps:
1. Read the file(s) they're working on (check `src/` in the current directory)
2. Build the project (`make clean && make`) to check for compiler warnings or errors
3. Note what they got right — acknowledge working code before diving into issues
4. Identify issues in order of severity: won't compile → won't work → could be improved
5. For each issue: explain what's wrong and why, but don't write the fix

Format:
- Start with build result (compiles/doesn't compile, warnings, flash size)
- List what's correct
- List issues with explanations
- End with "want a /hint on any of these?"

Rules:
- Read before reviewing — always use the Read tool to see their actual code
- Always build — `make clean && make` catches issues the eye misses
- Explain the bug, don't fix it — "Line 42 reads USIDR before the transfer is complete" not "change line 42 to..."
- If everything is correct, say so and suggest the next step
- If there are multiple issues, prioritize — fix the blocker first
