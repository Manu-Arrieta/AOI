/**
 * scripts/aoi-os/contract-docgen/openapi-synthesizer.mjs
 *
 * Autonomous Deterministic OpenAPI 3.1 & TypeSpec Synthesizer for AOI-OS:
 * Generates API documentation directly from route signatures and AST contracts
 * with 0 LLM token consumption.
 */

/**
 * Extracts HTTP method and route path from filename/URI conventions.
 *
 * @param {string} filePath
 * @returns {{ method: string, path: string } | null}
 */
export function parseRouteFromPath(filePath = '') {
  const match = filePath.match(/(?:server\/api\/|controllers\/)?([a-zA-Z0-9_\-\/]+)\.(get|post|put|delete|patch)\.(?:ts|js|mjs)/i)
  if (match) {
    return {
      path: `/api/${match[1].replace(/_([a-zA-Z0-9]+)_/g, '{$1}')}`,
      method: match[2].toLowerCase(),
    }
  }

  // C# Controller pattern e.g. "Controllers/TasksController.cs"
  const csMatch = filePath.match(/([a-zA-Z0-9]+)Controller\.cs/i)
  if (csMatch) {
    return {
      path: `/api/${csMatch[1].toLowerCase()}`,
      method: 'get',
    }
  }

  return null
}

/**
 * Generates an OpenAPI 3.1 compliant document from route targets and task contracts.
 *
 * @param {Array<{ id: string, title?: string, targetFiles?: string[], role?: string }>} tasks
 * @param {object} [options]
 * @param {string} [options.title='AOI-OS Governed API']
 * @param {string} [options.version='1.0.0']
 * @returns {object} OpenAPI 3.1 JSON Object
 */
export function synthesizeOpenApiSpec(tasks = [], options = {}) {
  const { title = 'AOI-OS Governed API', version = '1.0.0' } = options

  const openApiDoc = {
    openapi: '3.1.0',
    info: {
      title,
      version,
      description: 'Auto-synthesized by AOI-OS Deterministic Polyglot AST Engine (0 LLM Tokens).',
    },
    paths: {},
    components: {
      schemas: {},
    },
  }

  for (const task of tasks) {
    const files = task.targetFiles || []
    for (const file of files) {
      const routeInfo = parseRouteFromPath(file)
      if (routeInfo) {
        if (!openApiDoc.paths[routeInfo.path]) {
          openApiDoc.paths[routeInfo.path] = {}
        }

        openApiDoc.paths[routeInfo.path][routeInfo.method] = {
          summary: task.title || `Endpoint for ${routeInfo.path}`,
          operationId: `${routeInfo.method}_${task.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
          tags: [task.role || 'general'],
          responses: {
            '200': {
              description: 'Successful execution',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        }
      }
    }
  }

  return openApiDoc
}
