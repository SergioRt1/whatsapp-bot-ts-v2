import makeWASocket, {
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    useMultiFileAuthState,
} from 'baileys';
import pino from 'pino';
import NodeCache from 'node-cache';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { useExternalMultiFileAuthState } from '../utils/useExternalMultiFileAuthState';

const msgRetryCounterCache = new NodeCache();

const useExternalStorage = process.env.EXTERNAL_STORAGE_ENABLED === 'true'

/**
 * Starts and returns a WhatsApp socket connection using Baileys.
 */
export async function startSock() {
    const logger = pino({
        timestamp: () => `,"time":"${new Date().toJSON()}"`
    });
    logger.level = 'info';

    const authState = useExternalStorage
        ? await useExternalMultiFileAuthState()
        : await useMultiFileAuthState('auth_info_baileys');

    // Load authentication state (credentials and keys)
    const { state, saveCreds } = await authState;

    // Fetch the latest supported WA Web version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version ${version.join('.')}, isLatest: ${isLatest}`);

    // Create the socket connection
    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        msgRetryCounterCache,
        markOnlineOnConnect: false,            // Don't mark the device as online
        shouldSyncHistoryMessage: () => true,  // Enable history sync to avoid sync issues
        fireInitQueries: true,                 // Send presence or other init queries
        keepAliveIntervalMs: 5_000,            // Reduce ping-pong wait time            
        linkPreviewImageThumbnailWidth: 32,    // Lower resource usage
        syncFullHistory: false,                // No sync needed for one-shot
        generateHighQualityLinkPreview: false, // Faster, lighter message send
        emitOwnEvents: true,                  
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Save group metadata updates
    sock.ev.on('groups.update', updates => {
        //updates.forEach(meta => saveCachedGroupMetadata(meta.id, meta)); // if needed
    });

    // Handle connection updates
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('⏳ QR code received');
            qrcode.generate(qr, { small: true });
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp');
        } else if (
            connection === 'close' &&
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
        ) {
            console.log('⚠️ Connection closed unexpectedly, reconnecting...');
            await startSock();
        }
    });

    // Wait for connection to open
    await sock.waitForConnectionUpdate((state) => {
        if (state.isOnline || state.connection === 'open') {
            console.log('✅ Connected to WhatsApp Final validation.');
        } else {
            console.log('⏳ Connection check to WhatsApp failed.');
        }

        return Promise.resolve(state.isOnline || state.connection === 'open')
    });

    return sock;
}
