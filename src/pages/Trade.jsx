import { useState } from "react";
import { mockStocks } from "../data/mockStocks";

export default function Trade() {
  const [symbol, setSymbol] = useState(mockStocks[0].symbol);
  const [qty, setQty] = useState(1);

  const selected = mockStocks.find((s) => s.symbol === symbol);

  return (
    <div style={{ padding: "20px" }}>
      <h2>⚡ Trade</h2>
      <p style={{ opacity: 0.7 }}>Mock buy/sell screen (no backend)</p>

      <div
        style={{
          marginTop: "15px",
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid #222",
          background: "#0f0f0f",
          display: "grid",
          gap: "12px",
          maxWidth: "400px",
        }}
      >
        <label>
          Stock:
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ width: "100%", padding: "10px", marginTop: "5px" }}
          >
            {mockStocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} - {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity:
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ width: "100%", padding: "10px", marginTop: "5px" }}
          />
        </label>

        <div style={{ opacity: 0.8 }}>
          Price: ₹{selected.price} <br />
          Total: ₹{(selected.price * qty).toFixed(2)}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background: "lime",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            onClick={() => alert(`Mock BUY: ${qty} shares of ${symbol}`)}
          >
            BUY
          </button>

          <button
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background: "red",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            onClick={() => alert(`Mock SELL: ${qty} shares of ${symbol}`)}
          >
            SELL
          </button>
        </div>
      </div>
    </div>
  );
}
