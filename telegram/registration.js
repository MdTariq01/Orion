import { v4 as uuidv4 } from 'uuid'
import User from '../models/User.model.js'
import Profile from '../models/Profile.model.js'
import { getAuthUrl } from '../auth/googleAuth.js'

export async function handleStart(bot, msg) {
  const chatId = msg.chat.id
  const telegramChatId = String(chatId)

  try {
    // check if user already exists
    let user = await User.findOne({ telegramChatId })

    if (user) {
      await bot.sendMessage(chatId, `Welcome back! I'm already set up for you.`)
      return
    }

    // create new user
    const userId = uuidv4()

    user = await User.create({
      userId,
      telegramChatId,
      name: msg.from.first_name || 'User'
    })

    // create empty profile
    await Profile.create({ userId })

    console.log(`New user created: ${userId}`)

    // generate Google auth URL for this user
    const authUrl = getAuthUrl(userId)


    await bot.sendMessage(chatId,
      `Welcome! I'm your personal AI assistant.\n\n` +
      `To get started, connect your Gmail account:\n\n` +
      `${authUrl}\n\n` +
      `Click the link, approve access, and I'll be ready to manage your emails.`
    )

  } catch (error) {
    console.error('Registration error:', error)
    await bot.sendMessage(chatId, 'Something went wrong during setup.')
  }
}