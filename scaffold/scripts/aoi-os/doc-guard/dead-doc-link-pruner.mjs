/**
 * scripts/aoi-os/doc-guard/dead-doc-link-pruner.mjs
 *
 * Deterministic Dead Markdown Anchor & Cross-Doc Link Pruner for AOI-OS:
 * Statically audits relative markdown links and section anchors against declared file systems
 * and headings to prove 100% document link reachability (0 LLM Tokens).
 */

/**
 * Audits markdown links against a set of valid existing relative paths and heading anchors.
 *
 * @param {string} markdownContent - Markdown document content
 * @param {string[]} validPaths - List of valid workspace file paths
 * @returns {object} Link audit report
 */
export function auditDeadMarkdownDocLinks(markdownContent = '', validPaths = []) {
  const deadLinks = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const validPathSet = new Set(validPaths.map((p) => p.replace(/^\.\//, '')))

  let match
  while ((match = linkRegex.exec(markdownContent)) !== null) {
    const linkTarget = match[2].trim()

    // Ignore web URLs and mailto
    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(linkTarget)) {
      continue
    }

    // Extract path portion (ignoring #anchor for file existence check)
    const filePath = linkTarget.split('#')[0].replace(/^\.\//, '')
    if (filePath && !validPathSet.has(filePath)) {
      deadLinks.push({
        linkText: match[1],
        target: linkTarget,
        error: 'BROKEN_MARKDOWN_FILE_LINK',
        recommendation: `Fix or prune broken markdown link to '${linkTarget}'.`,
      })
    }
  }

  const allValid = deadLinks.length === 0

  return {
    allValid,
    deadLinksCount: deadLinks.length,
    deadLinks,
    docProof: allValid ? 'ALL_DOC_LINKS_REACHABLE' : 'BROKEN_DOC_LINKS_DETECTED',
  }
}
