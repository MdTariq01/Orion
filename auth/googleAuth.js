import { google } from 'googleapis'
import express from 'express'
import User from '../models/User.model.js'

const app = express()

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(userId) {
  const oauth2Client = getOAuthClient()

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
  ]

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId
  })

  return url
}

export function startAuthServer(bot) {
  return new Promise((resolve) => {
    app.get('/auth/callback', async (req, res) => {
      const { code, state: userId } = req.query

      try {
        const oauth2Client = getOAuthClient()
        const { tokens } = await oauth2Client.getToken(code)

        await User.findOneAndUpdate(
          { userId },
          {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token,
            gmailConnected: true
          }
        )

        console.log(`Gmail connected for user: ${userId}`)

        const user = await User.findOne({ userId })
        await bot.sendMessage(
          user.telegramChatId,
          '✅ Gmail connected successfully! I can now read and send emails on your behalf.'
        )

        res.send('Gmail connected! You can close this tab and go back to Telegram.')

      } catch (error) {
        console.error('OAuth error:', error)
        res.send('Something went wrong. Please try again.')
      }
    })

    app.listen(process.env.PORT, () => {
      console.log(`Auth server running on port ${process.env.PORT}`)
      resolve()
    })
  })
}