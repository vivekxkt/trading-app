export function calculateEMA(data, period = 10) {
  if (!data.length) return [];

  const k = 2 / (period + 1);
  let ema = data[0].price;

  return data.map((point, i) => {
    if (i === 0) ema = point.price;
    else ema = point.price * k + ema * (1 - k);

    return { ...point, ema: Number(ema.toFixed(2)) };
  });
}
