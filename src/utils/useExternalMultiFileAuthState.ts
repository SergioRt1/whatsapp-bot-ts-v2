import { getString, saveString, removeById } from './storage';
import {
    proto,
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    initAuthCreds,
    BufferJSON,
} from 'baileys';

// Environment key under which credentials are stored
const CREDENTIALS_KEY = process.env.CREDS_ID!;
if (!CREDENTIALS_KEY) {
    throw new Error('Environment variable CREDS_ID must be defined');
}
/**
 * Sanitize a filename to be used as a storage key.
 */
function sanitizeKey(name: string): string {
    return name.replace(/\//g, '__').replace(/:/g, '-');
}

/**
 * Write JSON data to external storage under the given key.
 */
async function writeDataFile(data: unknown, filename: string): Promise<void> {
    const key = sanitizeKey(filename);
    const json = JSON.stringify(data, BufferJSON.replacer);
    await saveString(key, json);
}

/**
 * Read and parse JSON data from external storage by key.
 */
async function readDataFile(filename: string): Promise<any | null> {
    const key = sanitizeKey(filename);
    try {
        const json = await getString(key);
        if (!json) return null;
        return JSON.parse(json, BufferJSON.reviver);
    } catch {
        return null;
    }
}

/**
 * Remove data entry from external storage by key.
 */
async function removeDataFile(filename: string): Promise<void> {
    const key = sanitizeKey(filename);
    try {
        await removeById(key);
    } catch (error: any) {
        console.log('error removing data', error)
    }
}

/**
 * Provides authentication state storing credentials and keys in external storage (DynamoDB).
 */
export async function useExternalMultiFileAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    removeData: () => Promise<void>;
}> {
    console.log('Using external multi-file auth state');

    // Load or initialize credentials
    const creds: AuthenticationCreds = (await readDataFile(CREDENTIALS_KEY)) || initAuthCreds();

    const state: AuthenticationState = {
        creds,
        keys: {
            /**
             * Retrieve signal keys for given category and IDs.
             */
            get: async <KeyType extends keyof SignalDataTypeMap>(
                category: KeyType,
                ids: readonly string[]
            ): Promise<Record<string, SignalDataTypeMap[KeyType]>> => {
                const data: Record<string, SignalDataTypeMap[KeyType]> = {} as any;
                await Promise.all(
                    ids.map(async id => {
                        const file = `${category}-${id}.json`;
                        let value = await readDataFile(file);
                        if (category === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    })
                );
                return data;
            },
            /**
             * Store or delete signal keys in external storage.
             */
            set: async (data): Promise<void> => {
                const tasks: Promise<void>[] = [];
                for (const category in data) {
                    const entries = data[category as KeyType]!;
                    for (const id in entries) {
                        const file = `${category}-${id}.json`;
                        const value = entries[id];
                        tasks.push(
                            value !== undefined
                                ? writeDataFile(value, file)
                                : removeDataFile(file)
                        );
                    }
                }
                await Promise.all(tasks);
            }
        }
    };

    return {
        state,
        saveCreds: async () => writeDataFile(creds, CREDENTIALS_KEY),
        removeData: async () => removeDataFile(CREDENTIALS_KEY),
    };
}
