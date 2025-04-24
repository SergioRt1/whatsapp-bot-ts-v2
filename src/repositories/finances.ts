import { instance } from '../resources/axios';

const EXCHANGE_RATES_BASE_URL = 'https://api.apilayer.com/exchangerates_data';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Structure of the API response for exchange rates.
 */
export interface ExchangeRates {
    base: string;
    success: boolean;
    date: string;
    rates: Record<string, number>;
}

/**
 * Builds the URL for fetching latest exchange rates.
 * @param base Base currency code (e.g. 'USD').
 * @param symbols Array of target currency codes.
 * @returns The complete URL string.
 */
function buildLatestRatesUrl(base: string, symbols: string[]): string {
    const params = new URLSearchParams({
        base,
        symbols: symbols.join(',')
    });
    return `${EXCHANGE_RATES_BASE_URL}/latest?${params.toString()}`;
}

/**
 * Fetches the latest exchange rates from the external API.
 * @param base Base currency code.
 * @param currencies Array of target currency codes.
 * @returns ExchangeRates object or undefined on failure.
 */
async function fetchLatestRates(
    base: string,
    currencies: string[]
): Promise<ExchangeRates | undefined> {
    const url = buildLatestRatesUrl(base, currencies);
    try {
        const response = await instance.get<ExchangeRates>(url, {
            timeout: DEFAULT_TIMEOUT_MS
        });

        if (response.status === 200 && response.data.success) {
            return response.data;
        }

        console.warn(
            `⚠️ Unexpected response when fetching rates for ${base}: ${response.status}`
        );
    } catch (error: any) {
        console.error(
            `❌ Error fetching latest rates for ${base}:`,
            error.message || error
        );
    }
    return undefined;
}

/**
 * Public API: get the latest exchange rates or undefined if the request fails.
 * @param base Base currency code.
 * @param currencies Array of target currency codes.
 */
export async function getLatest(
    base: string,
    currencies: string[]
): Promise<ExchangeRates | undefined> {
    if (!base) {
        console.error('Base currency must be provided');
        return undefined;
    }
    if (!Array.isArray(currencies) || currencies.length === 0) {
        console.error('At least one target currency must be provided');
        return undefined;
    }
    return await fetchLatestRates(base, currencies);
}
