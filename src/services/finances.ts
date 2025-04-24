import { getString, saveString } from '../utils/storage';
import { getLatest, ExchangeRates } from '../repositories/finances';

const CURRENCIES = ['COP', 'MXN', 'EUR'];
const BASE_CURRENCY = 'USD';
const PREVIOUS_RATES_KEY = 'financesInformationID';

type Conversion = {
    base: string;
    to: string;
    convert: (rates: Record<string, number>) => number;
};

const CUSTOM_CONVERSIONS: Record<string, Conversion> = {
    EUR: {
        base: 'EUR',
        to: 'COP',
        convert: rates => rates['COP'] / rates['EUR']
    }
};

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

/**
 * Computes the delta string and icon between current and previous values.
 */
function computeDelta(current: number, previous?: number): string {
    if (previous === undefined) {
        return '';
    }
    const diff = (current - previous).toFixed(3);
    const icon = current > previous ? '📈' : current < previous ? '📉' : '🟰';
    return ` (${diff}) ${icon}`;
}

/**
 * Formats each currency rate line, applying custom conversions if defined.
 */
function formatRateLines(
    rates: Record<string, number>,
    previousRates?: Record<string, number>
): string[] {
    return Object.entries(rates).map(([symbol, rate]) => {
        if (CUSTOM_CONVERSIONS[symbol]) {
            const conv = CUSTOM_CONVERSIONS[symbol];
            const current = conv.convert(rates);
            const previous = previousRates ? conv.convert(previousRates) : undefined;

            return `TRM ${conv.base}->${conv.to} *${current.toFixed(2)}*${computeDelta(current, previous)}`;
        }
        const previous = previousRates ? previousRates[symbol] : undefined;

        return `TRM ${BASE_CURRENCY}->${symbol} *${rate.toFixed(2)}*${computeDelta(rate, previous)}`;
    });
}

/**
 * Retrieves and formats the financial information as a multi-line string.
 * @returns A string with exchange rate updates or undefined if unavailable.
 */
export async function getFinancialInfo(): Promise<string | undefined> {
    const latestRates = await fetchLatestRates();
    if (!latestRates) {
        return undefined;
    }

    const previous = await loadPreviousRates();
    await saveRates(latestRates);

    const lines = formatRateLines(latestRates.rates, previous?.rates);
    return lines.join('\n');
}
