import TelegramBot from 'node-telegram-bot-api'
import { getAuthUrl } from '../auth/googleAuth.js'
import { Ollama } from 'ollama'
import { toolDefinitions } from '../config/tools.js'
import { executeTool } from '../core/toolExecutor.js'
import User from '../models/User.model.js'
import PendingAction from '../models/PendingAction.model.js'
import ActionLog from '../models/ActionLog.model.js'
import { sendEmail } from '../tools/emailTools.js'

//this is bot.js
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

let bot
const conversations = {}

async function chat(chatId, userMessage, userId) {
  if (!conversations[chatId]) {
    conversations[chatId] = []
  }

  conversations[chatId].push({
    role: 'user',
    content: userMessage
  })

  // keep history trim
  if (conversations[chatId].length > 40) {
    conversations[chatId] = conversations[chatId].slice(-30)
  }

  let messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversations[chatId]
  ]

    
    const tools = toolDefinitions

  // ReAct loop
  while (true) {
    const response = await ollama.chat({
      model: 'qwen3:1.7b',
      messages,
      tools,
      stream: false
    })

    const msg = response.message    
  
    // no tool call — return reply
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      conversations[chatId].push({ role: 'assistant', content: reply })
      return reply
    }

    // tool call requested
    const toolCall = msg.tool_calls[0]
    const toolName = toolCall.function.name
    const toolArgs = toolCall.function.arguments

    console.log(`Ollama calling tool: ${toolName}`)

    const toolResult = await executeTool(toolName, toolArgs, userId)

    console.log(`Tool result:`, toolResult)

    // add to message history
    messages.push(msg)
    messages.push({
      role: 'tool',
      content: JSON.stringify(toolResult)
    })
  }
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

  bot.on('message', async (msg) => {
  if (!msg.text) return
  if (msg.text.startsWith('/')) return

  const chatId = msg.chat.id
  const text = msg.text

  console.log(`Message from ${chatId}: ${text}`)
  bot.sendChatAction(chatId, 'typing')
  const typingInterval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing')
  }, 4000)

    try {
    // get user from DB
    const user = await User.findOne({ telegramChatId: String(chatId) })

    // if no user tell them to run /start
    if (!user) {
      await bot.sendMessage(chatId, 'Please send /start to set up your account.')
      return
    }

    // if gmail not connected remind them
    if (!user.gmailConnected) {
      await bot.sendMessage(chatId, 'Your Gmail is not connected yet. Please use the link sent earlier or send /start again.')
      return
    }

    const reply = await chat(chatId, text, user.userId)
    clearInterval(typingInterval)
    
    // reset conversation if too long
    if (conversations[chatId] && conversations[chatId].history?.length > 40) {
      delete conversations[chatId]
    }

    try {
      await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' })
    } catch {
      await bot.sendMessage(chatId, reply) // fallback without markdown
    }

  } catch (error) {
    clearInterval(typingInterval)
    console.error('Error:', error)
    await bot.sendMessage(chatId, 'Something went wrong.')
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

      if (approved) {
        // get user tokens and send the email
        const user = await User.findOne({ userId: pending.userId })
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

        // edit the message to show it was sent
        await bot.editMessageText(
          `✅ *Email sent successfully!*\n\nTo: ${pending.payload.to}\nSubject: ${pending.payload.subject}`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        )

      } else {
        await PendingAction.findOneAndUpdate({ actionId }, { status: 'rejected' })

        await bot.editMessageText(
          `❌ *Email cancelled.*`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        )
      }

      await bot.answerCallbackQuery(query.id)

    } catch (error) {
      console.error('Callback error:', error)
      await bot.answerCallbackQuery(query.id, { text: 'Something went wrong.' })
    }
  }
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
      user.email || 'officialmdtariq01@gmail.com', // sends to yourself
      'Test Email from My Agent',
      'Hi,\n\nThis is a test email sent by your AI agent.\n\nIf you see this, the approval flow is working!\n\nRegards,\nYour Agent',
      'Testing the email approval system',
      bot
    )

  } catch (error) {
    console.error('Test email error:', error)
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

    // clear old tokens
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
    console.error('Reconnect error:', error)
    await bot.sendMessage(chatId, 'Something went wrong. Try again.')
  }
})

  bot.on('polling_error', (error) => {
    console.error('Telegram error:', error.code)
  })

  console.log('Telegram bot started')
}

export function getBot() {
  return bot
}