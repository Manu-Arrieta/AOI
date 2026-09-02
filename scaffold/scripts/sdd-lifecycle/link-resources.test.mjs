import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  findMatchingResources,
  updateTaskRelations,
} from './link-resources.mjs'

describe('link-resources unit tests', () => {
  it('findMatchingResources searches resources by keyword', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-res-test-'))
    const storiesDir = path.join(tmpDir, 'userstories')
    const workflowsDir = path.join(tmpDir, 'workflows')
    fs.mkdirSync(storiesDir, { recursive: true })
    fs.mkdirSync(workflowsDir, { recursive: true })

    fs.writeFileSync(path.join(storiesDir, 'auth-flow.md'), '# Authentication User Story\nAs a user I want to log in')
    fs.writeFileSync(path.join(workflowsDir, 'oauth.md'), '# OAuth 2.0 Workflow\nSequence diagram')

    const matches = findMatchingResources(tmpDir, 'auth')
    assert.equal(matches.userstories.length, 1)
    assert.ok(matches.userstories[0].includes('auth-flow.md'))

    const wfMatches = findMatchingResources(tmpDir, 'oauth')
    assert.equal(wfMatches.workflows.length, 1)
    assert.ok(wfMatches.workflows[0].includes('oauth.md'))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('updateTaskRelations creates relations.json with valid paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-task-test-'))
    const resDir = path.join(tmpDir, '.resources')
    const storiesDir = path.join(resDir, 'userstories')
    const workflowsDir = path.join(resDir, 'workflows')
    fs.mkdirSync(storiesDir, { recursive: true })
    fs.mkdirSync(workflowsDir, { recursive: true })

    fs.writeFileSync(path.join(storiesDir, 'US-001.md'), '# Story 1')
    fs.writeFileSync(path.join(workflowsDir, 'WF-001.md'), '# Workflow 1')

    const taskDir = path.join(tmpDir, '.tasks', 'auth', 'TASK-2026-001')
    fs.mkdirSync(taskDir, { recursive: true })

    const result = updateTaskRelations(taskDir, {
      userstories: ['userstories/US-001.md'],
      workflows: ['workflows/WF-001.md'],
      resourcesRoot: resDir,
    })

    assert.equal(result.relations.userstories.length, 1)
    assert.equal(result.relations.workflows.length, 1)
    assert.equal(result.relations.userstories[0], '.resources/userstories/US-001.md')

    // Throws on nonexistent resource
    assert.throws(() => {
      updateTaskRelations(taskDir, {
        userstories: ['userstories/nonexistent.md'],
        resourcesRoot: resDir,
      })
    })

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
