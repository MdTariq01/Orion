import { google } from "googleapis"
import { getOAuthClient } from "../auth/googleAuth"
import User from './models/User.model.js'

async function getGmailClient(userId) {
    const user = await User.findOne({ userId })

    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken
    }) 

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

export async function sendEmail(userId, to, subject, body) {
  try {
    const gmail = await getGmailClient(userId)

    // create email in base64 format
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n')

    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail }
    })

    return { success: true, message: `Email sent to ${to}` }

    } catch (error) {
    console.error('Send email error:', error)
    return { error: error.message }
  }
}