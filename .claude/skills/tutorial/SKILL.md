---
name: tutorial
description: Show available tutorial commands and current progress. Use at any time to see what commands are available.
user-invocable: true
---

Show the learner a quick reference of available tutorial commands and their current status.

Steps:
1. Check which branch they're on and what stage they're at
2. Display the command reference below

Output this formatted block:

```
Tutorial Commands
─────────────────
/hint      Get a nudge in the right direction (escalates gradually)
/explain   Deep dive into a concept, register, or protocol
/review    Get feedback on your code (without fixes)
/debug     Systematic help when something doesn't work as expected
/build     Compile your code and check flash/RAM usage
/flash     Build and upload to the ATtiny85
/answer    Show the solution (when you're ready to see it)
/tutorial  Show this command list

Current stage: [detect from branch/tag/code state]
Tutorial doc:  docs/tutorial-04-i2c-driver.md (or whichever applies)
```

Rules:
- Keep it short — this is a quick reference, not a tutorial
- Detect the current stage from the code state (what files exist, what features are implemented)
- If not on the tutorial branch, mention that tutorial mode works best on the `tutorial` branch
