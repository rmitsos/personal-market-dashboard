"use client";

import { useEffect, useMemo, useState } from "react";

type Instrument = { symbol: string; name: string; price: number; change: number; unit?: string; decimals: number; points: number[]; group: "Forex" | "Commodities" };

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

const histories: Record<string, number[]> = {
  "1D": [32,35,33,38,41,37,31,28,34,36,40,47,52,48,44,46,43,39,35,31,34,32,36,41,38,45,49,47,53,56],
  "1W": [27,30,35,32,38,42,40,45,49,44,47,52,48,55,51,57,54,60,58,64,61,67],
  "1M": [55,50,47,52,45,41,44,38,35,39,43,46,49,45,52,56,53,58,62,59,65,68],
  "1Y": [28,34,31,39,37,42,48,45,53,49,58,55,62,66,61,70,67,74,71,78,82,79]
};

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

function Chart({ points }: { points: number[] }) {
  const d = path(points, 900, 300);
  return <svg className="chart" viewBox="0 0 900 340" preserveAspectRatio="none" aria-label="Market trend">
    <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38d6e8" stopOpacity=".28" /><stop offset="100%" stopColor="#38d6e8" stopOpacity="0" /></linearGradient></defs>
    {[40,100,160,220,280].map(y => <line key={y} x1="0" x2="900" y1={y} y2={y} className="gridline" />)}
    <path d={`${d} L900 320 L0 320Z`} fill="url(#area)" /><path d={d} className="chartline" />
    <line x1="675" x2="675" y1="18" y2="320" className="crosshair" /><circle cx="675" cy="202" r="5" className="point" />
  </svg>;
}

export default function Home() {
  const [markets, setMarkets] = useState(seed);
  const [selected, setSelected] = useState(seed[0]);
  const [range, setRange] = useState("1D");
  const [filter, setFilter] = useState("All");
  const [status, setStatus] = useState("Indicative · delayed");
  const [activeView, setActiveView] = useState("Overview");

  useEffect(() => {
    fetch("/api/markets").then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (data.instruments?.length) { setMarkets(data.instruments); setSelected(data.instruments[0]); }
      if (data.status) setStatus(data.status);
    }).catch(() => undefined);
  }, []);

  const visible = filter === "All" ? markets : markets.filter(m => m.group === filter);
  const breadth = markets.filter(m => m.change > 0).length;
  const leader = [...markets].sort((a, b) => b.change - a.change)[0];
  const analysis = useMemo(() => `${selected.name} has a ${selected.change >= 0 ? "positive" : "defensive"} short-term bias. At ${Math.abs(selected.change).toFixed(2)}% on the session, ${selected.change >= 0 ? "buyers remain in control, although the next session should confirm whether the move has enough breadth." : "selling pressure is visible, but the move still looks contained rather than disorderly."}`, [selected]);
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
          <div className="heading"><div><p className="eyebrow">{selected.group}</p><h2>{selected.name} trend</h2></div><div className="segments">{Object.keys(histories).map(x => <button key={x} onClick={() => setRange(x)} className={range === x ? "active" : ""}>{x}</button>)}</div></div>
          <div className="chartvalue"><strong>{price(selected)}</strong><span className={selected.change >= 0 ? "gain" : "loss"}>{selected.change >= 0 ? "+" : ""}{selected.change.toFixed(2)}%</span></div>
          <Chart points={histories[range]} /><div className="axis"><span>Open</span><span>Mid-session</span><span>Latest</span></div>
        </article>
        <aside>
          <article className="panel analysis"><div className="star">✦</div><p className="eyebrow">Plain analysis</p><h2>{selected.change >= 0 ? "Momentum is constructive" : "Pressure remains contained"}</h2><p>{analysis}</p><div className="watch"><span>What to watch</span><strong>Rates · USD · risk appetite</strong></div></article>
          <article className="panel newscard section-anchor" id="news"><div className="heading"><div><p className="eyebrow">Market briefing</p><h2>Latest context</h2></div><a href="https://www.reuters.com/markets/" target="_blank">View all ↗</a></div>
            <div className="news">{news.map(n => <a href={n[4]} target="_blank" rel="noreferrer" key={n[0]+n[1]}><span>{n[0]}</span><span><em>{n[1]}</em><b>{n[2]}</b><small>{n[3]}</small></span><i>›</i></a>)}</div>
          </article>
        </aside>
      </section>
      <footer>For personal monitoring only. Indicative data and automated commentary are not investment advice.</footer>
    </div>
  </main>;
}
