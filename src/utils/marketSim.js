export function simulateNextPrice(price, drift = 0) {
  if (!Number.isFinite(price)) return 0;

  const volatility = 0.00015;
  const shock = (Math.random() - 0.5) * volatility;
  const percentMove = drift + shock;

  const next = price * (1 + percentMove);
  return Number(next.toFixed(2));
}
