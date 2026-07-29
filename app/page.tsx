"use client";

import { useEffect, useState } from "react";

type Instrument = { symbol: string; name: string; price: number; change: number; unit?: string; decimals: number; points: number[]; group: "Forex" | "Commodities" };
type SignalData = {
  symbol: string;
  interval: string;
  direction: "LONG" | "SHORT" | "NO TRADE";
  timestamp: string;
  candles: Array<{ datetime: string; open: number; high: number; low: number; close: number; volume: number }>;
  indicators: { ema9: number[]; ema21: number[]; sessionMean: number; rsi: number; atr: number; support: number; resistance: number };
  setup: { entry: number; stop: number; target1: number; target2: number; riskReward: number | null; reasons: string[]; invalidation: string };
};

const seed: Instrument[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", price: 1.1542, change: .24, decimals: 4, group: "Forex", points: [31,34,30,37,33,38,41,39,45,48,43,50] },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", price: 1.3368, change: -.12, decimals: 4, group: "Forex", points: [52,49,51,45,47,43,46,42,44,39,41,38] },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", price: 148.57, change: .31, decimals: 2, group: "Forex", points: [35,37,36,40,43,41,46,45,49,51,50,55] },
  { symbol: "EUR/GBP", name: "Euro / British Pound", price: .8634, change: .08, decimals: 4, group: "Forex", points: [42,39,41,40,44,43,45,42,46,44,48,49] },
  { symbol: "GC=F", name: "Gold", price: 3327.4, change: .62, unit: "$", decimals: 1, group: "Commodities", points: [31,33,36,35,39,42,41,46,49,47,51,53] },
  { symbol: "SI=F", name: "Silver", price: 38.16, change: .45, unit: "$", decimals: 2, group: "Commodities", points: [28,31,30,34,37,36,40,43,41,45,47,49] },
  { symbol: "BZ=F", name: "Brent Crude", price: 71.38, change: -.28, unit: "$", decimals: 2, group: "Commodities", points: [55,52,54,49,51,47,46,43,45,40,41,38] },
  { symbol: "NG=F", name: "Natural Gas", price: 3.08, change: 1.12, unit: "$", decimals: 2, group: "Commodities", points: [25,29,27,34,32,39,37,43,45,42,49,55] }
];

const news = [
  ["10:20", "FX", "Dollar steadies as markets assess the next rate path", "Reuters Markets", "https://www.reuters.com/markets/"],
  ["09:45", "METALS", "Gold holds firm as investors balance yields and risk", "CNBC Markets", "https://www.cnbc.com/markets/"],
  ["08:30", "ENERGY", "Oil traders focus on supply signals and demand outlook", "Reuters Commodities", "https://www.reuters.com/markets/commodities/"],
  ["07:55", "MACRO", "European data keeps attention on central-bank guidance", "ECB", "https://www.ecb.europa.eu/press/html/index.en.html"]
];

function path(points: number[], width: number, height: number) {
  const min = Math.min(...points), max = Math.max(...points);
  return points.map((point, i) => `${i ? "L" : "M"} ${(i / (points.length - 1) * width).toFixed(1)} ${(height - ((point - min) / Math.max(max - min, 1)) * (height - 8) - 4).toFixed(1)}`).join(" ");
}

function Spark({ item }: { item: Instrument }) {
  const d = path(item.points, 220, 60), up = item.change >= 0;
  return <svg className="spark" viewBox="0 0 220 60" aria-hidden><path d={`${d} L220 60 L0 60Z`} className={up ? "fill up" : "fill down"} /><path d={d} className={up ? "stroke up" : "stroke down"} /></svg>;
}

function CandleChart({ data, decimals }: { data: SignalData; decimals: number }) {
  const candles = data.candles;
  const allPrices = candles.flatMap(candle => [candle.high, candle.low])
    .concat(data.indicators.ema9, data.indicators.ema21, [data.indicators.sessionMean]);
  const min = Math.min(...allPrices), max = Math.max(...allPrices), spread = Math.max(max - min, 0.0001);
  const width = 900, height = 330, left = 56, right = 14, top = 18, bottom = 34;
  const chartWidth = width - left - right, chartHeight = height - top - bottom;
  const x = (index: number) => left + (index + .5) * chartWidth / candles.length;
  const y = (price: number) => top + (max - price) / spread * chartHeight;
  const indicatorPath = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, index) => max - spread * index / 4);
  const candleWidth = Math.max(2, chartWidth / candles.length * .58);

  return <svg className="chart candlechart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label={`${data.symbol} ${data.interval} candlestick chart`}>
    {ticks.map(tick => <g key={tick}><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} className="gridline" /><text x={left-8} y={y(tick)+4} className="price-label" textAnchor="end">{tick.toFixed(decimals)}</text></g>)}
    <line x1={left} x2={width-right} y1={y(data.indicators.sessionMean)} y2={y(data.indicators.sessionMean)} className="meanline" />
    {candles.map((candle, index) => {
      const rising = candle.close >= candle.open;
      const center = x(index);
      return <g key={candle.datetime}>
        <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} className={rising ? "wick rising" : "wick falling"} />
        <rect x={center-candleWidth/2} y={Math.min(y(candle.open),y(candle.close))} width={candleWidth} height={Math.max(1.5,Math.abs(y(candle.open)-y(candle.close)))} className={rising ? "candle rising" : "candle falling"} rx="1" />
      </g>;
    })}
    <path d={indicatorPath(data.indicators.ema9)} className="ema ema9" />
    <path d={indicatorPath(data.indicators.ema21)} className="ema ema21" />
    {[0, Math.floor(candles.length/2), candles.length-1].map(index => <text key={index} x={x(index)} y={height-9} className="time-label" textAnchor={index === 0 ? "start" : index === candles.length-1 ? "end" : "middle"}>{candles[index]?.datetime.slice(5,16)}</text>)}
  </svg>;
}

