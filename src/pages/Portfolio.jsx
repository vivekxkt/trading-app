export default function Portfolio() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>💼 Portfolio</h2>
      <p style={{ opacity: 0.7 }}>
        Your holdings will appear here (mock version for now)
      </p>

      <div
        style={{
          marginTop: "15px",
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid #222",
          background: "#0f0f0f",
        }}
      >
        <h3 style={{ margin: 0 }}>Total Balance</h3>
        <p style={{ fontSize: "22px", margin: "10px 0 0 0" }}>₹50,000</p>
      </div>
    </div>
  );
}
