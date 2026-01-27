export default function StockCard({ stock }) {
  const isPositive = stock.change >= 0;

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid #222",
        background: "#0f0f0f",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>{stock.symbol}</h3>
        <p style={{ margin: 0, opacity: 0.7 }}>{stock.name}</p>
      </div>

      <div style={{ textAlign: "right" }}>
        <h3 style={{ margin: 0 }}>₹{stock.price}</h3>
        <p style={{ margin: 0, color: isPositive ? "lime" : "red" }}>
          {isPositive ? "+" : ""}
          {stock.change}%
        </p>
      </div>
    </div>
  );
}
