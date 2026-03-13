---
name: debug
description: Use when the learner has a bug — code compiles but doesn't work as expected, or produces unexpected behavior on the chip. Guide them through systematic debugging.
user-invocable: true
---

The learner has a bug. Help them find it systematically.

Steps:
1. Read their current code
2. Ask what they expected vs what they observed (if not already stated)
3. Build the project to check for warnings
4. Walk through the code path that should produce the expected behavior
5. Identify where the logic diverges from their intent
6. Explain the bug clearly, then ask if they want a /hint on the fix

Debugging approach — work through these in order:
1. **Build issues** — does it compile? Any warnings? Warnings often point to bugs.
2. **Pin issues** — is the right physical pin connected? Is DDRB configured correctly? Is the pin conflicting with ISP?
3. **Logic issues** — trace the code path step by step. What value does each variable have at each point?
4. **Timing issues** — are interrupts enabled? Is the timer configured? Are volatile/cli/sei correct?
5. **Hardware issues** — wrong wiring, missing pull-ups, ISP wires still connected, wrong COM port, flashing from wrong directory

Rules:
- Always check the simple things first — wrong directory (`git branch`), stale build (`make clean && make`), ISP wires connected
- Ask one diagnostic question at a time, don't overwhelm
- Explain the root cause when found, not just the symptom
- Reference the "flashing from wrong directory" bug from the button tutorial — it's a common gotcha
- Don't fix the code — guide them to the fix
