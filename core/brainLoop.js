import cron from 'node-cron'
import User from '../models/User.model.js'
import { getEmails } from '../tools/emailTools.js'
import { getCalendarEvents, getTasks } from '../tools/calendarTools.js'
import { getCurrentTime } from '../tools/systemTools.js'
import { getBot } from '../telegram/bot.js'
import { Ollama } from 'ollama'
import PendingAction from '../models/PendingAction.model.js'
import ActionLog from '../models/ActionLog.model.js'

const ollama = new Ollama({ host: 'http://localhost:11434' })

const BRAIN_PROMPT = `You are an autonomous AI agent running a background check for a user.

Your job is to look at the user's current situation and decide if anything needs their attention RIGHT NOW.

You have access to:
- Current time
- Recent emails
- Upcoming calendar events
- Pending tasks
- Any pending actions awaiting approval

BE STRICT. Only notify the user if something is genuinely important:
- A real human sent an urgent email that needs a reply
- A calendar event is happening today or tomorrow
- An email and a calendar event are related (e.g. interview email + interview on calendar)
- A task is overdue or due today
- A pending action has been waiting too long

If nothing needs attention, respond with exactly: NO_ACTION

If something needs attention, respond with a short Telegram message starting with 🧠

Keep messages under 3 lines. Be specific. Don't be noisy.

Talk directly to the user like a person, not like a summary report.

Cross-reference emails and calendar when possible — this is where you add real value.`

function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

async function runBrainForUser(user) {
  try {
    if (!user.googleAccessToken || !user.googleRefreshToken) {
      console.log(`Skipping user ${user.userId} — no Google account connected`)
      return
    }

    const bot = getBot()
    const time = getCurrentTime()

    const [emailData, calendarData, tasksData] = await Promise.all([
      user.gmailConnected ? getEmails(user.userId, 5) : Promise.resolve({ emails: [] }),
      user.googleAccessToken ? getCalendarEvents(user.userId, 3, 10) : Promise.resolve({ events: [] }),
      user.googleAccessToken ? getTasks(user.userId, 10) : Promise.resolve({ tasks: [] })
    ])

    const emails = emailData.emails || []
    const events = calendarData.events || []
    const tasks = tasksData.tasks || []

    const pending = await PendingAction.find({ userId: user.userId, status: 'awaiting' })

    const context = `
Current time: ${time.full}

Recent emails (last 5):
${emails.length > 0
  ? emails.map(e => `- From: ${e.from} | Email: ${e.fromEmail} | Subject: ${e.subject} | Snippet: ${e.snippet}`).join('\n')
  : '- No recent emails'}

Upcoming calendar events (next 3 days):
${events.length > 0
  ? events.map(e => `- ${e.title} | ${e.start}${e.location ? ' | Location: ' + e.location : ''}`).join('\n')
  : '- No upcoming events'}

Pending tasks:
${tasks.length > 0
  ? tasks.map(t => `- [${t.listName}] ${t.title}${t.due ? ' | Due: ' + t.due : ''}`).join('\n')
  : '- No pending tasks'}

Pending actions waiting for approval: ${pending.length}
${pending.length > 0
  ? pending.map(p => `- ${p.type}: ${JSON.stringify(p.payload)}`).join('\n')
  : ''}

User profile: Computer science student looking for internships.`

    // ── LATENCY: Ollama brain inference ──
    const brainStart = Date.now()
    const result = await ollama.chat({
      model: 'qwen3:1.7b',
      messages: [
        { role: 'system', content: BRAIN_PROMPT },
        { role: 'user', content: context }
      ],
      stream: false
    })
    console.log(`[LATENCY] brain_llm=${Date.now() - brainStart}ms`)

    const response = stripThinkTags(result.message.content)
    console.log(`Brain result for ${user.userId}: ${response}`)

    const lower = response.toLowerCase()
    if (
      lower.includes('no_action') ||
      lower.includes('no action needed') ||
      lower.includes('nothing needs') ||
      lower.includes('no urgent') ||
      !response.includes('🧠')
    ) return

    await bot.sendMessage(user.telegramChatId, response)

    await ActionLog.create({
      userId: user.userId,
      action: 'proactive_notification',
      payload: { message: response, context: 'brain_loop' },
      result: { success: true, message: 'Notification sent' },
      approvedBy: 'auto'
    })

  } catch (error) {
    if (error.status === 429) {
      console.log('Quota hit — brain loop pausing')
      throw error
    }
    console.error(`Brain loop error for user ${user.userId}:`, error.message)
  }
}

export async function startBrainLoop() {
  console.log('Brain loop started — thinking every 300 seconds')

  let lastRunFailed = false
  // ── LATENCY: cron interval precision ──
  let lastTick = null

  cron.schedule('*/5 * * * *', async () => {
    const now = Date.now()
    if (lastTick) console.log(`[LATENCY] cron_interval=${now - lastTick}ms`)
    lastTick = now

    if (lastRunFailed) {
      console.log('Skipping brain loop — last run hit quota limit')
      lastRunFailed = false
      return
    }

    console.log('Brain loop firing...')
    try {
      const users = await User.find({ isActive: true })
      for (const user of users) {
        await runBrainForUser(user)
      }
    } catch (error) {
      console.error('Brain loop error:', error.message)
      lastRunFailed = true
    }
  })
}