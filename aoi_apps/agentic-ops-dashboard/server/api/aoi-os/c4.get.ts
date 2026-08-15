import { defineEventHandler } from 'h3'
import { generateC4ArchitectureDiagram } from '../../utils/c4-generator'

export default defineEventHandler(() => {
  const sampleNodes = [
    { id: 'TASK-1', title: 'Task Registry Loader', role: 'backend', targetFiles: ['server/utils/parse-task-registry.ts'], status: 'completed' },
    { id: 'TASK-2', title: 'Resource Explorer API', role: 'backend', targetFiles: ['server/api/resources/'], status: 'completed', dependsOn: ['TASK-1'] },
    { id: 'TASK-3', title: 'Task DAG Matrix Visualizer', role: 'frontend', targetFiles: ['app/components/TaskDagViewer.vue'], status: 'in_progress', dependsOn: ['TASK-1'] },
    { id: 'TASK-4', title: 'AOI-OS C2 Telemetry Streamer', role: 'devops', targetFiles: ['server/api/aoi-os/stream.get.ts'], status: 'completed', dependsOn: ['TASK-2', 'TASK-3'] },
  ]

  const c4 = generateC4ArchitectureDiagram(sampleNodes, {
    systemName: 'AOI-OS Governed Micro-Architecture',
  })

  return {
    ok: true,
    ...c4,
    generatedAt: new Date().toISOString(),
  }
})
