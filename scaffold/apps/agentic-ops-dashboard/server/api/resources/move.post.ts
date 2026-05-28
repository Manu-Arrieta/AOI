import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { moveResourceFolder, ResourceOperationError } from '../../utils/resource-operations'

const payloadSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
  reason: z.string().min(1),
  relatedTaskId: z.string().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    return await moveResourceFolder(payloadSchema.parse(await readBody(event)))
  } catch (error) {
    if (error instanceof ResourceOperationError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
      })
    }

    throw error
  }
})