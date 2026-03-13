---
name: explain
description: Use when the learner wants a deep explanation of a concept, register, protocol, or piece of code. Teach with diagrams and examples.
user-invocable: true
---

The learner wants to understand something. Give a thorough, visual explanation.

Steps:
1. If they specified a topic (e.g., `/explain USICR`), explain that topic
2. If no topic specified, look at what they're currently working on and explain the most relevant concept
3. Use the same style as the existing tutorials — bit diagrams, register layouts, truth tables, signal traces, step-by-step traces through binary values
4. Connect the concept to the actual code in the project when possible
5. End with a "try it" suggestion — something they can do to see the concept in action

Rules:
- Go deep — this is a learning request, not a quick answer
- Use visual representations (ASCII diagrams, bit layouts, tables)
- Reference the ATtiny85 datasheet section when relevant (e.g., "See datasheet section 15.3.2 for the full USI register description")
- Don't write their solution code — explain the concept so they can write it themselves
- Keep it focused on one concept at a time
