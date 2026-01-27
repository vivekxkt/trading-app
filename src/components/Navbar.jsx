export default function Navbar({ setPage }) {
  const btnStyle = {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #333",
    background: "#111",
    color: "white",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        padding: "15px",
        borderBottom: "1px solid #222",
        background: "#0b0b0b",
      }}
    >
      <button style={btnStyle} onClick={() => setPage("dashboard")}>
        Dashboard
      </button>
      <button style={btnStyle} onClick={() => setPage("market")}>
        Market
      </button>
      <button style={btnStyle} onClick={() => setPage("portfolio")}>
        Portfolio
      </button>
      <button style={btnStyle} onClick={() => setPage("trade")}>
        Trade
      </button>
    </div>
  );
}
