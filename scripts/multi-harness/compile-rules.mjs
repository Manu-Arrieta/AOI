#!/usr/bin/env node
/**
 * scripts/multi-harness/compile-rules.mjs
 *
 * AOI Multi-Harness Instruction & Rules Compiler.
 * Compiles canonical governance and ICM Protocol v4 rules from .github/instructions/
 * into native configuration files for GitHub Copilot, Claude Code, Cursor,
 * Antigravity / Gemini, and Cline / Roo Code.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const SUPPORTED_HARNESSES = ['copilot', 'claude', 'cursor', 'antigravity', 'cline', 'all']

export function generateClaudeMd({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / CLAUDE.md — Auto-compiled by aoi:sync-rules -->
# ${workspace} — Agentic Operational Infrastructure (AOI)

## Persistent Memory (ICM v0.10+ Protocol v4) — MANDATORY

This project operates with **Infinite Context Memory (ICM)**. You MUST use it actively.

### Recall (Before Starting Any Task)
\`\`\`bash
icm wake-up                              # Instant deterministic facts pack
icm recall "query"                        # Search episodic memories
icm recall "query" -t "${workspace}-context"        # Filter by project topic
icm facts list "${workspace}"             # O(1) exact project facts
\`\`\`

### Store Triggers (MANDATORY)
1. **Error resolved** → \`icm store -t errors-resolved -c "description" -i high -k "keyword1,keyword2"\`
2. **Architecture / Design decision** → \`icm store -t decisions-${workspace} -c "description" -i high\`
3. **User preference discovered** → \`icm store -t preferences -c "description" -i critical\`
4. **Task completed** → \`icm store -t context-${workspace} -c "summary" -i high\`
5. **Exact configuration / endpoint / service** → \`icm facts set "${workspace}" "key" "value"\`

### Workspace Health Diagnostic (0 Tokens)
\`\`\`bash
pnpm aoi:doctor                          # 360° Repository health check
\`\`\`

### SDD Workflow Commands
- \`/init\` — Bootstrap project, ICM facts, and base project map
- \`/sdd-new\` — Explore domain, discover services, and author proposal
- \`/sdd-apply\` — Implement planned tasks with TDD & Fiber sandboxes
- \`/sdd-verify\` — Verify implementation, test gates, and SRP limits (<300 LOC)
- \`/sdd-archive\` — Close task, distill patterns, and refresh fast briefings
`
}

export function generateCursorRules({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / .cursorrules — Auto-compiled by aoi:sync-rules -->
# AOI Cursor Rule Set for ${workspace}

- Always recall ICM memory via \`icm wake-up\` or \`icm recall "query"\` at session start.
- Persist architecture decisions and facts via \`icm store\` and \`icm facts set "${workspace}" "key" "value"\`.
- Keep all source code files modular: enforce Single Responsibility Principle (< 300 LOC per file).
- Run mechanical verification and health checks via \`pnpm aoi:doctor\` before finalizing changes.
`
}

export function generateAntigravityRules({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / .agents/rules/aoi-rules.md — Auto-compiled by aoi:sync-rules -->
# AOI Antigravity Governance Rules (${workspace})

## ICM Persistent Memory Substrate (5 Methods)
1. **Memories**: Episodic task context (\`icm store\`, \`icm recall\`).
2. **Memoirs**: Architectural concepts and dependencies (\`icm memoir\`).
3. **Facts**: O(1) deterministic exact configuration keys (\`icm facts set/list\`).
4. **Feedback**: Prediction vs outcome learning records (\`icm feedback\`).
5. **Transcripts**: Session logs and trajectories (\`icm transcript\`).

## Governance & Quality Gates
- Execute \`pnpm aoi:doctor\` to audit repository integrity in 0 tokens.
- Follow Spec-Driven Development (SDD) lifecycle phases.
`
}

export function generateClineRules({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / .clinerules — Auto-compiled by aoi:sync-rules -->
# AOI Cline / Roo Code Operational Rules for ${workspace}

- Execute \`icm wake-up\` at session start to load critical facts and briefings.
- Record resolved errors and task closures in ICM.
- Validate health using \`pnpm aoi:doctor\`.
- Enforce strict TDD and single responsibility (<300 LOC per file).
`
}

export function generateCopilotInstructions({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / .github/copilot-instructions.md — Auto-compiled by aoi:sync-rules -->
<!-- icm:start -->
## Persistent memory (ICM) — MANDATORY

This project uses [ICM](https://github.com/rtk-ai/icm) for persistent memory across sessions.
You MUST use it actively. Not optional.

### Recall (before starting work)
\`\`\`bash
icm recall "query"                        # search memories
icm recall "query" -t "topic-name"        # filter by topic
icm recall-context "query" --limit 5      # formatted for prompt injection
\`\`\`

### Store — MANDATORY triggers
You MUST call \`icm store\` when ANY of the following happens:
1. **Error resolved** → \`icm store -t errors-resolved -c "description" -i high -k "keyword1,keyword2"\`
2. **Architecture/design decision** → \`icm store -t decisions-{project} -c "description" -i high\`
3. **User preference discovered** → \`icm store -t preferences -c "description" -i critical\`
4. **Significant task completed** → \`icm store -t context-{project} -c "summary of work done" -i high\`
5. **Conversation exceeds ~20 tool calls without a store** → store a progress summary

Do this BEFORE responding to the user. Not after. Not later. Immediately.

Do NOT store: trivial details, info already in CLAUDE.md, ephemeral state (build logs, git status).

### Other commands
\`\`\`bash
icm facts set "{project}" "key" "value"  # deterministic exact fact (O(1))
icm wake-up                              # instant critical facts pack
icm update <id> -c "updated content"     # edit memory in-place
icm health                                # topic hygiene audit
icm topics                                # list all topics
\`\`\`
<!-- icm:end -->
`
}

/**
 * Compiles and writes harness configuration files.
 */
