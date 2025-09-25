import { getFinancialInfo } from './finances';
import { Boom } from '@hapi/boom';
import {
    WASocket,
    GroupMetadata,
    DisconnectReason,
    WAMessageUpdate,
    proto,
} from 'baileys';

/**
 * Fetches the financial information and formats it as a message payload.
 * @returns An object with a text property or undefined if no info is available.
 */
async function fetchMessagePayload(): Promise<{ text: string } | undefined> {
    const info = await getFinancialInfo();
    if (!info) {
        return undefined;
    }
    return { text: info };
}

/**
 * Searches for a group by name (case-insensitive) in the provided group metadata.
 * @returns A tuple [groupId, metadata] or undefined if not found.
 */
function findGroupByName(
    groups: Record<string, GroupMetadata>,
    targetName: string
): [string, GroupMetadata] | undefined {
    const lowerTarget = targetName.toLowerCase();
    return Object.entries(groups).find(([, meta]) =>
        meta.subject?.toLowerCase().includes(lowerTarget)
    );
}

/**
 * Sends a financial update message to the specified WhatsApp group.
 * @param groupId The jid of the target group.
 * @param socketPromise A promise resolving to an active WhatsApp socket.
 * @returns The result of sendMessage or an error status object.
 */
export async function sendMessage(
    groupId: string,
    socketPromise: Promise<WASocket>
): Promise<any> {
    const messagePromise = fetchMessagePayload();
    const socket = await socketPromise;

    // Build the message payload
    const payload = await messagePromise;
    if (!payload) {
        console.warn('No financial message to send');
        return { status: 1, error: 'no_message' };
    }

    // Send the message and logout
    console.log(`Sending message to ${groupId}:`, payload);
    const result = await socket.sendMessage(groupId, payload);
    
    // Wait for message delivery
    if (result) {
        const messageId = result.key.id!;
        try {
            console.log('⏳ Waiting for message delivery ACK');
            const finalStatus = await waitForMessageSend(socket, messageId);
            console.log(`✅ Message delivered with status ${finalStatus}`);
        } catch (err: any) {
            console.warn('❌ Timed out waiting for delivery:', err.message);
        }
    }

    await waitForBufferedEvents(socket);
    socket.end(new Boom('Intentional End', { statusCode: DisconnectReason.loggedOut }));

    return result;
}

/**
 * Waits for “messages.update” event where status ≥ 2 (SERVER_ACK).
 * @param sock The WASocket instance 
 * @param messageId The string ID from result.key.id
 * @param timeoutMs How long to wait (ms) before bailing out
 */
async function waitForMessageSend(
    sock: WASocket,
    messageId: string,
    timeoutMs = 20_000
  ): Promise<number> {
    return new Promise((resolve, reject) => {
        let timer: NodeJS.Timeout;
  
        // define the update handler
        const onUpdate = async (updates: WAMessageUpdate[]) => {
            for (const upd of updates) {
                const id = upd.key?.id;
                const status = upd.update?.status;
                if (id === messageId && status && status >= proto.WebMessageInfo.Status.SERVER_ACK) {
                    clearTimeout(timer);
                    sock.ev.off('messages.update', onUpdate);
                    resolve(status);
                    return;
                }
            }
        };
  
        sock.ev.on('messages.update', onUpdate);
    
        timer = setTimeout(() => {
            sock.ev.off('messages.update', onUpdate);
            reject(new Error('Timed out waiting for message delivery update'));
        }, timeoutMs);
    });
}

/**
 * Waits for all buffered events in the WASocket to be flushed before proceeding.
 * Useful to ensure all pending messages or updates are processed before disconnecting.
 *
 * @param sock The active WASocket instance.
 * @param interval The interval in milliseconds between flush checks. Default is 100ms.
 * @param timeout The maximum time to wait before giving up (in milliseconds).
 */
async function waitForBufferedEvents(sock: WASocket, interval = 100, timeout = 15000) {
    const start = Date.now();
    while (!sock.ev.flush()) {
        if (Date.now() - start > timeout) {
            console.warn('Timeout while waiting for events, ending anyways 🤔');
            return;
        }
        await new Promise((res) => setTimeout(res, interval));
    }
    console.log('All events flushed; safe to disconnect. 👋');
}
