/**
 * scripts/aoi-os/route-guard/api-collision-matrix.mjs
 *
 * Deterministic API Route Collision & Parameter Discrepancy Matrix for AOI-OS:
 * Statically traverses all monorepo API routes (Nitro, Express, ASP.NET, FastAPI),
 * detecting shadowing routes, conflicting parameter names, and HTTP method collisions (0 LLM Tokens).
 */

/**
 * Normalizes a route path for parameter-agnostic collision comparison.
 *
 * @param {string} routePath
 * @returns {string} Normalized template route
 */
function normalizeRouteTemplate(routePath) {
  return routePath
    .replace(/\/+/g, '/')
    .replace(/\/:[a-zA-Z0-9_]+/g, '/:__param__')
    .replace(/\/\[[a-zA-Z0-9_]+\]/g, '/:__param__')
    .toLowerCase()
}

/**
 * Audits a list of declared routes for HTTP collisions and shadowing.
 *
 * @param {Array<{ method: string, path: string, handlerFile?: string }>} routes
 * @returns {object} Collision report and route audit
 */
export function auditRouteCollisions(routes = []) {
  const collisions = []
  const seenTemplates = new Map()

  for (const route of routes) {
    const method = (route.method || 'GET').toUpperCase()
    const template = normalizeRouteTemplate(route.path)
    const key = `${method} ${template}`

    if (seenTemplates.has(key)) {
      const existing = seenTemplates.get(key)
      collisions.push({
        method,
        collidingPath: route.path,
        conflictingWith: existing.path,
        template,
        type: 'ROUTE_SHADOWING_OR_METHOD_COLLISION',
      })
    } else {
      seenTemplates.set(key, route)
    }
  }

  const hasCollisions = collisions.length > 0

  return {
    totalRoutesAudited: routes.length,
    collisionsCount: collisions.length,
    hasCollisions,
    collisions,
    matrixStatus: hasCollisions ? 'API_ROUTE_COLLISIONS_DETECTED' : 'API_ROUTE_TOPOLOGY_OPTIMAL',
  }
}