export function compileHarnessRules(repoRoot, harnesses = ['all'], workspace = 'AOI') {
  const targetAll = harnesses.includes('all')
  const shouldCompile = (h) => targetAll || harnesses.includes(h)
  const compiledFiles = []

  // 1. Claude Code
  if (shouldCompile('claude')) {
    const claudePath = path.join(repoRoot, 'CLAUDE.md')
    fs.writeFileSync(claudePath, generateClaudeMd({ workspace }), 'utf8')
    compiledFiles.push(claudePath)
  }

  // 2. Cursor
  if (shouldCompile('cursor')) {
    const cursorRulesPath = path.join(repoRoot, '.cursorrules')
    const cursorRulesDir = path.join(repoRoot, '.cursor', 'rules')
    fs.mkdirSync(cursorRulesDir, { recursive: true })
    const cursorMdcPath = path.join(cursorRulesDir, 'aoi-rules.mdc')

    const content = generateCursorRules({ workspace })
    fs.writeFileSync(cursorRulesPath, content, 'utf8')
    fs.writeFileSync(cursorMdcPath, content, 'utf8')
    compiledFiles.push(cursorRulesPath, cursorMdcPath)
  }

  // 3. Antigravity / Gemini
  if (shouldCompile('antigravity')) {
    const agentsDir = path.join(repoRoot, '.agents', 'rules')
    fs.mkdirSync(agentsDir, { recursive: true })
    const antigravityPath = path.join(agentsDir, 'aoi-rules.md')
    const agentsMdPath = path.join(repoRoot, 'AGENTS.md')

    const content = generateAntigravityRules({ workspace })
    fs.writeFileSync(antigravityPath, content, 'utf8')
    fs.writeFileSync(agentsMdPath, content, 'utf8')
    compiledFiles.push(antigravityPath, agentsMdPath)
  }

  // 4. Cline / Roo Code
  if (shouldCompile('cline')) {
    const clinePath = path.join(repoRoot, '.clinerules')
    fs.writeFileSync(clinePath, generateClineRules({ workspace }), 'utf8')
    compiledFiles.push(clinePath)
  }

  // 5. GitHub Copilot
  if (shouldCompile('copilot')) {
    const copilotDir = path.join(repoRoot, '.github')
    fs.mkdirSync(copilotDir, { recursive: true })
    const copilotPath = path.join(copilotDir, 'copilot-instructions.md')
    fs.writeFileSync(copilotPath, generateCopilotInstructions({ workspace }), 'utf8')
    compiledFiles.push(copilotPath)
  }

  return {
    success: true,
    harnesses: targetAll ? SUPPORTED_HARNESSES.filter((h) => h !== 'all') : harnesses,
    compiledFiles,
  }
}

// Direct CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2)
  let harnessArg = 'all'
  let workspaceArg = 'AOI'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--harness' && args[i + 1]) harnessArg = args[++i]
    else if (args[i] === '--workspace' && args[i + 1]) workspaceArg = args[++i]
  }

  const harnesses = harnessArg.split(',').map((h) => h.trim().toLowerCase())
  const repoRoot = process.cwd()

  console.log(`\n⚙️  Compiling AOI Multi-Harness Rules (harness: ${harnessArg}, workspace: ${workspaceArg})...\n`)
  const result = compileHarnessRules(repoRoot, harnesses, workspaceArg)

  for (const file of result.compiledFiles) {
    console.log(`  ✓ Generated: ${path.relative(repoRoot, file)}`)
  }

  console.log(`\n✨ Compiled ${result.compiledFiles.length} harness configuration file(s) successfully.\n`)
}
