# Using Claude Code with This Project

[Claude Code](https://claude.ai/code) is Anthropic's command-line AI assistant for software engineering. It can read your files, edit code, run builds, and explain what's happening — making it a powerful companion for learning bare-metal embedded development.

This guide covers how to get started and how to get the most out of it with this project.

## Installing Claude Code

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A terminal (Git Bash, MSYS2, or Windows Terminal on Windows)

### Install

```bash
npm install -g @anthropic-ai/claude-code
```

### Authenticate

```bash
claude
```

The first time you run it, Claude Code will prompt you to sign in with your Anthropic account. You'll need an active plan or API credits.

### Verify

Once authenticated, you should see an interactive prompt. Type a question or command to confirm it's working, then `Ctrl+C` to exit.

## Getting Started in This Project

### Initialize the Project Context

From the project root, run:

```bash
cd /path/to/attiny-bare
claude
```

Claude Code reads the `CLAUDE.md` file automatically, which gives it context about the toolchain, build commands, hardware configuration, and project conventions. This means it already knows this is an ATtiny85 project using avr-gcc and a Makefile — you don't have to explain the setup every time.

If you're starting a new project and want to generate a `CLAUDE.md`, use:

```bash
/init
```

This analyzes the codebase and creates a context file for future sessions.

## How to Get the Most Out of Claude Code

### Use an Explanatory Style

This is a learning project. Tell Claude Code you want explanations, not just answers. The difference is significant:

**Less useful:**
> "Add a button debounce to PB4"

**More useful:**
> "I want to add button input on PB4 with debouncing. Walk me through how debouncing works on an AVR, what registers I need to configure, and explain the ISR changes as you make them."

When you ask for explanations, Claude Code will teach you what the code does and why — turning every task into a learning opportunity.

### Ask Specific Questions

Claude Code can read the datasheet-level details you'd otherwise spend hours hunting for. Take advantage of that:

- "Why does the timer prescaler need to be 64 and not 8?"
- "What happens if I set RSTDISBL in HFUSE?"
- "Explain the difference between TIMSK on ATtiny85 and TIMSK0 on ATmega328P"
- "Walk me through the disassembly of the ISR — what does each instruction do?"
- "Why do I need `cli()` before reading `wait_time_ms`?"

Specific questions get precise, useful answers. Vague questions get generic responses.

### Ask for Code Reviews

Before committing changes, ask Claude Code to review your work:

- "Review main.c for correctness — especially the ISR and shared variable access"
- "Check if my timer calculation is right for a 500ms interval"
- "Look at the Makefile changes I made and tell me if anything is wrong"
- "Am I handling the volatile variable correctly in the main loop?"

Claude Code will read the files, spot issues like missing `volatile` qualifiers or unsafe multi-byte reads, and explain why they matter.

### Use Plan Mode for Bigger Changes

For multi-step tasks, start with plan mode to think through the approach before writing code:

```
/plan Add PWM-controlled LED brightness using Timer0
```

Plan mode lets Claude Code outline the steps, register changes, and code structure before touching any files. You can review the plan, ask questions, and refine it before proceeding to implementation. This prevents wasted effort on approaches that won't work.

Good candidates for plan mode:
- Adding a new peripheral (buttons, display, ADC)
- Refactoring the timer system for multiple tasks
- Porting the project to a different AVR chip
- Adding a new build target to the Makefile

### Let It Run the Build

Claude Code can execute shell commands. Let it build and check your code:

- "Build the project and show me the size output"
- "Compare the disassembly before and after this change"
- "Build with `-O0` and compare flash usage to `-Os`"
- "Run `make readfuses` and check if the values are correct"

This is especially useful for catching issues early — if a change breaks the build, Claude Code sees the error immediately and can fix it.

### Iterate on Understanding

Don't stop at the first answer. Embedded development has layers, and Claude Code can go as deep as you want:

1. "How does CTC mode work?" — get the concept
2. "Show me which registers control it" — see the hardware
3. "Walk through the timer init code line by line" — connect concept to code
4. "What does the disassembly look like for `OCR0A = 124`?" — see the machine code
5. "What would change if I wanted a 10ms tick instead?" — apply the knowledge

Each follow-up builds on the last. This is how you move from copying code to truly understanding it.

## Common Workflows

### Learning a New Concept

```
"Explain how AVR pin change interrupts work, then help me add
one on PB4 for a button. Explain each register you configure."
```

### Debugging

```
"The LED isn't blinking. Here's my code — walk me through what
might be wrong, starting with the timer configuration."
```

### Extending the Project

```
/plan Add a second LED on PB4 that blinks at a different rate,
using the existing timer interrupt system.
```

### Understanding Existing Code

```
"Read src/main.c and explain the program flow from power-on
to the first LED toggle. Include what the startup code does
before main() runs."
```

### Comparing Approaches

```
"Show me three ways to toggle an LED on AVR — direct port
manipulation, XOR toggle, and inline assembly. Explain the
trade-offs and show the disassembly for each."
```
