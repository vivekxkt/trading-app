import { useEffect, useMemo, useRef, useState } from "react";
import { mockStocks } from "./data/mockStocks";
import { simulateNextPrice } from "./utils/marketSim";

/**
 * =============================
 * UTILITIES
 * =============================
 */

function formatINR(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function nowTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Realistic-ish Indian equity intraday charges (approx)
 */
function calculateCharges({ side, qty, price }) {
  const turnover = qty * price;

  const brokerage = Math.min(turnover * 0.0003, 20);
  const stt = side === "SELL" ? turnover * 0.00025 : 0;
  const exchange = turnover * 0.0000345;
  const sebi = turnover * 0.000001;
  const stamp = side === "BUY" ? turnover * 0.00003 : 0;
  const gst = 0.18 * (brokerage + exchange);
  const dp = side === "SELL" ? 13.5 : 0;

  const total = brokerage + stt + exchange + sebi + stamp + gst + dp;

  return {
    turnover,
    brokerage,
    stt,
    exchange,
    sebi,
    stamp,
    gst,
    dp,
    total,
  };
}

/**
 * =============================
 * RESPONSIVE HOOK
 * =============================
 */
function useWindowSize() {
  const [size, setSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/**
 * =============================
 * CANDLESTICK CHART (SVG)
 * - fixed candle size
 * - drag pan (handled outside)
 * - smooth left shift animation when new candle closes
 * - crosshair + OHLC tooltip
 * =============================
 */
function CandlestickChart({
  candles,
  width = 900,
  height = 360,
  visibleCount = 60,
  panOffset = 0,
  shiftX = 0, // 0 -> normal, 1 -> shift by one candle step
  bg = "#0d1117",
  border = "#1c2330",
  textDim = "rgba(255,255,255,0.65)",
  green = "#5ee38b",
  red = "#ff6b6b",
}) {
  const pad = { left: 56, right: 18, top: 14, bottom: 28 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = Math.max(10, height - pad.top - pad.bottom);

  const safeVisible = clamp(visibleCount, 20, 120);

  const endIndex = Math.max(0, candles.length - panOffset);
  const startIndex = Math.max(0, endIndex - safeVisible);
  const visible = candles.slice(startIndex, endIndex);

  // fixed candle size like real charts
  const candleW = 10;
  const gap = 6;
  const step = candleW + gap;

  const startX = pad.left;

  const prices = visible.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices, visible[0]?.low ?? 0);
  const maxP = Math.max(...prices, visible[0]?.high ?? 1);

  const yMin = minP - (maxP - minP) * 0.08;
  const yMax = maxP + (maxP - minP) * 0.08;

  const yScale = (p) => {
    if (yMax === yMin) return pad.top + plotH / 2;
    const t = (p - yMin) / (yMax - yMin);
    return pad.top + (1 - t) * plotH;
  };

  const priceFromY = (y) => {
    const t = (y - pad.top) / plotH;
    const inv = 1 - t;
    return yMin + inv * (yMax - yMin);
  };

  // crosshair state
  const [cross, setCross] = useState({
    active: false,
    x: 0,
    y: 0,
    idx: null,
  });

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const py = ((e.clientY - rect.top) / rect.height) * height;

    const xClamped = clamp(px, pad.left, width - pad.right);
    const yClamped = clamp(py, pad.top, pad.top + plotH);

    // map x to candle index (consider shift translation)
    const localX = xClamped - startX + shiftX * step;
    const i = clamp(
      Math.floor(localX / step),
      0,
      Math.max(0, visible.length - 1)
    );

    setCross({
      active: true,
      x: xClamped,
      y: yClamped,
      idx: visible.length > 0 ? i : null,
    });
  }

  function handleLeave() {
    setCross((c) => ({ ...c, active: false }));
  }

  const hovered = cross.idx != null ? visible[cross.idx] : null;
  const hoveredPrice = priceFromY(cross.y);

  const gridCount = 5;
  const grid = Array.from({ length: gridCount }, (_, i) => {
    const t = i / (gridCount - 1);
    const price = yMin + (1 - t) * (yMax - yMin);
    return { y: pad.top + t * plotH, price };
  });

  const clipId = "chartClip";
  const translateX = -shiftX * step;

  return (
    <div
      style={{
        width: "100%",
        height,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        overflow: "hidden",
        userSelect: "none",
        position: "relative",
      }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* grid */}
        {grid.map((g, idx) => (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={g.y}
              y2={g.y}
              stroke={border}
              strokeDasharray="4 4"
            />
            <text
              x={10}
              y={g.y + 4}
              fill={textDim}
              fontSize="11"
              fontFamily="system-ui"
            >
              ₹{g.price.toFixed(0)}
            </text>
          </g>
        ))}

        {/* candles + crosshair clipped */}
        <g clipPath={`url(#${clipId})`}>
          <g
            style={{ transition: "transform 350ms linear" }}
            transform={`translate(${translateX},0)`}
          >
            {visible.map((c, i) => {
              const xCenter = startX + i * step + step / 2;
              const isGreen = c.close >= c.open;
              const col = isGreen ? green : red;

              const yOpen = yScale(c.open);
              const yClose = yScale(c.close);
              const yHigh = yScale(c.high);
              const yLow = yScale(c.low);

              const bodyY = Math.min(yOpen, yClose);
              const bodyH = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g key={c.id ?? i}>
                  <line
                    x1={xCenter}
                    x2={xCenter}
                    y1={yHigh}
                    y2={yLow}
                    stroke={col}
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  <rect
                    x={xCenter - candleW / 2}
                    y={bodyY}
                    width={candleW}
                    height={bodyH}
                    fill={col}
                    opacity="0.85"
                    rx="2"
                  />
                </g>
              );
            })}
          </g>

          {/* crosshair lines */}
          {cross.active && (
            <>
              <line
                x1={cross.x}
                x2={cross.x}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="6 6"
              />
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={cross.y}
                y2={cross.y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="6 6"
              />
            </>
          )}
        </g>

        {/* time ticks */}
        {visible.map((c, i) => {
          if (i % 10 !== 0) return null;
          const xCenter = startX + i * step + step / 2;
          return (
            <text
              key={i}
              x={xCenter}
              y={height - 10}
              fill={textDim}
              fontSize="11"
              fontFamily="system-ui"
              textAnchor="middle"
            >
              {c.time}
            </text>
          );
        })}

        {/* crosshair price label */}
        {cross.active && (
          <g>
            <rect
              x={width - pad.right - 92}
              y={cross.y - 12}
              width={92}
              height={24}
              rx={8}
              fill="rgba(11,18,32,0.95)"
              stroke={border}
            />
            <text
              x={width - pad.right - 46}
              y={cross.y + 5}
              fill="white"
              fontSize="12"
              fontFamily="system-ui"
              textAnchor="middle"
              fontWeight="800"
            >
              ₹{hoveredPrice.toFixed(2)}
            </text>
          </g>
        )}

        {/* crosshair time label */}
        {cross.active && hovered?.time && (
          <g>
            <rect
              x={cross.x - 44}
              y={height - 26}
              width={88}
              height={20}
              rx={8}
              fill="rgba(11,18,32,0.95)"
              stroke={border}
            />
            <text
              x={cross.x}
              y={height - 12}
              fill="white"
              fontSize="12"
              fontFamily="system-ui"
              textAnchor="middle"
              fontWeight="800"
            >
              {hovered.time}
            </text>
          </g>
        )}

        {/* OHLC tooltip */}
        {cross.active && hovered && (
          <g>
            <rect
              x={pad.left + 10}
              y={pad.top + 10}
              width={290}
              height={60}
              rx={12}
              fill="rgba(11,18,32,0.92)"
              stroke={border}
            />
            <text
              x={pad.left + 22}
              y={pad.top + 32}
              fill="white"
              fontSize="12"
              fontFamily="system-ui"
              fontWeight="900"
            >
              O: ₹{hovered.open.toFixed(2)}   H: ₹{hovered.high.toFixed(2)}
            </text>
            <text
              x={pad.left + 22}
              y={pad.top + 52}
              fill="white"
              fontSize="12"
              fontFamily="system-ui"
              fontWeight="900"
            >
              L: ₹{hovered.low.toFixed(2)}    C: ₹{hovered.close.toFixed(2)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * =============================
 * MAIN APP
 * =============================
 */
export default function App() {
  const { w } = useWindowSize();
  const isMobile = w < 900;

  // market
  const [stocks, setStocks] = useState(() =>
    mockStocks.map((s) => ({
      ...s,
      open: s.price,
      last: s.price,
      drift: (Math.random() - 0.5) * 0.0002,
      change: 0,
      changePercent: 0,
    }))
  );
  const [selected, setSelected] = useState(mockStocks[0]?.symbol || "RELIANCE");

  // candles
  const [candles, setCandles] = useState([]);
  const candleRef = useRef(null);
  const CANDLE_TICKS = 6;
  const [tickCount, setTickCount] = useState(0);

  // pan only (zoom removed)
  const [visibleCount] = useState(60);
  const [panOffset, setPanOffset] = useState(0);

  // auto follow live candles (real charts)
  const [autoFollow, setAutoFollow] = useState(true);

  // smooth left motion
  const [shiftX, setShiftX] = useState(0);

  // drag refs
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPanRef = useRef(0);

  // portfolio
  const [cash, setCash] = useState(100000);
  const [holdings, setHoldings] = useState([]);
  const [orders, setOrders] = useState([]);

  // trade inputs
  const [qty, setQty] = useState(1);
  const [sl, setSl] = useState("");
  const [target, setTarget] = useState("");

  // toast
  const [toast, setToast] = useState(null);

  const selectedStock = stocks.find((s) => s.symbol === selected);

  const colors = {
    bg: "#07090d",
    panel: "#0d1117",
    panel2: "#0b0f14",
    border: "#1c2330",
    textDim: "rgba(255,255,255,0.65)",
    textFaint: "rgba(255,255,255,0.45)",
    green: "#5ee38b",
    red: "#ff6b6b",
    accent: "#8b5cf6",
    button: "#111827",
  };

  // market ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prevStocks) =>
        prevStocks.map((s) => {
          const open = Number.isFinite(s.open) ? s.open : s.price;

          let nextDrift =
            (Number.isFinite(s.drift) ? s.drift : 0) +
            (Math.random() - 0.5) * 0.00002;

          nextDrift = Math.max(Math.min(nextDrift, 0.00025), -0.00025);

          const nextPrice = simulateNextPrice(s.price, nextDrift);

          const change = Number((nextPrice - open).toFixed(2));
          const changePercent = Number(((change / open) * 100).toFixed(2));

          return {
            ...s,
            open,
            last: s.price,
            price: nextPrice,
            drift: nextDrift,
            change,
            changePercent,
          };
        })
      );

      setTickCount((t) => t + 1);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // reset candles on symbol change
  useEffect(() => {
    setCandles([]);
    candleRef.current = null;
    setPanOffset(0);
    setShiftX(0);
    setAutoFollow(true);
  }, [selectedStock?.symbol]);

  // build candles
  useEffect(() => {
    if (!selectedStock) return;

    const price = selectedStock.price;
    const time = nowTimeLabel();

    setCandles((prev) => {
      const list = [...prev];

      if (!candleRef.current) {
        const c = {
          id: Date.now(),
          time,
          open: price,
          high: price,
          low: price,
          close: price,
          ticks: 1,
        };
        candleRef.current = c;
        return [...list, c];
      }

      const current = candleRef.current;

      const updated = {
        ...current,
        high: Math.max(current.high, price),
        low: Math.min(current.low, price),
        close: price,
        ticks: current.ticks + 1,
        time,
      };

      list[list.length - 1] = updated;
      candleRef.current = updated;

      if (updated.ticks >= CANDLE_TICKS) {
        const next = {
          id: Date.now() + 1,
          time,
          open: updated.close,
          high: updated.close,
          low: updated.close,
          close: updated.close,
          ticks: 0,
        };

        candleRef.current = next;
        list.push(next);

        // ✅ keep newest candles visible on right
        if (autoFollow) setPanOffset(0);

        // smooth left shift animation by 1 candle step
        setShiftX(1);
        requestAnimationFrame(() => setShiftX(0));
      }

      return list.slice(-300);
    });
  }, [tickCount, selectedStock?.price, autoFollow]);

  // holdings with live
  const holdingsWithLive = useMemo(() => {
    return holdings.map((h) => {
      const live = stocks.find((s) => s.symbol === h.symbol);
      const ltp = live?.price ?? 0;
      const invested = h.qty * h.avgBuy;
      const current = h.qty * ltp;
      const pnl = current - invested;
      const pnlPercent = invested === 0 ? 0 : (pnl / invested) * 100;

      return { ...h, ltp, invested, current, pnl, pnlPercent };
    });
  }, [holdings, stocks]);

  const totals = useMemo(() => {
    const invested = holdingsWithLive.reduce((sum, h) => sum + h.invested, 0);
    const current = holdingsWithLive.reduce((sum, h) => sum + h.current, 0);
    const pnl = current - invested;
    return { invested, current, pnl };
  }, [holdingsWithLive]);

  const portfolio = useMemo(() => {
    const holdingsValue = holdingsWithLive.reduce((sum, h) => sum + h.current, 0);
    const totalValue = cash + holdingsValue;
    return { holdingsValue, totalValue, pnl: totals.pnl };
  }, [cash, holdingsWithLive, totals.pnl]);

  function showToast(msg, type = "info") {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 2200);
  }

  function pushOrder(order) {
    setOrders((prev) => [order, ...prev].slice(0, 60));
  }

  function buyStock(symbol, quantity, slPrice, targetPrice) {
    const live = stocks.find((s) => s.symbol === symbol);
    if (!live) return;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return alert("Quantity must be at least 1");
    }

    const price = live.price;
    const charges = calculateCharges({ side: "BUY", qty: quantity, price });
    const totalDebit = quantity * price + charges.total;

    if (totalDebit > cash) {
      return alert(
        `Not enough balance!\nRequired: ₹${totalDebit.toFixed(
          2
        )}\nAvailable: ₹${cash.toFixed(2)}`
      );
    }

    pushOrder({
      id: `ORD-${Date.now()}`,
      time: nowTimeLabel(),
      symbol,
      side: "BUY",
      qty: quantity,
      price: Number(price.toFixed(2)),
      status: "FILLED",
      charges: Number(charges.total.toFixed(2)),
    });

    setCash((c) => Number((c - totalDebit).toFixed(2)));

    setHoldings((prev) => {
      const existing = prev.find((h) => h.symbol === symbol);

      const parsedSL = slPrice === "" ? null : Number(slPrice);
      const parsedTarget = targetPrice === "" ? null : Number(targetPrice);

      if (!existing) {
        return [
          ...prev,
          {
            symbol,
            qty: quantity,
            avgBuy: Number(price.toFixed(2)),
            sl: Number.isFinite(parsedSL) ? parsedSL : null,
            target: Number.isFinite(parsedTarget) ? parsedTarget : null,
          },
        ];
      }

      const newQty = existing.qty + quantity;
      const newAvg = (existing.qty * existing.avgBuy + quantity * price) / newQty;

      return prev.map((h) =>
        h.symbol === symbol
          ? {
              ...h,
              qty: newQty,
              avgBuy: Number(newAvg.toFixed(2)),
              sl: existing.sl ?? (Number.isFinite(parsedSL) ? parsedSL : null),
              target:
                existing.target ??
                (Number.isFinite(parsedTarget) ? parsedTarget : null),
            }
          : h
      );
    });

    setQty(1);
    setSl("");
    setTarget("");

    showToast(
      `BUY ${symbol} × ${quantity} @ ₹${formatINR(price)} (Charges ₹${formatINR(
        charges.total
      )})`,
      "buy"
    );
  }

  function sellStock(symbol, quantity) {
    const live = stocks.find((s) => s.symbol === symbol);
    if (!live) return;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return alert("Quantity must be at least 1");
    }

    const existing = holdings.find((h) => h.symbol === symbol);
    if (!existing) return alert("You don't own this stock.");

    if (quantity > existing.qty) {
      return alert(`Not enough quantity!\nYou have: ${existing.qty}`);
    }

    const price = live.price;
    const charges = calculateCharges({ side: "SELL", qty: quantity, price });

    const grossCredit = quantity * price;
    const netCredit = grossCredit - charges.total;

    pushOrder({
      id: `ORD-${Date.now()}`,
      time: nowTimeLabel(),
      symbol,
      side: "SELL",
      qty: quantity,
      price: Number(price.toFixed(2)),
      status: "FILLED",
      charges: Number(charges.total.toFixed(2)),
    });

    setCash((c) => Number((c + netCredit).toFixed(2)));

    setHoldings((prev) => {
      const h = prev.find((x) => x.symbol === symbol);
      if (!h) return prev;

      const newQty = h.qty - quantity;

      if (newQty <= 0) {
        return prev.filter((x) => x.symbol !== symbol);
      }

      return prev.map((x) =>
        x.symbol === symbol ? { ...x, qty: newQty } : x
      );
    });

    showToast(
      `SELL ${symbol} × ${quantity} @ ₹${formatINR(price)} (Charges ₹${formatINR(
        charges.total
      )})`,
      "sell"
    );
  }

  // auto exit SL/Target
  useEffect(() => {
    if (holdings.length === 0) return;

    holdings.forEach((h) => {
      const live = stocks.find((s) => s.symbol === h.symbol);
      if (!live) return;

      const ltp = live.price;

      if (h.target != null && ltp >= h.target && h.qty > 0) {
        sellStock(h.symbol, h.qty);
      }

      if (h.sl != null && ltp <= h.sl && h.qty > 0) {
        sellStock(h.symbol, h.qty);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickCount]);

  function handleAddFunds() {
    const amt = Number(prompt("Enter amount to ADD (₹):", "10000"));
    if (!Number.isFinite(amt) || amt <= 0) return;
    setCash((c) => Number((c + amt).toFixed(2)));
    showToast(`Added ₹${formatINR(amt)} to wallet`, "info");
  }

  function handleWithdraw() {
    const amt = Number(prompt("Enter amount to WITHDRAW (₹):", "5000"));
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (amt > cash) return alert("Not enough cash to withdraw.");
    setCash((c) => Number((c - amt).toFixed(2)));
    showToast(`Withdrawn ₹${formatINR(amt)} from wallet`, "info");
  }

  // chart interactions (zoom removed)
  const maxPanOffset = useMemo(
    () => Math.max(0, candles.length - 20),
    [candles.length]
  );

  function handleChartMouseDown(e) {
    draggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartPanRef.current = panOffset;

    // 🔥 user is exploring history now
    setAutoFollow(false);
  }

  function handleChartMouseMove(e) {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    const candlesMove = Math.round(dx / 12);
    const next = clamp(dragStartPanRef.current - candlesMove, 0, maxPanOffset);
    setPanOffset(next);
  }

  function handleChartMouseUp() {
    draggingRef.current = false;
  }

  function handleChartDoubleClick() {
    setPanOffset(0);
    setAutoFollow(true);
  }

  // ui helpers
  const hiddenScrollbar = {
    overflowY: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  const panelButton = (variant = "normal") => {
    const bg = variant === "alt" ? "#0b1220" : colors.button;
    return {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      background: bg,
      color: "white",
      cursor: "pointer",
      fontWeight: 800,
    };
  };

  const rightPanelRows = isMobile ? "auto auto auto" : "auto auto 1fr";

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: colors.bg,
        color: "white",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <style>{`
        .hideScroll::-webkit-scrollbar { width: 0px; height: 0px; }
      `}</style>

      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "380px 1fr",
          gap: 0,
        }}
      >
        {/* WATCHLIST */}
        <div
          className="hideScroll"
          style={{
            borderRight: isMobile ? "none" : `1px solid ${colors.border}`,
            borderBottom: isMobile ? `1px solid ${colors.border}` : "none",
            padding: 16,
            background: colors.panel2,
            height: isMobile ? "260px" : "100vh",
            ...hiddenScrollbar,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Market Watch</h2>
          <p style={{ marginTop: -8, color: colors.textDim }}>
            Scroll works, scrollbar hidden 🙂
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {stocks.map((s) => {
              const isSelected = s.symbol === selected;
              const isPositive = s.change >= 0;

              return (
                <div
                  key={s.symbol}
                  onClick={() => setSelected(s.symbol)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: isSelected
                      ? `1px solid ${colors.accent}`
                      : `1px solid ${colors.border}`,
                    background: isSelected ? "#111827" : colors.panel,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>{s.symbol}</div>
                    <div style={{ fontSize: 13, color: colors.textFaint }}>
                      {s.name}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900 }}>₹{formatINR(s.price)}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: isPositive ? colors.green : colors.red,
                      }}
                    >
                      {isPositive ? "+" : ""}
                      {s.change} ({isPositive ? "+" : ""}
                      {s.changePercent}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN */}
        <div
          style={{
            padding: 16,
            height: isMobile ? "calc(100vh - 260px)" : "100vh",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "3fr 1fr",
              gap: 14,
              overflow: "hidden",
            }}
          >
            {/* LEFT: CHART + HOLDINGS */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: "420px 1fr",
                gap: 14,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {/* CHART */}
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background: colors.panel,
                  border: `1px solid ${colors.border}`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedStock?.symbol}</h2>
                    <div style={{ color: colors.textDim }}>
                      {selectedStock?.name}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <h2 style={{ margin: 0 }}>
                      ₹{formatINR(selectedStock?.price)}
                    </h2>
                    <div
                      style={{
                        color:
                          (selectedStock?.change ?? 0) >= 0
                            ? colors.green
                            : colors.red,
                      }}
                    >
                      {(selectedStock?.change ?? 0) >= 0 ? "+" : ""}
                      {selectedStock?.change} (
                      {(selectedStock?.changePercent ?? 0) >= 0 ? "+" : ""}
                      {selectedStock?.changePercent}%)
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: colors.textDim, fontSize: 13 }}>
                  Drag to pan • Double click to return latest
                  {panOffset > 0 && (
                    <span style={{ marginLeft: 10, color: "white" }}>
                      (Viewing past candles)
                    </span>
                  )}
                  {!autoFollow && (
                    <span style={{ marginLeft: 10, color: colors.accent }}>
                      • LIVE paused
                    </span>
                  )}
                </div>

                {/* chart interaction wrapper */}
                <div
                  style={{
                    marginTop: 14,
                    flex: 1,
                    minHeight: 0,
                    cursor: "grab",
                    overflow: "hidden",
                  }}
                  onMouseDown={handleChartMouseDown}
                  onMouseMove={handleChartMouseMove}
                  onMouseUp={handleChartMouseUp}
                  onMouseLeave={handleChartMouseUp}
                  onDoubleClick={handleChartDoubleClick}
                >
                  <CandlestickChart
                    candles={candles}
                    height={360}
                    width={980}
                    visibleCount={visibleCount}
                    panOffset={panOffset}
                    shiftX={shiftX}
                    bg={colors.panel2}
                    border={colors.border}
                    textDim={colors.textDim}
                    green={colors.green}
                    red={colors.red}
                  />
                </div>
              </div>

              {/* HOLDINGS */}
              <div
                className="hideScroll"
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  borderRadius: 16,
                  padding: 16,
                  minHeight: 0,
                  ...hiddenScrollbar,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Holdings</h3>
                  <div style={{ color: colors.textDim, fontSize: 13 }}>
                    Scroll enabled
                  </div>
                </div>

                {holdingsWithLive.length === 0 ? (
                  <p style={{ color: colors.textDim, marginTop: 12 }}>
                    No holdings yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {holdingsWithLive.map((h) => {
                      const positive = h.pnl >= 0;

                      return (
                        <div
                          key={h.symbol}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: 14,
                            padding: 12,
                            background: colors.panel2,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900 }}>{h.symbol}</div>
                            <div style={{ fontSize: 13, color: colors.textFaint }}>
                              Qty: {h.qty} | Avg: ₹{formatINR(h.avgBuy)}
                            </div>
                            <div style={{ fontSize: 12, color: colors.textDim }}>
                              SL: {h.sl ?? "—"} | Target: {h.target ?? "—"}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900 }}>
                              ₹{formatINR(h.ltp)}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: positive ? colors.green : colors.red,
                              }}
                            >
                              {positive ? "+" : ""}
                              ₹{h.pnl.toFixed(2)} ({positive ? "+" : ""}
                              {h.pnlPercent.toFixed(2)}%)
                            </div>

                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                onClick={() => sellStock(h.symbol, 1)}
                                style={panelButton("normal")}
                              >
                                Sell 1
                              </button>

                              <button
                                onClick={() => sellStock(h.symbol, h.qty)}
                                style={panelButton("alt")}
                              >
                                Exit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: PORTFOLIO + TRADE + ORDER HISTORY */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: rightPanelRows,
                gap: 14,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {/* PORTFOLIO */}
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0 }}>Portfolio</h3>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleAddFunds} style={panelButton("normal")}>
                      + Add
                    </button>
                    <button onClick={handleWithdraw} style={panelButton("alt")}>
                      − Withdraw
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: colors.textDim }}>Cash</span>
                    <b>₹{formatINR(cash)}</b>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: colors.textDim }}>Holdings Value</span>
                    <b>₹{formatINR(portfolio.holdingsValue)}</b>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: colors.textDim }}>Total Value</span>
                    <b>₹{formatINR(portfolio.totalValue)}</b>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: colors.textDim }}>Unrealized P&L</span>
                    <b style={{ color: portfolio.pnl >= 0 ? colors.green : colors.red }}>
                      {portfolio.pnl >= 0 ? "+" : ""}
                      ₹{formatINR(portfolio.pnl)}
                    </b>
                  </div>
                </div>
              </div>

              {/* TRADE */}
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <h3 style={{ margin: 0 }}>Trade</h3>
                <p style={{ margin: "6px 0 0", color: colors.textDim, fontSize: 13 }}>
                  Inputs reset after BUY
                </p>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ color: colors.textDim }}>
                    <b style={{ color: "white" }}>{selectedStock?.symbol}</b> @ ₹
                    {formatINR(selectedStock?.price)}
                  </div>

                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      background: colors.panel2,
                      color: "white",
                      outline: "none",
                    }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      placeholder="Stoploss (price)"
                      value={sl}
                      onChange={(e) => setSl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel2,
                        color: "white",
                        outline: "none",
                      }}
                    />
                    <input
                      placeholder="Target (price)"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: colors.panel2,
                        color: "white",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => {
                        if (!selectedStock) return;
                        buyStock(selectedStock.symbol, qty, sl, target);
                      }}
                      style={panelButton("normal")}
                    >
                      BUY
                    </button>

                    <button
                      onClick={() => {
                        if (!selectedStock) return;
                        sellStock(selectedStock.symbol, qty);
                      }}
                      style={panelButton("alt")}
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>

              {/* ORDER HISTORY */}
              <div
                className="hideScroll"
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  borderRadius: 16,
                  padding: 16,
                  minHeight: 0,
                  ...hiddenScrollbar,
                }}
              >
                <h3 style={{ margin: 0 }}>Order History</h3>
                <p style={{ margin: "6px 0 0", color: colors.textDim, fontSize: 13 }}>
                  Latest orders only
                </p>

                {orders.length === 0 ? (
                  <p style={{ marginTop: 12, color: colors.textDim }}>
                    No orders yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {orders.map((o) => (
                      <div
                        key={o.id}
                        style={{
                          border: `1px solid ${colors.border}`,
                          background: colors.panel2,
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {o.side} {o.symbol} × {o.qty}
                          </div>
                          <div style={{ fontSize: 13, color: colors.textDim }}>
                            ₹{formatINR(o.price)} • {o.time}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 900, color: colors.textDim }}>
                            Charges
                          </div>
                          <div style={{ fontSize: 13, color: colors.textFaint }}>
                            ₹{formatINR(o.charges)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 16,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              pointerEvents: "none",
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              background: "#0b1220",
              color: "white",
              minWidth: 280,
              maxWidth: 820,
              width: "calc(100% - 32px)",
              boxSizing: "border-box",
              fontWeight: 900,
            }}
          >
            {toast.type === "buy" ? "✅" : toast.type === "sell" ? "💸" : "ℹ️"}{" "}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
