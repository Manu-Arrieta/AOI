/**
 * scripts/aoi-os/abi-linker/bidirectional-abi-linker.mjs
 *
 * Deterministic Bidirectional ABI & Contract Linker for AOI-OS:
 * Aligns client-side TypeScript interfaces and server-side DTOs / C# models
 * in real-time during concurrent wave execution (0 LLM Tokens).
 */

/**
 * Normalizes field names to canonical snake_case for cross-language matching.
 *
 * @param {string} fieldName
 * @returns {string} Normalized field name
 */
export function canonicalizeFieldName(fieldName = '') {
  return fieldName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]/g, '_')
    .toLowerCase()
}

/**
 * Extracts declared property keys from TypeScript interface or C# class definition.
 *
 * @param {string} typeDefinition
 * @returns {Array<{ original: string, canonical: string }>}
 */
export function extractTypeFields(typeDefinition = '') {
  if (!typeDefinition || typeof typeDefinition !== 'string') return []

  const fields = []
  const seen = new Set()

  // 1. TypeScript interface properties: foo: string;
  const tsPropRegex = /(?:public\s+)?([A-Za-z0-9_$]+)\s*[:?]\s*[^;,\n]+[;,]?/g
  let match
  while ((match = tsPropRegex.exec(typeDefinition)) !== null) {
    const original = match[1]
    if (['interface', 'type', 'export', 'public', 'class'].includes(original)) continue
    if (!seen.has(original)) {
      seen.add(original)
      fields.push({ original, canonical: canonicalizeFieldName(original) })
    }
  }

  // 2. C# property definitions: public string Foo { get; set; }
  const csPropRegex = /public\s+(?!class\b|record\b|struct\b|interface\b)([A-Za-z0-9_<>[\]?]+)\s+([A-Za-z0-9_]+)\s*\{/g
  while ((match = csPropRegex.exec(typeDefinition)) !== null) {
    const original = match[2]
    if (!seen.has(original)) {
      seen.add(original)
      fields.push({ original, canonical: canonicalizeFieldName(original) })
    }
  }

  return fields
}

/**
 * Compares client and server type contracts and generates alignment mappings.
 *
 * @param {string} clientTypeDefinition
 * @param {string} serverTypeDefinition
 * @returns {object} Alignment report and field mapping dictionary
 */
export function alignBidirectionalAbi(clientTypeDefinition = '', serverTypeDefinition = '') {
  const clientFields = extractTypeFields(clientTypeDefinition)
  const serverFields = extractTypeFields(serverTypeDefinition)

  const clientCanonicalMap = new Map(clientFields.map((f) => [f.canonical, f.original]))
  const serverCanonicalMap = new Map(serverFields.map((f) => [f.canonical, f.original]))

  const matchedFields = []
  const missingInServer = []
  const missingInClient = []
  const fieldMapping = {}

  // Check client fields in server
  for (const [canon, clientOrig] of clientCanonicalMap.entries()) {
    if (serverCanonicalMap.has(canon)) {
      const serverOrig = serverCanonicalMap.get(canon)
      matchedFields.push({ client: clientOrig, server: serverOrig, canonical: canon })
      fieldMapping[clientOrig] = serverOrig
    } else {
      missingInServer.push(clientOrig)
    }
  }

  // Check server fields in client
  for (const [canon, serverOrig] of serverCanonicalMap.entries()) {
    if (!clientCanonicalMap.has(canon)) {
      missingInClient.push(serverOrig)
    }
  }

  const totalDistinct = new Set([...clientCanonicalMap.keys(), ...serverCanonicalMap.keys()]).size
  const alignmentScore = totalDistinct === 0 ? 100 : Math.round((matchedFields.length / totalDistinct) * 100)
  const aligned = alignmentScore === 100

  return {
    aligned,
    alignmentScore,
    matchedCount: matchedFields.length,
    missingInServer,
    missingInClient,
    fieldMapping,
  }
}
