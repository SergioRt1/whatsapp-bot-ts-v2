import { getJSON, saveAsJSON } from '../utils/storage';

export interface FxSample { ts: string; rate: number; }
export interface FxHistoryDoc {
  pair: string; // e.g. "USD->COP"
  updatedAt: string;
  samples: FxSample[]; // asendign by time
}

const HISTORY_MAX = parseInt(process.env.FX_HISTORY_MAX_SAMPLES ?? '400', 10);
const MIN_GAP_MS = 60 * 60 * 1000 // 1h

export async function loadFx(pairId: string): Promise<FxHistoryDoc> {
  const id = `fx:${pairId}`;
  const doc = await getJSON<FxHistoryDoc>(id);
  return doc ?? { pair: pairId, updatedAt: '', samples: [] };
}

export async function appendFx(pairId: string, sample: FxSample): Promise<FxHistoryDoc> {
  const id = `fx:${pairId}`;
  const doc = await loadFx(pairId);

  const last = doc.samples.at(-1);
  if (!last || Math.abs(new Date(sample.ts).getTime() - new Date(last.ts).getTime()) > MIN_GAP_MS) {
    doc.samples.push(sample);
    if (doc.samples.length > HISTORY_MAX) {
      doc.samples = doc.samples.slice(-HISTORY_MAX);
    }
  }
  doc.updatedAt = sample.ts;
  await saveAsJSON(id, doc);
  return doc;
}
