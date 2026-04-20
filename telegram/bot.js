import TelegramBot from 'node-telegram-bot-api'
import { getAuthUrl } from '../auth/googleAuth.js'
import { Ollama } from 'ollama'
import { toolDefinitions } from '../config/tools.js'
import { executeTool } from '../core/toolExecutor.js'
import User from '../models/User.model.js'
import PendingAction from '../models/PendingAction.model.js'
import ActionLog from '../models/ActionLog.model.js'
import Conversation from '../models/Conversation.model.js'
import { sendEmail } from '../tools/emailTools.js'
import { createEvent, deleteEvent, createTask } from '../tools/calendarTools.js'

const ollama = new Ollama({ host: 'http://localhost:11434' })

const SYSTEM_PROMPT = `You are Jarvis, a personal AI assistant.

STRICT EMAIL RULES — follow exactly:

URGENT = only if a real individual human wrote this email personally to you and is waiting for your reply. Examples: a recruiter named "Rahul" emailing you directly, a professor messaging you, a friend asking something.

NORMAL = official automated emails from your college, GitHub notifications about your own repos.

IGNORE = everything else. This includes ALL of these no matter what they say:
- Anything from Internshala, LinkedIn, Naukri, Indeed, Unstop, Dare2Compete
- Any email with noreply@ or no-reply@ in the sender
- Job alerts, hiring digests, "X is hiring" emails
- Newsletters, promotional offers, OTP, transaction alerts
- Any email sent to thousands of people at once

FORMAT your email reply EXACTLY like this, no deviations:

🔴 *URGENT*
- Subject — from Sender Name

🟡 *NORMAL*
- Subject — from Sender Name

_X urgent, X normal, X ignored._

Rules:
- Never show IGNORE emails
- Never add explanations or comments after each email
- Never add categories like "(automated)" in the list
- Just subject and sender, nothing else
- If 0 urgent emails write: _0 urgent, X normal, X ignored._`

const MAX_HISTORY = 30
const MAX_TOOL_ITERATIONS = 10

let bot

async function getHistory(chatId) {
  try {
    // ── LATENCY: DB history fetch ──
    const dbStart = Date.now()
    const conv = await Conversation.findOne({ telegramChatId: String(chatId) })
    console.log(`[LATENCY] db_history=${Date.now() - dbStart}ms`)
    return conv ? conv.messages : []
  } catch (err) {
    console.error('Failed to load conversation history:', err.message)
    return []
  }
}

async function saveHistory(chatId, messages) {
  try {
    await Conversation.findOneAndUpdate(
      { telegramChatId: String(chatId) },
      {
        messages: messages.slice(-MAX_HISTORY),
        updatedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    )
  } catch (err) {
    console.error('Failed to save conversation history:', err.message)
  }
}

async function chat(chatId, userMessage, userId) {
  // load history from DB
  const history = await getHistory(chatId)

  history.push({ role: 'user', content: userMessage })

  let messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history
  ]

  let iterations = 0

  // ReAct loop
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++

    let response
    try {
      const llmStart = Date.now()
response = await ollama.chat({
  model: 'qwen3:1.7b',
  messages,
  tools: toolDefinitions,
  stream: false
})
console.log(`[LATENCY] chat_llm_iter${iterations}=${Date.now() - llmStart}ms`)
    } catch (err) {
      console.error('Ollama error:', err.message)
      throw new Error('The AI model is unavailable. Please try again in a moment.')
    }

    const msg = response.message

    // no tool call — final reply
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      history.push({ role: 'assistant', content: reply })
      await saveHistory(chatId, history)

      return reply
    }

    // tool call requested
    const toolCall = msg.tool_calls[0]
    const toolName = toolCall.function.name
    const toolArgs = toolCall.function.arguments

    console.log(`Calling tool: ${toolName}`, toolArgs)

    let toolResult
    try {
      toolResult = await executeTool(toolName, toolArgs, userId)
    } catch (err) {
      console.error(`Tool "${toolName}" failed:`, err.message)
      toolResult = { error: true, message: `Tool "${toolName}" failed: ${err.message}` }
    }

    console.log(`Tool result:`, toolResult)

    messages.push(msg)
    messages.push({
      role: 'tool',
      content: JSON.stringify(toolResult)
    })
  }

  // hit iteration limit
  throw new Error('The agent got stuck in a loop. Please try rephrasing your request.')
}

