import 'dotenv/config'

import { startSock } from './api/whatsApp'
import { sendMessage } from './services/whatsApp'

const GROUP_ID = process.env.GROUP_NAME!
if (!GROUP_ID) {
    throw new Error('Environment variable GROUP_NAME must be defined');
}


// Run with: serverless invoke local --function cronHandler
export const run = async (_event, context) => {
    try {
      const sockPromise = startSock()
      const result = await sendMessage(GROUP_ID, sockPromise)
      console.log('Submission result:', result)
    } catch (err) {
      console.error('Error in run():', err)
    }
}
