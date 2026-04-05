type SupportedCurrency = "STX" | "sBTC" | "USDCx";

type ExchangeRates = {
  STX_USD: number;
  sBTC_USD: number;
  USDC_USD: number;
};

let cachedRates: ExchangeRates | null = null;
let lastFetchTime = 0;

const CACHE_DURATION = 5 * 60 * 1000;

function normalizeRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const fallbackRates: ExchangeRates = {
  STX_USD: normalizeRate(process.env.STX_USD_FALLBACK, 0),
  sBTC_USD: normalizeRate(process.env.SBTC_USD_FALLBACK, 0),
  USDC_USD: normalizeRate(process.env.USDCX_USD_FALLBACK, 1),
};

export const currencyService = {
  async getExchangeRates(): Promise<ExchangeRates> {
    const now = Date.now();

    if (cachedRates && now - lastFetchTime < CACHE_DURATION) {
      return cachedRates;
    }

    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=blockstack,bitcoin&vs_currencies=usd", {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Exchange rate request failed with status ${response.status}`);
      }

      const data = await response.json();
      const rates: ExchangeRates = {
        STX_USD: Number(data?.blockstack?.usd) || fallbackRates.STX_USD,
        sBTC_USD: Number(data?.bitcoin?.usd) || fallbackRates.sBTC_USD,
        USDC_USD: fallbackRates.USDC_USD,
      };

      cachedRates = rates;
      lastFetchTime = now;
      return rates;
    } catch (error) {
      console.error("Failed to fetch exchange rates:", error);
      return fallbackRates;
    }
  },

  async getUsdValue(amount: number, currency: SupportedCurrency): Promise<number> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const rates = await this.getExchangeRates();

    switch (currency) {
      case "STX":
        return amount * rates.STX_USD;
      case "sBTC":
        return amount * rates.sBTC_USD;
      case "USDCx":
        return amount * rates.USDC_USD;
      default:
        return 0;
    }
  },
};
