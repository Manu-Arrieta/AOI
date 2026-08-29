/**
 * scripts/subagent-context/subagent-fiber-runner.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSubagentSandbox } from './subagent-fiber-runner.mjs';

describe('Subagent Fiber Runner: Revertible Sandboxes', () => {
  const testTaskDir = path.resolve(process.cwd(), '.tasks/test-feature/TASK-2026-999');
  const tempTestFile = path.resolve(process.cwd(), '.tasks/test-feature/TASK-2026-999/test-output.txt');

  before(() => {
    fs.mkdirSync(testTaskDir, { recursive: true });
    fs.writeFileSync(path.join(testTaskDir, 'tasks.md'), '### Task T-1: Test backend [backend]\n- Build mock\n');
    fs.writeFileSync(path.join(testTaskDir, 'design.md'), 'export interface Test { id: string }\n');
  });

  after(() => {
    if (fs.existsSync(testTaskDir)) {
      fs.rmSync(path.resolve(process.cwd(), '.tasks/test-feature'), { recursive: true, force: true });
    }
  });

  it('instantiates subagent with TOON payload and tracks file writes with instant rollback', () => {
    const sandbox = createSubagentSandbox({
      role: 'backend',
      taskDir: '.tasks/test-feature/TASK-2026-999',
      format: 'toon'
    });

    assert.equal(sandbox.role, 'backend');
    assert.match(sandbox.payload, /::AOI_SUBAGENT_PAYLOAD\[v2\]::/);

    // Simulate subagent writing a file in the sandbox
    sandbox.trackFileWrite(tempTestFile, 'hello world');
    assert.equal(fs.existsSync(tempTestFile), true);
    assert.equal(sandbox.getTrackedFileCount(), 1);

    // Rollback sandbox (0ms / 0 tokens LLM)
    sandbox.rollback();
    assert.equal(fs.existsSync(tempTestFile), false);
  });
});
