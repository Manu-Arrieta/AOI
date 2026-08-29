/**
 * scripts/spatiotemporal-runtime/agent-hmr-engine.mjs
 *
 * Implements Transactional Hot Module Replacement (HMR) for Agent Tools and Scripts
 * based on Algorithms 8, 9, and 10 of the Spatiotemporal Composability Paper.
 *
 * Allows subagents to modify, test, and hot-swap utility scripts in runtime
 * without restarting the supervisor process or losing accumulated ICM context.
 */

import { pathToFileURL } from 'node:url';

/**
 * Creates an agent tool HMR engine managing dynamic components.
 */
export function createAgentHMREngine(fiberRuntime, coeffectRegistry) {
  const loadedModules = new Map(); // modulePath -> { entry, fiberController, version }
  let versionCounter = 1;

  /**
   * Registers and loads a dynamic agent module.
   * @param {string} modulePath - Absolute or relative file path to the module
   * @param {Object} [config={}]
   */
  async function loadModule(modulePath, config = {}) {
    const fileUrl = pathToFileURL(modulePath).href;
    const versionedUrl = `${fileUrl}?v=${versionCounter++}`;

    try {
      const imported = await import(versionedUrl);
      const component = imported.default || imported;

      if (!component || typeof component.apply !== 'function') {
        throw new Error(`Module '${modulePath}' does not export a valid Spatiotemporal component.`);
      }

      // Dispose existing fiber if already loaded
      if (loadedModules.has(modulePath)) {
        const existing = loadedModules.get(modulePath);
        existing.fiberController.dispose();
      }

      const fiberController = fiberRuntime.instantiate(component, config);

      loadedModules.set(modulePath, {
        modulePath,
        versionedUrl,
        config,
        component,
        fiberController,
        loadedAt: new Date().toISOString()
      });

      return { success: true, fiberUid: fiberController.uid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Transactionally reloads a modified module (Algorithm 10: Transactional Module Reload)
   * If the reloaded version fails, rolls back automatically to the backup instance.
   * @param {string} modulePath
   * @returns {Promise<{ reloaded: boolean, rolledBack: boolean, error?: string }>}
   */
  async function reloadModuleTransactional(modulePath) {
    if (!loadedModules.has(modulePath)) {
      return loadModule(modulePath);
    }

    const previous = loadedModules.get(modulePath);
    const backupComponent = previous.component;
    const backupConfig = previous.config;

    // Phase 1 & 2: Dispose old fiber
    previous.fiberController.dispose();

    // Phase 3: Attempt to load new version
    const newVersionUrl = `${pathToFileURL(modulePath).href}?v=${versionCounter++}`;
    try {
      const newImport = await import(newVersionUrl);
      const newComponent = newImport.default || newImport;

      if (!newComponent || typeof newComponent.apply !== 'function') {
        throw new Error(`Updated module '${modulePath}' does not export a valid component.`);
      }

      const newFiber = fiberRuntime.instantiate(newComponent, backupConfig);

      loadedModules.set(modulePath, {
        modulePath,
        versionedUrl: newVersionUrl,
        config: backupConfig,
        component: newComponent,
        fiberController: newFiber,
        loadedAt: new Date().toISOString()
      });

      return { reloaded: true, rolledBack: false };
    } catch (err) {
      // Transactional Rollback: Re-instantiate backup component
      console.warn(`[HMR Rollback] Error reloading '${modulePath}', rolling back to backup:`, err.message);
      const restoredFiber = fiberRuntime.instantiate(backupComponent, backupConfig);

      loadedModules.set(modulePath, {
        modulePath,
        versionedUrl: previous.versionedUrl,
        config: backupConfig,
        component: backupComponent,
        fiberController: restoredFiber,
        loadedAt: new Date().toISOString()
      });

      return { reloaded: false, rolledBack: true, error: err.message };
    }
  }

  /**
   * Unloads and cleans up a loaded module completely.
   */
  function unloadModule(modulePath) {
    if (loadedModules.has(modulePath)) {
      const entry = loadedModules.get(modulePath);
      entry.fiberController.dispose();
      loadedModules.delete(modulePath);
      return true;
    }
    return false;
  }

  return {
    loadModule,
    reloadModuleTransactional,
    unloadModule,
    getLoadedModules() {
      return Array.from(loadedModules.keys());
    }
  };
}
