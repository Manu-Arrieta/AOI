/**
 * scripts/subagent-context/subagent-fiber-runner.mjs
 *
 * Implements Subagent Fiber Sandboxes (Module 2).
 * Enclaustrates micro-agent execution into a Spatiotemporal Fiber with Realm Isolation (Σ^iso)
 * and automatic effect tracking on filesystem and environment mutations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCoeffectRegistry } from '../spatiotemporal-runtime/coeffect-resolver.mjs';
import { createFiberRuntime } from '../spatiotemporal-runtime/fiber-lifecycle.mjs';
import { buildSubagentPayload } from './sanitize-subagent-payload.mjs';

/**
 * Creates a Subagent Fiber Sandbox for a specific role and task.
 * @param {Object} options
 * @param {string} options.role - 'frontend' | 'backend' | 'devops' | 'qa'
 * @param {string} options.taskDir - e.g. '.tasks/feature/TASK-YYYY-NNN'
 * @param {string} [options.format='toon'] - 'toon' | 'markdown'
 * @returns {Object} Sandbox controller with execution, tracking, and rollback capabilities
 */
/**
 * Puts every tracked file back the way it was, and forgets them.
 *
 * `null` means the file did not exist when it was first tracked, so undoing
 * the subagent's work means removing it. Anything else is the original content
 * and has to be written back. Inverting that single comparison turns a rollback
 * into a destroyer of pre-existing files, which is why this is exported: the
 * test suite asserts it directly instead of only reaching it through one of
 * its two callers.
 *
 * @param {Map<string, string|null>} trackedFiles mutated: cleared when done
 */
export function restoreTrackedFiles(trackedFiles) {
  for (const [filePath, origContent] of trackedFiles.entries()) {
    if (origContent === null) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      fs.writeFileSync(filePath, origContent, 'utf8');
    }
  }
  trackedFiles.clear();
}

export function createSubagentSandbox({ role, taskDir, format = 'toon' }) {
  const registry = createCoeffectRegistry();
  const runtime = createFiberRuntime(registry);
  const trackedFiles = new Map(); // filePath -> originalContent or null if new

  const taskFullDir = path.resolve(process.cwd(), taskDir);
  const tasksPath = path.join(taskFullDir, 'tasks.md');
  const designPath = path.join(taskFullDir, 'design.md');

  const tasksMd = fs.existsSync(tasksPath) ? fs.readFileSync(tasksPath, 'utf8') : '';
  const designMd = fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf8') : '';

  // 1. Build Isolated TOON Payload (Zero History Leak)
  const sanitizedPayload = buildSubagentPayload({
    taskId: path.basename(taskDir),
    feature: path.basename(path.dirname(taskDir)),
    workspace: path.basename(process.cwd()),
    role,
    tasksMd,
    designMd,
    format
  });

  // 2. Instantiate Subagent Component as a Fiber in its own isolated Realm
  const realmId = `realm_${role}_${Date.now()}`;
  registry.isolate('fs', realmId, role);
  registry.isolate('workspace', realmId, role);

  const subagentComponent = {
    name: `subagent-${role}`,
    inject: [],
    provide: [`subagent-status-${role}`],
    apply: (ctx) => {
      ctx.provide(`subagent-status-${role}`, { ready: true, role });
      // Fiber teardown and the explicit rollback() are the same operation, so
      // they are the same function. They used to be two byte-identical copies,
      // and only rollback() had a test — which meant the teardown path, the
      // one Invariant 3 is actually named after, was free to drift. A mutation
      // that inverted its `origContent === null` check turned restore into
      // delete and no test noticed.
      return () => restoreTrackedFiles(trackedFiles);
    }
  };

  // Provide initial coeffects
  registry.provide('fs', {
    trackFileWrite(filePath, content) {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!trackedFiles.has(fullPath)) {
        trackedFiles.set(fullPath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }, realmId);

  registry.provide('workspace', { root: process.cwd() }, realmId);

  const fiberController = runtime.instantiate(subagentComponent);

  return {
    role,
    realmId,
    payload: sanitizedPayload.payload,
    fiberUid: fiberController.uid,
    trackFileWrite(filePath, content) {
      const fsService = registry.inject('fs', { realm: realmId });
      fsService.trackFileWrite(filePath, content);
    },
    getTrackedFileCount() {
      return trackedFiles.size;
    },
    rollback() {
      restoreTrackedFiles(trackedFiles);
      fiberController.deactivate();
      fiberController.dispose();
      registry.recover();
    },
    commit() {
      trackedFiles.clear(); // Keep file changes permanently
      fiberController.dispose();
      registry.recover();
    }
  };
}
