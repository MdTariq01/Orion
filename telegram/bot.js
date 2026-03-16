import TelegramBot from 'node-telegram-bot-api'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { toolDefinitions } from '../config/tools.js'
import { executeTool } from '../core/toolExecutor.js'
import User from '../models/User.model.js'
import PendingAction from '../models/PendingAction.model.js'
import ActionLog from '../models/ActionLog.model.js'
import { sendEmail } from '../tools/emailTools.js'

//this is bot.js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `You are a personal AI assistant for a computer science student.
You are helpful, concise and proactive.
You act on behalf of the user autonomously.
When you need information, use the tools available to you.

You can help with anything — answer questions, have conversations, help with code, and also manage emails.

Only check emails when the user explicitly asks about emails.

When classifying emails use these STRICT rules:

🔴 URGENT (only these):
- A real human personally emailed you (not automated)
- Someone is waiting for YOUR reply
- Interview scheduled or interview invite from a real person
- Offer letter or selection result
- Payment due or account issue needing action
- College deadline or exam result

🟡 NORMAL (only these):
- College official announcements
- GitHub notifications about your own repos
- Direct messages from real people that don't need urgent reply

⚪ IGNORE (everything else):
- LinkedIn job alerts and promotional emails
- Internshala newsletters and job digests
- Any email from noreply@ or no-reply@
- Mass automated emails even if they mention internship or job
- OTP, transaction alerts, order confirmations
- Newsletter, digest, weekly roundup emails
- Anything with "unsubscribe" in footer
- Promotional offers

KEY RULE: Just because an email mentions "internship" or "job" does NOT make it urgent.
Only mark URGENT if a real human is personally contacting you and needs a response.

Format emails like:
🔴 *URGENT*
- [Subject] — from [Sender Name]

🟡 *NORMAL*
- [Subject] — from [Sender Name]

Never show IGNORE emails unless asked.
Always end with: "X urgent, X normal, X ignored."`
,

  tools: [{ functionDeclarations: toolDefinitions }]
})

let bot
const conversations = {}

async function chat(chatId, userMessage, userId) {
    if (!conversations[chatId]) {
    conversations[chatId] = model.startChat({ history: [] })
  }

  const chatSession = conversations[chatId]
  let result
  let retries = 3

  while (retries > 0) {
    try {
      result = await chatSession.sendMessage(userMessage)
      break
    } catch (error) {
      if (error.status === 429) {
        console.log('Rate limited, waiting 30s...')
        await new Promise(r => setTimeout(r, 30000))
        retries--
      } else {
        throw error
      }
    }
  }

  while (true) {
    const candidate = result.response.candidates[0]
    const parts = candidate.content.parts
    const toolCallPart = parts.find(p => p.functionCall)

    if (!toolCallPart) {
      return result.response.text()
    }

    const toolName = toolCallPart.functionCall.name
    const toolArgs = toolCallPart.functionCall.args

    console.log(`Gemini calling tool: ${toolName}`)

    const toolResult = await executeTool(toolName, toolArgs, userId)

    console.log(`Tool result:`, toolResult)

    result = await chatSession.sendMessage([{
      functionResponse: {
        name: toolName,
        response: toolResult
      }
    }])
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

  bot.on('polling_error', (error) => {
    console.error('Telegram error:', error.code)
  })

  console.log('Telegram bot started')
}

export function getBot() {
  return bot
}