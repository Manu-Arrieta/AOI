import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { saveTokenObservabilityConfig } from '../../utils/token-observability/token-observability-config'

const payloadSchema = z.object({
  enabled: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const payload = payloadSchema.parse(await readBody(event))
  return saveTokenObservabilityConfig(payload)
})