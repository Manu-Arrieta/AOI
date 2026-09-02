#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/link-resources.mjs
 *
 * Automated Resource Linker for SDD tasks.
 * Resolves, validates, and links User Stories (.resources/userstories/) and
 * Workflows (.resources/workflows/) into .tasks/{feature}/{taskId}/relations.json.
 * Enforces zero-fabrication and strict file existence invariants.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Collects relative paths of markdown/json resource files in a subtree.
 */
export function collectResourceFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let results = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results = results.concat(collectResourceFiles(fullPath))
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.json') || entry.name.endsWith('.yaml'))) {
      results.push(fullPath)
    }
  }

  return results
}

/**
 * Searches for resource files matching a keyword, filename, or tag.
 */
export function findMatchingResources(resourcesRoot, query = '') {
  const userstoriesDir = path.join(resourcesRoot, 'userstories')
  const workflowsDir = path.join(resourcesRoot, 'workflows')

  const userstoryFiles = collectResourceFiles(userstoriesDir)
  const workflowFiles = collectResourceFiles(workflowsDir)

  const normalizedQuery = query.toLowerCase().trim()

  const filterFn = (filePath) => {
    if (!normalizedQuery) return true
    const filename = path.basename(filePath).toLowerCase()
    if (filename.includes(normalizedQuery)) return true

    try {
      const content = fs.readFileSync(filePath, 'utf8').toLowerCase()
      return content.includes(normalizedQuery)
    } catch {
      return false
    }
  }

  return {
    userstories: userstoryFiles
      .filter(filterFn)
      .map((p) => path.relative(resourcesRoot, p).replace(/\\/g, '/')),
    workflows: workflowFiles
      .filter(filterFn)
      .map((p) => path.relative(resourcesRoot, p).replace(/\\/g, '/')),
  }
}

/**
 * Creates or updates .tasks/{feature}/{taskId}/relations.json.
 */
export function updateTaskRelations(taskDir, { userstories = [], workflows = [], resourcesRoot = '.resources' } = {}) {
  if (!fs.existsSync(taskDir)) {
    throw new Error(`Task directory does not exist: ${taskDir}`)
  }

  const relationsPath = path.join(taskDir, 'relations.json')
  let existing = { userstories: [], workflows: [] }

  if (fs.existsSync(relationsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(relationsPath, 'utf8'))
    } catch {
      existing = { userstories: [], workflows: [] }
    }
  }

  const normalizeRelPath = (relPath, expectedPrefix) => {
    const clean = relPath.replace(/^(\.resources\/|\/)/, '').replace(/\\/g, '/')
    const targetFile = path.join(resourcesRoot, clean)
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Linked resource file does not exist: ${targetFile}`)
    }
    if (expectedPrefix && !clean.startsWith(expectedPrefix)) {
      throw new Error(`Resource "${clean}" does not belong to ${expectedPrefix}/`)
    }
    return `.resources/${clean}`
  }

  const validatedStories = userstories.map((s) => normalizeRelPath(s, 'userstories'))
  const validatedWorkflows = workflows.map((w) => normalizeRelPath(w, 'workflows'))

  const mergedStories = Array.from(new Set([...(existing.userstories || []), ...validatedStories]))
  const mergedWorkflows = Array.from(new Set([...(existing.workflows || []), ...validatedWorkflows]))

  const updatedRelations = {
    userstories: mergedStories,
    workflows: mergedWorkflows,
  }

  fs.writeFileSync(relationsPath, JSON.stringify(updatedRelations, null, 2) + '\n', 'utf8')

  return {
    relationsPath,
    relations: updatedRelations,
  }
}

// CLI Interface
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2)
  let taskDir = ''
  let autoMatch = ''
  let storyInput = []
  let workflowInput = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-dir' && args[i + 1]) taskDir = args[++i]
    else if (args[i] === '--auto-match' && args[i + 1]) autoMatch = args[++i]
    else if (args[i] === '--story' && args[i + 1]) storyInput.push(args[++i])
    else if (args[i] === '--workflow' && args[i + 1]) workflowInput.push(args[++i])
  }

  if (!taskDir) {
    console.error('Usage: node link-resources.mjs --task-dir <path> [--story <file>] [--workflow <file>] [--auto-match <query>]')
    process.exit(1)
  }

  try {
    let stories = [...storyInput]
    let workflows = [...workflowInput]

    if (autoMatch) {
      const matches = findMatchingResources('.resources', autoMatch)
      stories.push(...matches.userstories)
      workflows.push(...matches.workflows)
    }

    const result = updateTaskRelations(taskDir, { userstories: stories, workflows })
    console.log(`✅ Updated ${result.relationsPath}:`)
    console.log(`   - User Stories: ${result.relations.userstories.length}`)
    console.log(`   - Workflows: ${result.relations.workflows.length}`)
    process.exit(0)
  } catch (error) {
    console.error(`❌ Error linking resources: ${error.message}`)
    process.exit(1)
  }
}
