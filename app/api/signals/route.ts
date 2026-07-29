import { NextRequest, NextResponse } from "next/server";

type Candle = { datetime: string; open: number; high: number; low: number; close: number; volume: number };

const symbolMap: Record<string, string> = {
  "EUR/USD": "EUR/USD",
  "GBP/USD": "GBP/USD",
  "USD/JPY": "USD/JPY",
  "EUR/GBP": "EUR/GBP",
  "GC=F": "XAU/USD",
  "SI=F": "XAG/USD",
  "BZ=F": "XBR/USD",
  "NG=F": "XNG/USD",
};

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((result, value, index) => {
    result.push(index ? value * k + result[index - 1] * (1 - k) : value);
    return result;
  }, []);
}

function rsi(values: number[], period = 14) {
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
  const losses = recent.reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}

function atr(candles: Candle[], period = 14) {
  const ranges = candles.slice(1).map((candle, index) => Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - candles[index].close),
    Math.abs(candle.low - candles[index].close)
  ));
  return ranges.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

function sessionMean(candles: Candle[]) {
  const recent = candles.slice(-24);
  const weighted = recent.reduce((sum, candle) => sum + ((candle.high + candle.low + candle.close) / 3) * Math.max(candle.volume, 1), 0);
  const volume = recent.reduce((sum, candle) => sum + Math.max(candle.volume, 1), 0);
  return weighted / volume;
}

async function getSeries(symbol: string, interval: string, apiKey: string, outputsize = 100) {
  const params = new URLSearchParams({ symbol, interval, outputsize: String(outputsize), order: "ASC", apikey: apiKey });
  const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, { next: { revalidate: 60 } });
  const payload = await response.json();
  if (!response.ok || payload.status === "error" || !payload.values) throw new Error(payload.message || "Market series unavailable");
  return (payload.values as Array<Record<string, string>>).map(value => ({
    datetime: value.datetime,
    open: Number(value.open),
    high: Number(value.high),
    low: Number(value.low),
    close: Number(value.close),
    volume: Number(value.volume || 0),
  }));
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TWELVE_DATA_API_KEY is not configured." }, { status: 503 });

  const requested = request.nextUrl.searchParams.get("symbol") || "EUR/USD";
  const interval = request.nextUrl.searchParams.get("interval") || "5min";
  const symbol = symbolMap[requested] || requested;

  try {
    const [entryCandles, confirmationCandles, biasCandles] = await Promise.all([
      getSeries(symbol, interval, apiKey, 100),
      getSeries(symbol, "15min", apiKey, 100),
      getSeries(symbol, "1h", apiKey, 100),
    ]);

    const closes = entryCandles.map(candle => candle.close);
    const entryEma9 = ema(closes, 9);
    const entryEma21 = ema(closes, 21);
    const confirmClose = confirmationCandles.map(candle => candle.close);
    const biasClose = biasCandles.map(candle => candle.close);
    const latest = entryCandles.at(-1)!;
    const currentRsi = rsi(closes);
    const currentAtr = atr(entryCandles);
    const mean = sessionMean(entryCandles);
    const longBias = ema(biasClose, 9).at(-1)! > ema(biasClose, 21).at(-1)!;
    const longConfirm = ema(confirmClose, 9).at(-1)! > ema(confirmClose, 21).at(-1)!;
    const longEntry = latest.close > mean && entryEma9.at(-1)! > entryEma21.at(-1)! && currentRsi >= 52 && currentRsi <= 68;
    const shortEntry = latest.close < mean && entryEma9.at(-1)! < entryEma21.at(-1)! && currentRsi >= 32 && currentRsi <= 48;

    let direction: "LONG" | "SHORT" | "NO TRADE" = "NO TRADE";
    if (longBias && longConfirm && longEntry) direction = "LONG";
    if (!longBias && !longConfirm && shortEntry) direction = "SHORT";

    const risk = currentAtr * 1.2;
    const entry = latest.close;
    const stop = direction === "SHORT" ? entry + risk : entry - risk;
    const target1 = direction === "SHORT" ? entry - risk * 1.5 : entry + risk * 1.5;
    const target2 = direction === "SHORT" ? entry - risk * 2.2 : entry + risk * 2.2;
    const support = Math.min(...entryCandles.slice(-20).map(candle => candle.low));
    const resistance = Math.max(...entryCandles.slice(-20).map(candle => candle.high));
    const reasons = [
      `1-hour trend is ${longBias ? "bullish" : "bearish"} (EMA 9 ${longBias ? "above" : "below"} EMA 21).`,
      `15-minute confirmation is ${longConfirm ? "bullish" : "bearish"}.`,
      `Price is ${latest.close >= mean ? "above" : "below"} the session mean.`,
      `RSI(14) is ${currentRsi.toFixed(1)}, indicating ${currentRsi > 68 ? "overbought conditions" : currentRsi < 32 ? "oversold conditions" : "controlled momentum"}.`,
    ];

    return NextResponse.json({
      symbol, interval, direction, timestamp: latest.datetime,
      candles: entryCandles.slice(-60),
      indicators: {
        ema9: entryEma9.slice(-60),
        ema21: entryEma21.slice(-60),
        sessionMean: mean,
        rsi: currentRsi,
        atr: currentAtr,
        support,
        resistance,
      },
      setup: {
        entry,
        stop,
        target1,
        target2,
        riskReward: direction === "NO TRADE" ? null : 2.2,
        reasons,
        invalidation: direction === "LONG"
          ? `Invalid if a ${interval} candle closes below ${stop}.`
          : direction === "SHORT"
            ? `Invalid if a ${interval} candle closes above ${stop}.`
            : "Wait until the 1-hour trend, 15-minute confirmation, and entry conditions align.",
      },
      disclaimer: "Rules-based market setup for information only; not investment advice.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signal calculation failed." }, { status: 502 });
  }
}
