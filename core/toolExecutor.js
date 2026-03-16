import { getCurrentTime } from '../tools/systemTools.js'
import { getEmails, requestSendEmail, sendEmail } from '../tools/emailTools.js'
import User from '../models/User.model.js'
import { getBot } from '../telegram/bot.js'

export async function executeTool(toolName, toolArgs, userId) {
   console.log(`Executing tool: ${toolName}`, toolArgs)
  console.log('userId received in executeTool:', userId) // add this

  const user = await User.findOne({ userId })
  if (!user) return { error: 'User not found' }
  const bot = getBot()

  switch (toolName) {
    case 'get_current_time':
      return getCurrentTime()

    case 'get_emails':
      return await getEmails(userId, toolArgs.count || 10)

    case 'request_send_email':
      return await requestSendEmail(
        userId,
        user.telegramChatId,
        toolArgs.to,
        toolArgs.subject,
        toolArgs.body,
        toolArgs.context,
        bot
      )

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}