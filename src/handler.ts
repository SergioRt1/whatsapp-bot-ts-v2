import 'dotenv/config'

import { startSock } from './api/whatsApp'
import { sendMessage } from './services/whatsApp'

const GROUP = process.env.GROUP_NAME!
if (!GROUP) {
    throw new Error('Environment variable GROUP_NAME must be defined');
}

const sockPromise = startSock()

// Run with: serverless invoke local --function cronHandler
export const run = async (_event, context) => {
  try {
    const result = await sendMessage(GROUP, sockPromise)
    console.log('Submission result:', result)
  } catch (err) {
    console.error('Error in run():', err)
  }
}
