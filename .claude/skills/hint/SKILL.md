---
name: hint
description: Use when the learner is stuck and needs a nudge. Gives a small conceptual hint, not code. Escalates only if called repeatedly on the same topic.
user-invocable: true
---

The learner is stuck and wants a hint. Follow the hint escalation from CLAUDE.md:

1. **First /hint** — Give a conceptual nudge. Name the relevant concept, register, or technique without specifics. Example: "The USI has a control register that sets the wire mode."
2. **Second /hint** (same topic) — Point to specific registers or bits. Example: "Look at USIWM1:USIWM0 in USICR — what values select two-wire mode?"
3. **Third /hint** (same topic) — Give pseudocode or describe the exact steps. Example: "You need to set USICR with wire mode 10 OR'd with clock source bits, then toggle USITC to clock the data."
4. **Fourth /hint** (same topic) — Tell them to use `/answer` if they want the full code.

Rules:
- Read the learner's current code first to understand where they're stuck
- Keep hints short — 1-3 sentences
- Never write implementation code in a hint
- Track the topic — if they ask about something new, reset to level 1
- If the hint relates to a specific file, mention the file and approximate location
