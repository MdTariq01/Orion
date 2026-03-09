import 'dotenv/config'
import { connectDB } from './config/db.js'
import { startBot, getBot } from './telegram/bot.js'
import { startAuthServer } from './auth/googleAuth.js'

async function main() {
  console.log('Starting agent...')
  await connectDB()
  startBot()                  // start bot first
  await startAuthServer(getBot())  // then pass bot to auth server
  console.log('Agent is alive.')
}

main()