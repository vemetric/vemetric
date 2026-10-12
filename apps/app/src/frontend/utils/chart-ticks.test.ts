import { describe, it, expect } from 'vitest';
import { getEquidistantTicks, getNiceTicks, getVisibleTicks } from './chart-ticks';

// Expected values were generated with recharts' getNiceTickValues, which this helper replaces
describe('getNiceTicks', () => {
  it.each([
    [13, 68, 5, true, [0, 20, 40, 60, 80]],
    [770, 1608, 5, true, [750, 1000, 1250, 1500, 1750]],
    [0, 7, 5, true, [0, 2, 4, 6, 8]],
    [0.12, 0.87, 5, true, [0, 0.25, 0.5, 0.75, 1]],
    [-30, 45, 5, true, [-50, -25, 0, 25, 50]],
    [-80, -10, 5, true, [-80, -60, -40, -20, 0]],
    [12345, 98765, 5, true, [0, 25000, 50000, 75000, 100000]],
    [3, 1250, 6, true, [0, 250, 500, 750, 1000, 1250]],
    [0.5, 3.2, 5, false, [0, 1, 2, 3, 4]],
    [0, 1, 5, false, [0, 1, 2, 3, 4]],
  ])(
    'should return nice ticks for [%d, %d] with %d ticks (decimals: %s)',
    (min, max, tickCount, allowDecimals, ticks) => {
      expect(getNiceTicks(min, max, tickCount, allowDecimals)).toEqual(ticks);
    },
  );

  it.each([
    [0, [0, 1, 2, 3, 4]],
    [5, [3, 4, 5, 6, 7]],
    [0.37, [0.1, 0.2, 0.3, 0.4, 0.5]],
  ])('should spread ticks around a single value of %d', (value, ticks) => {
    expect(getNiceTicks(value, value)).toEqual(ticks);
  });

  it('should return no ticks for non-finite values', () => {
    expect(getNiceTicks(Infinity, 5)).toEqual([]);
  });
});

// Expected values follow recharts' getTicks, which this helper was verified against
describe('getVisibleTicks', () => {
  it('should keep the first and last label and move them inwards when they overflow', () => {
    const candidates = [0, 100, 200, 300, 400].map((coordinate) => ({ coordinate, size: 60 }));
    expect(getVisibleTicks(candidates, { start: 0, end: 400, minTickGap: 15, mode: 'preserveStartEnd' })).toEqual([
      { index: 0, labelCoordinate: 30 },
      { index: 2, labelCoordinate: 200 },
      { index: 4, labelCoordinate: 370 },
    ]);
  });

  it('should keep every label when there is enough space', () => {
    const candidates = [50, 150, 250].map((coordinate) => ({ coordinate, size: 40 }));
    expect(
      getVisibleTicks(candidates, { start: 0, end: 300, minTickGap: 15, mode: 'preserveStartEnd' }).map(
        ({ index }) => index,
      ),
    ).toEqual([0, 1, 2]);
  });

  it('should thin vertical ticks from the top end', () => {
    // y-axis ticks from the bottom (lowest value) to the top, like on the mobile dashboard chart
    const candidates = [101.4, 79.8, 58.2, 36.6, 15].map((coordinate) => ({ coordinate, size: 18 }));
    expect(getVisibleTicks(candidates, { start: 0, end: 131.4, minTickGap: 5, mode: 'preserveEnd' })).toEqual([
      { index: 0, labelCoordinate: 101.4 },
      { index: 2, labelCoordinate: 58.2 },
      { index: 4, labelCoordinate: 15 },
    ]);
  });

  it('should return no ticks without candidates', () => {
    expect(getVisibleTicks([], { start: 0, end: 100, minTickGap: 5, mode: 'preserveEnd' })).toEqual([]);
  });
});

describe('getEquidistantTicks', () => {
  const bounds = { start: 0, end: 600, minTickGap: 15 };

  it('should show every n-th label and move the edge labels inwards', () => {
    const candidates = [0, 100, 200, 300, 400, 500, 600].map((coordinate) => ({ coordinate, size: 120 }));
    expect(getEquidistantTicks(candidates, bounds)).toEqual([
      { index: 0, labelCoordinate: 60 },
      { index: 2, labelCoordinate: 200 },
      { index: 4, labelCoordinate: 400 },
      { index: 6, labelCoordinate: 540 },
    ]);
  });

  it('should anchor the labels at the last one', () => {
    const candidates = [0, 100, 200, 300, 400, 500].map((coordinate) => ({ coordinate, size: 120 }));
    expect(getEquidistantTicks(candidates, { ...bounds, end: 500 })).toEqual([
      { index: 1, labelCoordinate: 100 },
      { index: 3, labelCoordinate: 300 },
      { index: 5, labelCoordinate: 440 },
    ]);
  });

  it('should keep every label when there is enough space', () => {
    const candidates = [50, 150, 250].map((coordinate) => ({ coordinate, size: 40 }));
    expect(getEquidistantTicks(candidates, { ...bounds, end: 300 }).map(({ index }) => index)).toEqual([0, 1, 2]);
  });

  it('should only show the last label when no label fits', () => {
    // Still moved inwards as far as possible
    expect(getEquidistantTicks([{ coordinate: 50, size: 200 }], { ...bounds, end: 100 })).toEqual([
      { index: 0, labelCoordinate: 0 },
    ]);
    expect(getEquidistantTicks([], bounds)).toEqual([]);
  });
});
