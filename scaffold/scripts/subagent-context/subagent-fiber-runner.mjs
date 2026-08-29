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
      return () => {
        // Rollback all tracked file changes on teardown
        for (const [filePath, origContent] of trackedFiles.entries()) {
          if (origContent === null) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } else {
            fs.writeFileSync(filePath, origContent, 'utf8');
          }
        }
        trackedFiles.clear();
      };
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
      for (const [filePath, origContent] of trackedFiles.entries()) {
        if (origContent === null) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } else {
          fs.writeFileSync(filePath, origContent, 'utf8');
        }
      }
      trackedFiles.clear();
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
