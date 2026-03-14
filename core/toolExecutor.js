import { getCurrentTime } from '../tools/systemTools.js'

export async function executeTool(toolName, toolArgs) {
  console.log(`Executing tool: ${toolName}`, toolArgs)

  switch (toolName) {
    case 'get_current_time':
      return getCurrentTime()

    case 'get_emails':
      return await getEmails(userId, toolArgs.count || 5)

    case 'send_email':
      return await sendEmail(userId, toolArgs.to, toolArgs.subject, toolArgs.body)

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}