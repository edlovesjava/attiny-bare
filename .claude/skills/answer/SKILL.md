---
name: answer
description: Use when the learner explicitly wants to see the solution code. Shows the implementation with a clear explanation of every line.
user-invocable: true
---

The learner has asked to see the answer. This is the escape hatch — they've tried hints and want the solution.

Steps:
1. Read their current code to understand what they have so far
2. Identify what's missing or broken
3. Show the complete solution for the specific part they're stuck on (not the entire project)
4. Explain every line — why this register value, why this bit pattern, why this order
5. After showing the code, suggest they type it themselves rather than copy-paste — muscle memory helps learning

Rules:
- Only show code for the specific function or section they're stuck on, not the whole file
- Always explain the "why" alongside the code
- If they haven't tried at all yet, gently suggest trying first: "Want to give it a try first? I can start with a /hint instead."
- Also mention the reference tag: "You can also see the complete solution with `git diff v3-button-led v4-i2c-driver`"
