import 'dotenv/config'
import { startBot } from './telegram/bot.js'

async function main() {
  console.log('Starting agent...')
  startBot()
  console.log('Agent is alive.')
}

main()