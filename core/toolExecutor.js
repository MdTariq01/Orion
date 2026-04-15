import { getCurrentTime } from '../tools/systemTools.js'
import { getEmails, requestSendEmail, sendEmail } from '../tools/emailTools.js'
import User from '../models/User.model.js'
import { getBot } from '../telegram/bot.js'
import { getCalendarEvents, requestCreateEvent, createEvent, requestDeleteEvent, deleteEvent , getTasks } from '../tools/calendarTools.js'


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email) {
  if (!email) return false
  if (!EMAIL_REGEX.test(email)) return false
  if (email.includes('[')) return false
  if (email.includes('example.com')) return false
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

    case 'get_tasks':
      return await getTasks(userId, toolArgs.maxResults || 10)

    case 'get_calendar_events':
      return await getCalendarEvents(userId, toolArgs.days || 7, toolArgs.maxResults || 10)

    case 'request_create_event':
      return await requestCreateEvent(
        userId,
        user.telegramChatId,
        toolArgs.title,
        toolArgs.date,
        toolArgs.startTime,
        toolArgs.endTime,
        toolArgs.description,
        toolArgs.location,
        toolArgs.context,
        bot
      )

    case 'request_delete_event':
      return await requestDeleteEvent(
        userId,
        user.telegramChatId,
        toolArgs.eventId,
        toolArgs.title,
        toolArgs.context,
        bot
      )

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}