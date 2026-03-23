import cron from 'node-cron'
import User from '../models/User.model.js'
import { getEmails } from '../tools/emailTools.js'
import { getCurrentTime } from '../tools/systemTools.js'
import { getBot } from '../telegram/bot.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import PendingAction from '../models/PendingAction.model.js'
import ActionLog from '../models/ActionLog.model.js'
import { requestSendEmail } from '../tools/emailTools.js'

const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const brainModel = genAi.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are an autonomous AI agent running a background check for a user.

Your job is to look at the user's current situation and decide if anything needs their attention RIGHT NOW.

You have access to:
- Current time
- Recent emails
- Any pending actions

BE STRICT. Only notify the user if something is genuinely important:
- A real human sent an urgent email that needs a reply
- Something time sensitive is happening today
- A pending action has been waiting too long

If nothing needs attention, respond with exactly: NO_ACTION

If something needs attention, respond with a short Telegram message starting with 🧠

Keep messages under 3 lines. Be specific. Don't be noisy.`
})

async function runBrainForUser(user) {
    try{
       if (!user.googleAccessToken || !user.googleRefreshToken) {
      console.log(`Skipping user ${user.userId} — Gmail not connected`)
      return
    }
        const bot = getBot()
        const time = getCurrentTime()

        const emailData = await getEmails(user.userId , 5)
        const emails = emailData.emails || []

        const pending = await PendingAction.find({
            userId: user.userId,
            status: 'awaiting'
        })

        // build context snapshot
    const context = `
            Current time: ${time.full}

            Recent emails (last 5):
            ${emails.map(e => `- From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`).join('\n')}

            Pending actions waiting for approval: ${pending.length}
            ${pending.map(p => `- ${p.type}: ${JSON.stringify(p.payload)}`).join('\n')}

            User profile: Computer science student looking for internships.`

    const result = await brainModel.generateContent(context)
    const response = result.response.text().trim()

    console.log(`Brain result for ${user.userId}: ${response}`)

    // if nothing needs attention stay quiet
    if (response === 'NO_ACTION') return

    // something needs attention — notify user
    await bot.sendMessage(user.telegramChatId, response)

     // log the proactive action
    await ActionLog.create({
      userId: user.userId,
      action: 'proactive_notification',
      payload: { message: response, context: 'brain_loop' },
      result: { success: true, message: 'Notification sent' },
      approvedBy: 'auto'
    })

    } catch(error) {
         if (error.status === 429) {
      console.log('Quota hit — brain loop pausing')
      throw error // bubble up to stop the loop
    }
    console.error(`Brain loop error for user ${user.userId}:`, error.message)
  }
    }   


export async function startBrainLoop() {
  console.log('Brain loop started — thinking every 300 seconds')

  let lastRunFailed = false

cron.schedule('*/5 * * * *', async () => {
  if (lastRunFailed) {
    console.log('Skipping brain loop — last run hit quota limit')
    lastRunFailed = false
    return
  }

  console.log('Brain loop firing...')
  try {
    const users = await User.find({ isActive: true, gmailConnected: true })
    for (const user of users) {
      await runBrainForUser(user)
    }
  } catch (error) {
    console.error('Brain loop error:', error.message)
    lastRunFailed = true
  }
})
}