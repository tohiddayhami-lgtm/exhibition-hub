import { Booth, Hall } from '../types';

export function computeAutoLayout(
  booths: Booth[],
  hall: Hall,
  aisleWidth = 3.5,
  aisleDepth = 4.0,
  borderMargin = 3.0
): { booths: Booth[]; hall: Hall } {
  if (booths.length === 0) return { booths, hall };

  const n = booths.length;
  const cellW = Math.max(...booths.map(b => b.width));
  const cellD = Math.max(...booths.map(b => b.depth));

  // Target roughly 4:3 hall aspect — calculate optimal columns
  const targetAspect = 4 / 3;
  let cols = Math.max(1, Math.round(Math.sqrt(n * targetAspect)));
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);

  const gridW = cols * cellW + (cols - 1) * aisleWidth;
  const gridD = rows * cellD + (rows - 1) * aisleDepth;

  const newHallW = Math.max(hall.width, Math.ceil(gridW + 2 * borderMargin));
  const newHallD = Math.max(hall.depth, Math.ceil(gridD + 2 * borderMargin));

  const startX = -(gridW / 2) + cellW / 2;
  const startZ = -(gridD / 2) + cellD / 2;

  const arranged = booths.map((booth, i) => ({
    ...booth,
    posX: +(startX + (i % cols) * (cellW + aisleWidth)).toFixed(2),
    posZ: +(startZ + Math.floor(i / cols) * (cellD + aisleDepth)).toFixed(2),
    updatedAt: new Date().toISOString(),
  }));

  return {
    booths: arranged,
    hall: { ...hall, width: newHallW, depth: newHallD, updatedAt: new Date().toISOString() },
  };
}
