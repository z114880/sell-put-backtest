function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

export function historicalVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    logReturns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    (logReturns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252);
}

export function bsPutPrice(
  spotPrice: number,
  riskFreeRate: number,
  sigma: number,
  T: number,
  strikePrice?: number
): number {
  const K = strikePrice ?? spotPrice; // ATM if no strike given
  if (T <= 0) return Math.max(K - spotPrice, 0);
  if (sigma === 0) return Math.max(K * Math.exp(-riskFreeRate * T) - spotPrice, 0);

  const S = spotPrice;
  const r = riskFreeRate;
  const sqrtT = Math.sqrt(T);

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

// Put delta = N(d1) - 1  (always negative for puts)
export function bsPutDelta(
  spotPrice: number,
  strikePrice: number,
  riskFreeRate: number,
  sigma: number,
  T: number
): number {
  if (sigma === 0 || T <= 0) return strikePrice >= spotPrice ? -1 : 0;
  const d1 =
    (Math.log(spotPrice / strikePrice) +
      (riskFreeRate + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));
  return normalCDF(d1) - 1;
}

// Find the strike that produces a target put delta (given as negative, e.g. -0.30).
// Uses bisection over [0.5*S, 1.5*S].
export function findStrikeForDelta(
  spotPrice: number,
  riskFreeRate: number,
  sigma: number,
  T: number,
  targetDelta: number // negative, e.g. -0.30
): number {
  // Put delta is monotonically decreasing as K increases (more ITM → delta → -1)
  // Low K → delta near 0; High K → delta near -1
  let lo = spotPrice * 0.5;
  let hi = spotPrice * 1.5;

  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const delta = bsPutDelta(spotPrice, mid, riskFreeRate, sigma, T);
    if (Math.abs(delta - targetDelta) < 1e-6) return mid;
    if (delta > targetDelta) {
      // delta is less negative than target → need higher strike
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
