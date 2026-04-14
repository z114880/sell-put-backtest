import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

export interface PriceRecord {
  date: string; // YYYY-MM-DD
  close: number;
}

function getAgent(): https.Agent | undefined {
  const proxy =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;
  if (proxy) {
    return new HttpsProxyAgent(proxy);
  }
  return undefined;
}

function toEpoch(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function httpsGet(url: string, agent?: https.Agent): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        ...(agent ? { agent } : {}),
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(res.headers.location, agent).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
  });
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error: { description: string } | null;
  };
}

/**
 * Fetch daily closing prices for a ticker from Yahoo Finance chart API.
 * Includes a 30-day buffer before startDate for volatility calculation lookback.
 * Automatically uses HTTP proxy if configured via environment variables.
 */
export async function fetchPrices(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<PriceRecord[]> {
  const bufferStart = new Date(startDate);
  bufferStart.setDate(bufferStart.getDate() - 30);

  const period1 = toEpoch(bufferStart.toISOString().slice(0, 10));
  const period2 = toEpoch(endDate);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  const agent = getAgent();
  const body = await httpsGet(url, agent);

  let data: YahooChartResponse;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Yahoo Finance returned invalid JSON: ${body.slice(0, 200)}`);
  }

  if (data.chart.error) {
    throw new Error(`Yahoo Finance: ${data.chart.error.description}`);
  }

  const result = data.chart.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`No data returned for ${ticker}`);
  }

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;

  const records: PriceRecord[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close != null) {
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      records.push({ date, close });
    }
  }

  return records;
}
