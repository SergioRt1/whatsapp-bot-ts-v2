import { getFinancialInfo } from './finances';
import { Boom } from '@hapi/boom';
import {
    WASocket,
    GroupMetadata,
    DisconnectReason,
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
 * @param groupName The name (or partial name) of the target group.
 * @param socketPromise A promise resolving to an active WhatsApp socket.
 * @returns The result of sendMessage or an error status object.
 */
export async function sendMessage(
    groupName: string,
    socketPromise: Promise<WASocket>
): Promise<any> {
    const messagePromise = fetchMessagePayload();
    const socket = await socketPromise;

    // Fetch all participating groups
    const groups = await socket.groupFetchAllParticipating();

    // Find the target group ID and metadata
    const entry = findGroupByName(groups, groupName);
    if (!entry) {
        console.warn(`Group "${groupName}" not found`);
        return { status: 1, error: 'group_not_found' };
    }

    const [groupId, meta] = entry;

    // Build the message payload
    const payload = await messagePromise;
    if (!payload) {
        console.warn('No financial message to send');
        return { status: 1, error: 'no_message' };
    }

    // Send the message and logout
    console.log(`Sending message to ${meta.subject}:`, payload);
    const result = await socket.sendMessage(groupId, payload);

    await waitForBufferedEvents(socket);
    socket.end(new Boom('Intentional Logout', { statusCode: DisconnectReason.loggedOut }));

    return result;
}

/**
 * Waits for all buffered events in the WASocket to be flushed before proceeding.
 * Useful to ensure all pending messages or updates are processed before disconnecting.
 *
 * @param sock The active WASocket instance.
 * @param interval The interval in milliseconds between flush checks. Default is 100ms.
 * @param timeout The maximum time to wait before giving up (in milliseconds). Default is 3000ms.
 */
async function waitForBufferedEvents(sock: WASocket, interval = 100, timeout = 3000) {
    const start = Date.now();
    while (!sock.ev.flush()) {
        if (Date.now() - start > timeout) {
            return;
        }
        await new Promise((res) => setTimeout(res, interval));
    }
}
