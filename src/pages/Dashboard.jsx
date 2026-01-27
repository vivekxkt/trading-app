import { mockStocks } from "../data/mockStocks";
import StockCard from "../components/StockCard";

export default function Dashboard() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Dashboard</h2>
      <p style={{ opacity: 0.7 }}>Quick overview of trending stocks</p>

      <div style={{ display: "grid", gap: "12px", marginTop: "15px" }}>
        {mockStocks.map((s) => (
          <StockCard key={s.symbol} stock={s} />
        ))}
      </div>
    </div>
  );
}
