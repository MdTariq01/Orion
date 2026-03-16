import { google } from "googleapis"
import { getOAuthClient } from "../auth/googleAuth.js"
import User from '../models/User.model.js'
import { v4 as uuidv4 } from 'uuid'
import PendingAction from '../models/PendingAction.model.js'
//this is emailTools.js
async function getGmailClient(userId) {
    const user = await User.findOne({ userId })

    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken
    }) 

      // refresh token if expired
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)

    // save new access token
    await User.findOneAndUpdate(
      { userId },
      { googleAccessToken: credentials.access_token }
    )

    return google.gmail({ 
        version: "v1", 
        auth: oauth2Client
        }) 
}

export async function getEmails(userId , count= 10) {
    try {
        const gmail = await getGmailClient(userId)

        // list of recent emails
        const listResponse = await gmail.users.messages.list({
            userId: "me",
            maxResults: count,
            labelIds: ['INBOX']
        }) 

        const messages = listResponse.data.messages
        if(!messages || messages.length === 0) {
            return {
                emails: [],
                message: "No email found" 
            }
        }

        // details of each mail
        const emails = await Promise.all(
            messages.map(async (msg) => {
                const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date']
                })
                const headers = detail.data.payload.headers
                const from = headers.find(h => h.name === 'From')?.value || 'Unknown'
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject'
                const date = headers.find(h => h.name === 'Date')?.value || 'Unknown date'

                 return {
                    id: msg.id,
                    from,
                    subject,
                    date,
                    snippet: detail.data.snippet
                }
            })
        )
        return { emails }
    } catch (error) {
        console.error('Get emails error:', error)
        return { error: error.message }
    }
}

export async function sendEmail(user, to, subject, body) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    ``,
    body
  ].join('\n')

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  })

  console.log(`Email sent to ${to}`)
}

export async function requestSendEmail(userId, telegramChatId, to, subject, body, context, bot) {
  const actionId = uuidv4()

  // save pending action to MongoDB
  await PendingAction.create({
    actionId,
    userId,
    type: 'send_email',
    payload: { to, subject, body },
    context
  })

  // send approval message with Yes/No buttons
  const message = await bot.sendMessage(
    telegramChatId,
    `📧 *I want to send this email:*\n\n` +
    `*To:* ${to}\n` +
    `*Subject:* ${subject}\n\n` +
    `${body}\n\n` +
    `*Reason:* ${context}\n\n` +
    `Should I send it?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Yes, Send', callback_data: `approve_${actionId}` },
          { text: '❌ No, Cancel', callback_data: `reject_${actionId}` }
        ]]
      }
    }
  )

  // save telegram message id for later editing
  await PendingAction.findOneAndUpdate(
    { actionId },
    { telegramMessageId: message.message_id }
  )

  return {
    status: 'pending_approval',
    message: 'Email approval request sent to user'
  }
}

