import { getCurrentTime } from '../tools/systemTools.js'
import { getEmails, requestSendEmail, sendEmail } from '../tools/emailTools.js'
import User from '../models/User.model.js'
import { getBot } from '../telegram/bot.js'
 
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 
function isValidEmail(email) {
  if (!email) return false
  if (!EMAIL_REGEX.test(email)) return false
  if (email.includes('[')) return false        // catches [sender_email] placeholders
  if (email.includes('example.com')) return false  // catches hallucinated example emails
  if (email.includes('placeholder')) return false
  return true
}
 
export async function executeTool(toolName, toolArgs, userId) {
  console.log(`Executing tool: ${toolName}`, toolArgs)
  console.log('userId received in executeTool:', userId)
 
  const user = await User.findOne({ userId })
  if (!user) return { error: 'User not found' }
  const bot = getBot()
 
  switch (toolName) {
    case 'get_current_time':
      return getCurrentTime()
 
    case 'get_emails':
      return await getEmails(userId, toolArgs.count || 10)
 
    case 'request_send_email': {
      const { to, subject, body, context } = toolArgs
 
      // validate recipient before doing anything
      if (!isValidEmail(to)) {
        return { 
          error: `Invalid recipient email address: "${to}". Please fetch the emails first to get the exact sender email address, then try again.`
        }
      }
 
      return await requestSendEmail(
        userId,
        user.telegramChatId,
        to,
        subject,
        body,
        context,
        bot
      )
    }
 
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
 