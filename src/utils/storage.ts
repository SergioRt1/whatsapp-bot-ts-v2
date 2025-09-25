
import {
    putDocument,
    getDocument,
    deleteDocument
} from '../resources/dynamoDB';

/**
 * Saves a plain string under the specified key.
 */
export async function saveString(id: string, data: string): Promise<void> {
    await putDocument(id, data);
}

/**
 * Retrieves a plain string by key, or null if not found.
 */
export async function getString(id: string): Promise<string | null> {
    return await getDocument(id);
}

/**
 * Saves any JSON-serializable data under the specified key.
 */
export async function saveAsJSON(id: string, payload: unknown): Promise<void> {
    const json = JSON.stringify(payload);
    await putDocument(id, json);
}

/**
 * Removes the entry with the specified key.
 */
export async function removeById(id: string): Promise<void> {
    await deleteDocument(id);
}

export async function getJSON<T>(id: string): Promise<T | null> {
  const raw = await getDocument(id);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