export default function Home() {
  const [markets, setMarkets] = useState(seed);
  const [selected, setSelected] = useState(seed[0]);
  const [timeframe, setTimeframe] = useState("5min");
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [signalError, setSignalError] = useState("");
  const [signalLoading, setSignalLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [status, setStatus] = useState("Indicative · delayed");
  const [activeView, setActiveView] = useState("Overview");

  useEffect(() => {
    fetch("/api/markets").then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (data.instruments?.length) { setMarkets(data.instruments); setSelected(data.instruments[0]); }
      if (data.status) setStatus(data.status);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) { setSignalLoading(true); setSignalError(""); }
      return fetch(`/api/signals?symbol=${encodeURIComponent(selected.symbol)}&interval=${timeframe}`);
    })
      .then(response => response.json().then(body => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Signal data unavailable");
        if (!cancelled) setSignal(body);
      })
      .catch(error => { if (!cancelled) { setSignal(null); setSignalError(error instanceof Error ? error.message : "Signal data unavailable"); } })
      .finally(() => { if (!cancelled) setSignalLoading(false); });
    return () => { cancelled = true; };
  }, [selected.symbol, timeframe]);

  const visible = filter === "All" ? markets : markets.filter(m => m.group === filter);
  const breadth = markets.filter(m => m.change > 0).length;
  const leader = [...markets].sort((a, b) => b.change - a.change)[0];
  const price = (m: Instrument) => `${m.unit ?? ""}${m.price.toLocaleString("en-US", { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals })}`;
  const navigate = (view: string, target?: string) => {
    setActiveView(view);
    window.requestAnimationFrame(() => {
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return <main>
    <header className="topbar">
      <div className="brand"><span>✦</span>Northstar<small>Markets</small></div>
      <nav aria-label="Dashboard navigation">
        <button onClick={() => navigate("Overview")} className={activeView === "Overview" ? "active" : ""}>Overview</button>
        <button onClick={() => navigate("Watchlist", "watchlist")} className={activeView === "Watchlist" ? "active" : ""}>Watchlist</button>
        <button onClick={() => navigate("Calendar", "calendar")} className={activeView === "Calendar" ? "active" : ""}>Calendar</button>
        <button onClick={() => navigate("News", "news")} className={activeView === "News" ? "active" : ""}>News</button>
      </nav>
      <div className="open"><i /> Markets open</div><div className="avatar">DM</div>
    </header>
    <div className="shell">
      <section className="welcome"><div><p className="eyebrow">Personal market desk</p><h1>Good morning, Dimi.</h1><p>A calm read on currencies, metals and energy.</p></div><div className="asof"><span>Data status</span><strong>{status}</strong></div></section>

      <section className="panel pulse section-anchor" id="watchlist">
        <div className="heading"><div><p className="eyebrow">Market pulse</p><h2>What is moving now</h2></div><div className="segments">{["All","Forex","Commodities"].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? "active" : ""}>{x}</button>)}</div></div>
        <div className="tickers">{visible.map(m => <button key={m.symbol} onClick={() => setSelected(m)} className={`ticker ${selected.symbol === m.symbol ? "selected" : ""}`}>
          <span className="tickername"><b>{m.name}</b><em>{m.symbol}</em></span><strong>{price(m)}</strong><span className={m.change >= 0 ? "gain" : "loss"}>{m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%</span><Spark item={m} />
        </button>)}</div>
      </section>

      <section className="metrics">
        <article className="panel"><span>Market breadth</span><strong>{breadth} / {markets.length}</strong><p>tracked markets are higher</p></article>
        <article className="panel"><span>Session leader</span><strong>{leader.name}</strong><p className="gain">+{leader.change.toFixed(2)}% today</p></article>
        <article className="panel"><span>Selected market</span><strong>{selected.name}</strong><p>{selected.group} · {selected.symbol}</p></article>
      </section>

      <section className="panel calendar section-anchor" id="calendar">
        <div className="heading"><div><p className="eyebrow">Economic calendar</p><h2>Events to watch</h2></div><span className="calendar-date">Today · Athens time</span></div>
        <div className="events">
          <article><time>12:00</time><div><b>Euro area confidence indicators</b><span>EUR · Medium impact</span></div><em className="medium">Medium</em></article>
          <article><time>15:30</time><div><b>U.S. preliminary GDP</b><span>USD · High impact</span></div><em className="high">High</em></article>
          <article><time>17:00</time><div><b>U.S. pending home sales</b><span>USD · Medium impact</span></div><em className="medium">Medium</em></article>
          <article><time>17:30</time><div><b>EIA natural gas storage</b><span>Natural Gas · High impact</span></div><em className="high">High</em></article>
        </div>
      </section>

      <section className="content">
        <article className="panel chartcard">
          <div className="heading"><div><p className="eyebrow">{selected.group} · Real OHLC candles</p><h2>{selected.name} intraday chart</h2></div><div className="segments">{["5min","15min","30min","1h"].map(x => <button key={x} onClick={() => setTimeframe(x)} className={timeframe === x ? "active" : ""}>{x.replace("min","m")}</button>)}</div></div>
          <div className="chartvalue"><strong>{price(selected)}</strong><span className={selected.change >= 0 ? "gain" : "loss"}>{selected.change >= 0 ? "+" : ""}{selected.change.toFixed(2)}%</span></div>
          {signalLoading && <div className="chartstate">Loading intraday candles and calculating indicators…</div>}
          {signalError && <div className="chartstate error"><strong>Intraday feed unavailable</strong><span>{signalError}</span></div>}
          {signal && <CandleChart data={signal} decimals={selected.decimals} />}
          <div className="chartlegend"><span><i className="bull" /> Green candle: price closed higher</span><span><i className="bear" /> Red candle: price closed lower</span><span><i className="fast" /> EMA 9</span><span><i className="slow" /> EMA 21</span><span><i className="mean" /> Session mean</span></div>
          <div className="axis"><span>Left: older candles</span><span>Price scale shown on chart</span><span>Right: latest candle</span></div>
        </article>
        <aside>
          <article className={`panel analysis signalcard ${signal?.direction === "LONG" ? "long" : signal?.direction === "SHORT" ? "short" : "neutral"}`}>
            <div className="signalhead"><div><p className="eyebrow">Rules-based setup</p><h2>{signalLoading ? "Calculating…" : signal?.direction || "Data unavailable"}</h2></div>{signal && <span>{signal.interval.replace("min","m")}</span>}</div>
            {signal && <>
              <p className="signalstamp">Last candle: {signal.timestamp}</p>
              {signal.direction !== "NO TRADE" && <div className="tradelevels">
                <div><span>Entry</span><strong>{signal.setup.entry.toFixed(selected.decimals)}</strong></div>
                <div><span>Stop</span><strong>{signal.setup.stop.toFixed(selected.decimals)}</strong></div>
                <div><span>Target 1</span><strong>{signal.setup.target1.toFixed(selected.decimals)}</strong></div>
                <div><span>Target 2</span><strong>{signal.setup.target2.toFixed(selected.decimals)}</strong></div>
              </div>}
              <div className="indicatorstrip"><span>RSI <b>{signal.indicators.rsi.toFixed(1)}</b></span><span>ATR <b>{signal.indicators.atr.toFixed(selected.decimals)}</b></span><span>R:R <b>{signal.setup.riskReward ? `1:${signal.setup.riskReward}` : "—"}</b></span></div>
              <h3>Why this setup</h3>
              <ul>{signal.setup.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              <div className="invalidation"><span>Invalidation</span><strong>{signal.setup.invalidation}</strong></div>
            </>}
            {signalError && <p>{signalError}</p>}
          </article>
          <article className="panel newscard section-anchor" id="news"><div className="heading"><div><p className="eyebrow">Market briefing</p><h2>Latest context</h2></div><a href="https://www.reuters.com/markets/" target="_blank">View all ↗</a></div>
            <div className="news">{news.map(n => <a href={n[4]} target="_blank" rel="noreferrer" key={n[0]+n[1]}><span>{n[0]}</span><span><em>{n[1]}</em><b>{n[2]}</b><small>{n[3]}</small></span><i>›</i></a>)}</div>
          </article>
        </aside>
      </section>
      <footer>For personal monitoring only. Indicative data and automated commentary are not investment advice.</footer>
    </div>
  </main>;
}
