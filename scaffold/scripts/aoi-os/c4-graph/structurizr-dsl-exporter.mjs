/**
 * scripts/aoi-os/c4-graph/structurizr-dsl-exporter.mjs
 *
 * Deterministic Structurizr DSL C4 Architecture Exporter for AOI-OS:
 * Converts runtime architecture models, components, containers, and relations into
 * standard Structurizr DSL syntax for enterprise architectural governance (0 LLM Tokens).
 */

/**
 * Converts a C4 model definition into standard Structurizr DSL text.
 *
 * @param {object} options
 * @param {string} options.workspaceName - Architecture workspace title
 * @param {Array<{ id: string, name: string, description: string, technology?: string }>} options.containers
 * @param {Array<{ source: string, target: string, description: string, technology?: string }>} options.relations
 * @returns {string} Structurizr DSL string
 */
export function exportToStructurizrDsl(options = {}) {
  const name = options.workspaceName || 'AOI Architecture'
  const containers = options.containers || []
  const relations = options.relations || []

  const lines = [
    `workspace "${name}" "Enterprise C4 Architecture Specification" {`,
    `    model {`,
    `        user = person "Developer / Operator" "Interacts with AOI-OS via CLI, IDE & Dashboard"`,
    `        aoiSystem = softwareSystem "AOI Operational Infrastructure" {`,
  ]

  // Output containers
  for (const c of containers) {
    const tech = c.technology ? ` "${c.technology}"` : ''
    lines.push(`            ${c.id} = container "${c.name}" "${c.description || ''}"${tech}`)
  }

  lines.push(`        }`)
  lines.push(``)

  // Relationships
  lines.push(`        user -> aoiSystem "Uses and governs"`)
  for (const r of relations) {
    const tech = r.technology ? ` "${r.technology}"` : ''
    lines.push(`        ${r.source} -> ${r.target} "${r.description || 'Interacts with'}"${tech}`)
  }

  // Views definition
  lines.push(`    }`)
  lines.push(`    views {`)
  lines.push(`        systemContext aoiSystem "SystemContext" {`)
  lines.push(`            include *`)
  lines.push(`            autoLayout`)
  lines.push(`        }`)
  lines.push(`        container aoiSystem "Containers" {`)
  lines.push(`            include *`)
  lines.push(`            autoLayout`)
  lines.push(`        }`)
  lines.push(`        theme default`)
  lines.push(`    }`)
  lines.push(`}`)

  return lines.join('\n')
}