export function startBot() {
  const token = process.env.TELEGRAM_TOKEN
  if (!token) throw new Error('TELEGRAM_TOKEN is missing!')

  bot = new TelegramBot(token, {
    polling: {
      params: {
        allowed_updates: ['message', 'callback_query']
      }
    }
  })

  bot.onText(/\/start/, async (msg) => {
    const { handleStart } = await import('./registration.js')
    await handleStart(bot, msg)
  })

  bot.onText(/\/clear/, async (msg) => {
    const chatId = msg.chat.id
    try {
      await Conversation.findOneAndDelete({ telegramChatId: String(chatId) })
      await bot.sendMessage(chatId, '🧹 Conversation history cleared.')
    } catch (err) {
      console.error('Clear history error:', err.message)
      await bot.sendMessage(chatId, 'Failed to clear history. Try again.')
    }
  })

  bot.on('message', async (msg) => {
  if (!msg.text) return
  if (msg.text.startsWith('/')) return
 
  const chatId = msg.chat.id
  const text = msg.text
 
  // ── LATENCY: end-to-end timer starts here ──
  const e2eStart = Date.now()
 
  console.log(`Message from ${chatId}: ${text}`)
  bot.sendChatAction(chatId, 'typing')
  const typingInterval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing')
  }, 4000)
 
  try {
    const user = await User.findOne({ telegramChatId: String(chatId) })
 
    if (!user) {
      clearInterval(typingInterval)
      await bot.sendMessage(chatId, 'Please send /start to set up your account.')
      return
    }
 
    if (!user.gmailConnected) {
      clearInterval(typingInterval)
      await bot.sendMessage(chatId, 'Your account is not connected yet. Please use the link sent earlier or send /start again.')
      return
    }
 
    const reply = await chat(chatId, text, user.userId)
    clearInterval(typingInterval)
 
    // ── LATENCY: log before sending reply ──
    console.log(`[LATENCY] end_to_end=${Date.now() - e2eStart}ms`)
 
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' })
    } catch {
      await bot.sendMessage(chatId, reply)
    }
 
  } catch (error) {
    clearInterval(typingInterval)
    console.error('Handler error:', error.message)
 
    const userMsg = error.message?.includes('unavailable') || error.message?.includes('loop')
      ? error.message
      : 'Something went wrong. Please try again.'
 
    await bot.sendMessage(chatId, userMsg)
  }
})

  // handle yes/no button clicks
  bot.on('callback_query', async (query) => {
    console.log('Button clicked:', query.data)
    const chatId = query.message.chat.id
    const data = query.data

    if (data.startsWith('approve_') || data.startsWith('reject_')) {
      const actionId = data.replace('approve_', '').replace('reject_', '')
      const approved = data.startsWith('approve_')

      try {
        const pending = await PendingAction.findOne({ actionId })

        if (!pending || pending.status !== 'awaiting') {
          await bot.answerCallbackQuery(query.id, { text: 'Action already handled.' })
          return
        }

        const user = await User.findOne({ userId: pending.userId })
        if (!user) {
          await bot.answerCallbackQuery(query.id, { text: 'User not found.' })
          return
        }

        if (approved) {

          if (pending.type === 'send_email') {
            await sendEmail(user, pending.payload.to, pending.payload.subject, pending.payload.body)

            await PendingAction.findOneAndUpdate({ actionId }, { status: 'approved' })
            await ActionLog.create({
              userId: pending.userId,
              action: 'send_email',
              payload: pending.payload,
              result: { success: true, message: 'Email sent' },
              approvedBy: 'user',
              pendingActionId: actionId
            })

            await bot.editMessageText(
              `✅ *Email sent successfully!*\n\nTo: ${pending.payload.to}\nSubject: ${pending.payload.subject}`,
              { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
            )

          } else if (pending.type === 'create_event') {
            const { title, date, startTime, endTime, description, location } = pending.payload
            await createEvent(user, title, date, startTime, endTime, description, location)

            await PendingAction.findOneAndUpdate({ actionId }, { status: 'approved' })
            await ActionLog.create({
              userId: pending.userId,
              action: 'create_event',
              payload: pending.payload,
              result: { success: true, message: 'Event created' },
              approvedBy: 'user',
              pendingActionId: actionId
            })

            await bot.editMessageText(
              `✅ *Event created!*\n\n*${title}*\n${date} at ${startTime}`,
              { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
            )

          } else if (pending.type === 'delete_event') {
            await deleteEvent(user, pending.payload.eventId)

            await PendingAction.findOneAndUpdate({ actionId }, { status: 'approved' })
            await ActionLog.create({
              userId: pending.userId,
              action: 'delete_event',
              payload: pending.payload,
              result: { success: true, message: 'Event deleted' },
              approvedBy: 'user',
              pendingActionId: actionId
            })

            await bot.editMessageText(
              `✅ *Event deleted:* ${pending.payload.title}`,
              { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
            )

          } else if (pending.type === 'create_task') {
            const { title, dueDate, notes } = pending.payload
            await createTask(user, title, dueDate, notes)

            await PendingAction.findOneAndUpdate({ actionId }, { status: 'approved' })
            await ActionLog.create({
              userId: pending.userId,
              action: 'create_task',
              payload: pending.payload,
              result: { success: true, message: 'Task created' },
              approvedBy: 'user',
              pendingActionId: actionId
            })

            const dueLine = dueDate ? `\n*Due:* ${dueDate}` : ''
            await bot.editMessageText(
              `✅ *Task created!*\n\n*${title}*${dueLine}`,
              { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
            )
          }

        } else {
          await PendingAction.findOneAndUpdate({ actionId }, { status: 'rejected' })
          await bot.editMessageText(
            `❌ *Cancelled.*`,
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          )
        }

        await bot.answerCallbackQuery(query.id)

      } catch (error) {
        console.error('Callback error:', error.message)
        await bot.answerCallbackQuery(query.id, { text: 'Something went wrong.' })
      }
    }
  })

  bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id
  await bot.sendMessage(chatId, 
    `*Orion — Commands*\n\n` +
    `Just type naturally — no commands needed for most things.\n\n` +
    `*Examples:*\n` +
    `• "Show my unread emails"\n` +
    `• "Schedule a meeting tomorrow at 3pm"\n` +
    `• "What's on my calendar this week"\n` +
    `• "Send an email to rahul@gmail.com"\n\n` +
    `*Commands:*\n` +
    `/start — Set up your account\n` +
    `/reconnect — Reconnect Gmail\n` +
    `/clear — Clear conversation history\n` +
    `/help — Show this message`,
    { parse_mode: 'Markdown' }
  )
})

  bot.onText(/\/testemail/, async (msg) => {
    const chatId = msg.chat.id
    try {
      const user = await User.findOne({ telegramChatId: String(chatId) })
      if (!user) {
        await bot.sendMessage(chatId, 'Please /start first.')
        return
      }

      const { requestSendEmail } = await import('../tools/emailTools.js')
      await requestSendEmail(
        user.userId,
        String(chatId),
        user.email || 'officialmdtariq01@gmail.com',
        'Test Email from My Agent',
        'Hi,\n\nThis is a test email sent by your AI agent.\n\nIf you see this, the approval flow is working!\n\nRegards,\nYour Agent',
        'Testing the email approval system',
        bot
      )
    } catch (error) {
      console.error('Test email error:', error.message)
      await bot.sendMessage(chatId, 'Error: ' + error.message)
    }
  })

  bot.onText(/\/reconnect/, async (msg) => {
    const chatId = msg.chat.id
    try {
      const user = await User.findOne({ telegramChatId: String(chatId) })
      if (!user) {
        await bot.sendMessage(chatId, 'Please send /start first.')
        return
      }

      await User.findOneAndUpdate(
        { telegramChatId: String(chatId) },
        {
          $unset: { googleAccessToken: 1, googleRefreshToken: 1 },
          $set: { gmailConnected: false }
        }
      )

      const authUrl = getAuthUrl(user.userId)
      await bot.sendMessage(chatId,
        `🔄 Let's reconnect your Gmail.\n\nClick the link below and approve access:\n\n${authUrl}`
      )
    } catch (error) {
      console.error('Reconnect error:', error.message)
      await bot.sendMessage(chatId, 'Something went wrong. Try again.')
    }
  })

  bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error.code, error.message)
  })

  console.log('Telegram bot started')
}

export function getBot() {
  return bot
}