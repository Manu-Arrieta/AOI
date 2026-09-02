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

### SDD Workflow Commands (Read from .github/prompts/<command>.prompt.md)
- \`/init\` — Bootstrap project, ICM facts, and base project map (\`.github/prompts/init.prompt.md\`)
- \`/sdd-new\` — Explore domain, discover services, and author proposal (\`.github/prompts/sdd-new.prompt.md\`)
- \`/sdd-apply\` — Implement planned tasks with TDD & Fiber sandboxes (\`.github/prompts/sdd-apply.prompt.md\`)
- \`/sdd-verify\` — Verify implementation, test gates, and SRP limits (<300 LOC) (\`.github/prompts/sdd-verify.prompt.md\`)
- \`/sdd-archive\` — Close task, distill patterns, and refresh fast briefings (\`.github/prompts/sdd-archive.prompt.md\`)
`
}

export function generateCursorRules({ workspace = 'AOI' } = {}) {
  return `<!-- AOI / .cursorrules — Auto-compiled by aoi:sync-rules -->
# AOI Cursor Rule Set for ${workspace}

- Always recall ICM memory via \`icm wake-up\` or \`icm recall "query"\` at session start.
- Persist architecture decisions and facts via \`icm store\` and \`icm facts set "${workspace}" "key" "value"\`.
- Keep all source code files modular: enforce Single Responsibility Principle (< 300 LOC per file).
- Run mechanical verification and health checks via \`pnpm aoi:doctor\` before finalizing changes.
- Read SDD workflow instructions from \`.github/prompts/<command>.prompt.md\`.
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
- Headroom is an optional orthogonal compression layer; its absence produces warnings but never blocks execution.
- SDD workflow prompts are defined in \`.github/prompts/<command>.prompt.md\` (e.g. \`init.prompt.md\`, \`sdd-new.prompt.md\`, \`sdd-apply.prompt.md\`, \`sdd-verify.prompt.md\`, \`sdd-archive.prompt.md\`).
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
  const hasScaffold = fs.existsSync(path.join(repoRoot, 'scaffold'))

  const writeTargetFile = (relPath, content) => {
    const fullPath = path.join(repoRoot, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf8')
    compiledFiles.push(fullPath)

    if (hasScaffold) {
      const scaffoldPath = path.join(repoRoot, 'scaffold', relPath)
      fs.mkdirSync(path.dirname(scaffoldPath), { recursive: true })
      fs.writeFileSync(scaffoldPath, content, 'utf8')
    }
  }

  // 1. Claude Code
  if (shouldCompile('claude')) {
    writeTargetFile('CLAUDE.md', generateClaudeMd({ workspace }))
  }

  // 2. Cursor
  if (shouldCompile('cursor')) {
    const content = generateCursorRules({ workspace })
    writeTargetFile('.cursorrules', content)
    writeTargetFile('.cursor/rules/aoi-rules.mdc', content)
  }

  // 3. Antigravity / Gemini
  if (shouldCompile('antigravity')) {
    const content = generateAntigravityRules({ workspace })
    writeTargetFile('.agents/rules/aoi-rules.md', content)
    writeTargetFile('AGENTS.md', content)

    // Sync canonical skills from .github/skills/ into .agents/skills/
    const githubSkillsDir = path.join(repoRoot, '.github', 'skills')
    if (fs.existsSync(githubSkillsDir)) {
      const skills = fs.readdirSync(githubSkillsDir, { withFileTypes: true })
      for (const s of skills) {
        if (s.isDirectory()) {
          const skillFilePath = path.join(githubSkillsDir, s.name, 'SKILL.md')
          if (fs.existsSync(skillFilePath)) {
            const skillContent = fs.readFileSync(skillFilePath, 'utf8')
            writeTargetFile(path.join('.agents', 'skills', s.name, 'SKILL.md'), skillContent)
          }
        }
      }
    }
  }

  // 4. Cline / Roo Code
  if (shouldCompile('cline')) {
    writeTargetFile('.clinerules', generateClineRules({ workspace }))
  }

  // 5. GitHub Copilot
  if (shouldCompile('copilot')) {
    writeTargetFile('.github/copilot-instructions.md', generateCopilotInstructions({ workspace }))
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
