import { defineEventHandler } from 'h3'

import { collectCopilotTokenUsageSummary } from '../../utils/token-observability/collect-copilot-token-usage'
import { loadTokenObservabilityConfig } from '../../utils/token-observability/token-observability-config'

export default defineEventHandler(async () => {
  const config = await loadTokenObservabilityConfig()
  return collectCopilotTokenUsageSummary({ config })
})