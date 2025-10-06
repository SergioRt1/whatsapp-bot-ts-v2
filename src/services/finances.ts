import { getString, saveString } from '../utils/storage';
import { getLatest, ExchangeRates } from '../repositories/finances';
import { appendFx } from '../math/history';
import { scoreFavorability, Favorability } from '../math/scoring';

const CURRENCIES = ['COP', 'MXN', 'EUR'];
const BASE_CURRENCY = 'USD';
const PREVIOUS_RATES_KEY = 'financesInformationID';


type Conversion = {
  id: string;                 // "USD->COP"
  base: string;               // "USD"
  quote: string;              // "COP"
  compute: (rates: Record<string, number>) => number | undefined; // return rate for base->quote
  sell: boolean;
};

/** 
 * Since the API returns USD-based rates (USD->X),
 * this helper generates a consistent compute(base, quote) for any pair.
 */
function computeFromUsd(base: string, quote: string) {
  return (rates: Record<string, number>): number | undefined => {
    // b = USD->base ; q = USD->quote
    const b = base === 'USD' ? 1 : rates[base];
    const q = quote === 'USD' ? 1 : rates[quote];
    if (!b || !q) return undefined;
    // (USD->quote) / (USD->base) = base->quote
    return q / b;
  };
}

const PAIRS: Conversion[] = [
  { id: 'USD->COP', base: 'USD', quote: 'COP', compute: computeFromUsd('USD', 'COP'), sell: true },
  { id: 'USD->MXN', base: 'USD', quote: 'MXN', compute: computeFromUsd('USD', 'MXN'), sell: true },
  { id: 'EUR->COP', base: 'EUR', quote: 'COP', compute: computeFromUsd('EUR', 'COP'), sell: false },
];

/**
 * Fetches the latest exchange rates for the base and target currencies.
 */
async function fetchLatestRates(): Promise<ExchangeRates | undefined> {
    return await getLatest(BASE_CURRENCY, CURRENCIES);
}

/**
 * Loads the previously saved exchange rates from storage.
 */
async function loadPreviousRates(): Promise<ExchangeRates | undefined> {
    try {
        const json = await getString(PREVIOUS_RATES_KEY);
        if (json) {
            return JSON.parse(json) as ExchangeRates;
        }
    } catch {
        return undefined;
    }
}

/**
 * Saves the current exchange rates to storage.
 */
async function saveRates(rates: ExchangeRates): Promise<void> {
    await saveString(PREVIOUS_RATES_KEY, JSON.stringify(rates));
}

function trendGlyph(t?: 'up' | 'down' | 'flat') {
  return t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
}
function sign(n: number) { return n >= 0 ? '+' : ''; }


/**
 * Builds a rich line with TRM + favorability to buy/sell the *base* of the pair.
 * Format: "<BASE>→<QUOTE> <rate> (±Δ) SELL xx% z"
 * E.g:    EUR→COP *4354.12* (+18.22) SELL 73% +1.20σ↑
 */
function formatLine(pair: Conversion, current: number, score: Favorability, previous?: number) {
  const delta = previous !== undefined ? current - previous : undefined;
  const deltaStr = delta === undefined ? '' : `(${sign(delta)}${delta.toFixed(2)})`;
  const zStr = `${sign(score.zscore)}${score.zscore.toFixed(2)}σ ${trendGlyph(score.trend)}`;
  const scoreStr = pair.sell ? `SELL ${score.sellerScore}% ${score.sellerLabel}` : `BUY ${score.buyerScore}% ${score.buyerLabel}`;

  return `${pair.base}→${pair.quote} *${current.toFixed(2)}* ${deltaStr} · ${scoreStr} · ${zStr}`;
}

/**
 * Retrieves and formats the financial information as a multi-line string.
 * @returns A string with exchange rate updates or undefined if unavailable.
 */
export async function getFinancialInfo(): Promise<string | undefined> {
  const latest = await fetchLatestRates();
  if (!latest) return undefined;

  const previous = await loadPreviousRates();
  await saveRates(latest);

  const lines: string[] = [];

  for (const pair of PAIRS) {
    const current = pair.compute(latest.rates);
    if (current === undefined) continue;

    const prev = previous ? pair.compute(previous.rates) : undefined;

    const nowIso = new Date().toISOString();
    const doc = await appendFx(pair.id, { ts: nowIso, rate: current });

    const series = doc.samples.map(s => s.rate);
    const sc = scoreFavorability(series);

    lines.push(
      formatLine(
        pair,
        current,
        sc,
        prev,
      )
    );
  }

  return lines.join('\n');
}
