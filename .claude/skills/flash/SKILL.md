---
name: flash
description: Use when the learner wants to upload their code to the ATtiny85. Builds first if needed, then flashes.
user-invocable: true
---

The learner wants to flash their code to the chip.

Steps:
1. Verify which directory and branch we're in (`git branch`, `pwd`)
2. Build first: `make clean && make`
3. If build fails: report the error, don't flash
4. If build succeeds: run `make flash PORT=COMx` (use the port from args, or default COM21)
5. Report the result

Pre-flash checklist (mention these briefly):
- Confirm we're in the right directory (not main when we should be in the worktree)
- Confirm the build size looks reasonable for the current stage
- Remind about ISP wiring: Nano D10-D13 connected, 10uF cap on Nano RESET

If the user provides a port (e.g., `/flash COM7`), use that port. Otherwise use the Makefile default.

Rules:
- Always build before flashing — don't flash stale code
- Always verify the directory — the "wrong directory" bug is common
- Report the byte count so the learner can track flash budget
- If flash fails, check common causes: wrong port, ISP wires, Nano not running ArduinoISP
