import yahooFinance from "yahoo-finance2";

export interface PriceRecord {
  date: string; // YYYY-MM-DD
  close: number;
}

/**
 * Fetch daily closing prices for a ticker.
 * Includes a 30-day buffer before startDate for volatility calculation lookback.
 */
export async function fetchPrices(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<PriceRecord[]> {
  const bufferStart = new Date(startDate);
  bufferStart.setDate(bufferStart.getDate() - 30);

  const result = await yahooFinance.historical(ticker, {
    period1: bufferStart.toISOString().slice(0, 10),
    period2: endDate,
    interval: "1d",
  });

  return result
    .filter((row) => row.close != null)
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      close: row.close!,
    }));
}
