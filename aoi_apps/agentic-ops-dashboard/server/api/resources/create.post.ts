import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { createResourceFolder, ResourceOperationError } from '../../utils/resource-operations'

const payloadSchema = z.object({
  folderName: z.string().min(1),
  parentPath: z.string().min(1).default('.resources'),
  purpose: z.string().min(1),
  relatedTaskId: z.string().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    return await createResourceFolder(payloadSchema.parse(await readBody(event)))
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