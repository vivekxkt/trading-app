export function addChartPoint(prev, price) {
  const time = new Date().toLocaleTimeString().slice(0, 8);
  const next = [...prev, { time, price }];

  // keep last 30 points only (clean UI)
  return next.slice(-30);
}
