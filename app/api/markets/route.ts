import { NextResponse } from "next/server";

const symbols = [
  ["EURUSD=X", "EUR/USD", "Euro / US Dollar", "Forex", 4],
  ["GBPUSD=X", "GBP/USD", "British Pound / US Dollar", "Forex", 4],
  ["JPY=X", "USD/JPY", "US Dollar / Japanese Yen", "Forex", 2],
  ["EURGBP=X", "EUR/GBP", "Euro / British Pound", "Forex", 4],
  ["GC=F", "GC=F", "Gold", "Commodities", 1],
  ["SI=F", "SI=F", "Silver", "Commodities", 2],
  ["BZ=F", "BZ=F", "Brent Crude", "Commodities", 2],
  ["NG=F", "NG=F", "Natural Gas", "Commodities", 2]
] as const;

export async function GET() {
  try {
    const instruments = await Promise.all(symbols.map(async ([query, symbol, name, group, decimals]) => {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(query)}?range=1mo&interval=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 900 }
      });
      if (!response.ok) throw new Error("feed unavailable");
      const payload = await response.json();
      const result = payload.chart?.result?.[0];
      const price = result?.meta?.regularMarketPrice;
      const previous = result?.meta?.chartPreviousClose;
      const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter((value: unknown): value is number => typeof value === "number");
      if (!price || !previous) throw new Error("incomplete feed");
      const min = Math.min(...closes);
      const spread = Math.max(Math.max(...closes) - min, 0.0001);
      return {
        symbol, name, group, decimals, price,
        change: ((price - previous) / previous) * 100,
        unit: group === "Commodities" ? "$" : undefined,
        points: closes.slice(-12).map((value) => Math.round(((value - min) / spread) * 32 + 25))
      };
    }));
    return NextResponse.json({ instruments, status: "Market feed · refreshed every 15 min" });
  } catch {
    return NextResponse.json({ instruments: [], status: "Indicative preview · live feed unavailable" });
  }
}
