import { getCurrentTime } from '../tools/systemTools.js'
import { getEmails, requestSendEmail, sendEmail } from '../tools/emailTools.js'
import User from '../models/User.model.js'
import { getBot } from '../telegram/bot.js'
import {
  getCalendarEvents, requestCreateEvent, createEvent,
  requestDeleteEvent, deleteEvent, requestCreateTask, createTask, getTasks
} from '../tools/calendarTools.js'

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

  // ── LATENCY: per-tool execution timer ──
  const toolStart = Date.now()
  let result

  switch (toolName) {
    case 'get_current_time':
      result = getCurrentTime()
      break

    case 'get_emails':
      result = await getEmails(userId, toolArgs.count || 10)
      break

    case 'request_send_email': {
      const { to, subject, body, context } = toolArgs

      if (!isValidEmail(to)) {
        result = {
          error: `Invalid recipient email address: "${to}". Please fetch the emails first to get the exact sender email address, then try again.`
        }
        break
      }

      result = await requestSendEmail(
        userId,
        user.telegramChatId,
        to,
        subject,
        body,
        context,
        bot
      )
      break
    }

    case 'get_tasks':
      result = await getTasks(userId, toolArgs.maxResults || 10)
      break

    case 'get_calendar_events':
      result = await getCalendarEvents(userId, toolArgs.days || 7, toolArgs.maxResults || 10)
      break

    case 'request_create_event':
      result = await requestCreateEvent(
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
      break

    case 'request_delete_event':
      result = await requestDeleteEvent(
        userId,
        user.telegramChatId,
        toolArgs.eventId,
        toolArgs.title,
        toolArgs.context,
        bot
      )
      break

    case 'request_create_task':
      result = await requestCreateTask(
        userId,
        user.telegramChatId,
        toolArgs.title,
        toolArgs.dueDate,
        toolArgs.notes,
        toolArgs.context,
        bot
      )
      break

    default:
      result = { error: `Unknown tool: ${toolName}` }
  }

  console.log(`[LATENCY] tool=${toolName} time=${Date.now() - toolStart}ms`)
  return result
}