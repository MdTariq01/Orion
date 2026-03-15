import TelegramBot from 'node-telegram-bot-api'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { toolDefinitions } from '../config/tools.js'
import { executeTool } from '../core/toolExecutor.js'
import User from '../models/User.model.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `You are a personal AI assistant for a computer science student.
You are helpful, concise and proactive.
You act on behalf of the user autonomously.
When you need information, use the tools available to you.

When checking emails, classify each one as:
- URGENT: recruiter emails, interview calls, internship offers, deadline reminders, emails needing a reply
- NORMAL: college emails, project updates, general info
- IGNORE: newsletters, promotions, OTP, transaction alerts, no-reply emails

When showing emails always format exactly like this:

🔴 *URGENT*
- [Subject] — from [Sender Name]

🟡 *NORMAL*
- [Subject] — from [Sender Name]

Never show IGNORE emails unless user asks.
Always end with a summary: "X urgent, X normal, X ignored."`,
  tools: [{ functionDeclarations: toolDefinitions }]
})

let bot
const conversations = {}

async function chat(chatId, userMessage, userId) {
  if (!conversations[chatId]) {
    conversations[chatId] = model.startChat({ history: [] })
  }

  const chatSession = conversations[chatId]
  let result = await chatSession.sendMessage(userMessage)

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

    // pass userId to tool executor
    const toolResult = await executeTool(toolName, toolArgs, userId)

    console.log(`Tool result:`, toolResult)

    result = await chatSession.sendMessage([
      {
        functionResponse: {
          name: toolName,
          response: toolResult
        }
      }
    ])
  }
}

export function startBot() {
  const token = process.env.TELEGRAM_TOKEN
  if (!token) throw new Error('TELEGRAM_TOKEN is missing!')

  bot = new TelegramBot(token, { polling: true })

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
      // get userId from MongoDB using telegramChatId
      const user = await User.findOne({ telegramChatId: String(chatId) })

      if (!user) {
        await bot.sendMessage(chatId, 'Please send /start first to set up your account.')
        return
      }

      const reply = await chat(chatId, text, user.userId)
      await bot.sendMessage(chatId, reply,  { parse_mode: 'Markdown' })
    } catch (error) {
      console.error('Error:', error)
      await bot.sendMessage(chatId, 'Something went wrong.')
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