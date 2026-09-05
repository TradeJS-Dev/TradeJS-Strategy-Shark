/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createSharkEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  dt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    SHARK_PIVOT_LENGTH: 1,
    SHARK_MIN_PATTERN_HEIGHT_PCT: 0,
    SHARK_MIN_PATTERN_HEIGHT_ATR: 0,
    SHARK_MIN_CONFIRMATION_DISTANCE_ATR: 0,
    SHARK_MAX_CONFIRMATION_DISTANCE_BC_RATIO: 1,
    ...overrides,
  }) as any;

export const makeBullishSharkCandles = () => [
  makeCandle(0, 104, 106, 103, 105),
  makeCandle(1, 103, 105, 100, 102),
  makeCandle(2, 106, 112, 105, 110),
  makeCandle(3, 116, 120, 115, 118),
  makeCandle(4, 115, 117, 112, 114),
  makeCandle(5, 112, 114, 110, 112),
  makeCandle(6, 115, 119, 114, 118),
  makeCandle(7, 121, 125, 120, 123),
  makeCandle(8, 112, 114, 108, 110),
  makeCandle(9, 102, 104, 100, 102),
  makeCandle(10, 102, 106, 101, 104),
];

const mirrorCandles = (candles: ReturnType<typeof makeBullishSharkCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

describe("Shark engine", () => {
  it("detects a bullish Shark after the C low is confirmed", () => {
    const engine = createSharkEngine({ config: makeConfig() });
    const states = makeBullishSharkCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_shark");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      100, 120, 110, 125, 100,
    ]);
    expect(pattern?.abXaExtension).toBeCloseTo(1.5);
    expect(pattern?.bcAbExtension).toBeCloseTo(1.6666667);
    expect(pattern?.xcOxRatio).toBeCloseTo(1);
    expect(pattern?.entryAfterCBars).toBe(1);
    expect(pattern?.targetPrice).toBeCloseTo(112.5);
    expect(pattern?.stopLossPrice).toBeCloseTo(98);
  });

  it("detects the mirrored bearish Shark", () => {
    const engine = createSharkEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishSharkCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_shark");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      120, 100, 110, 95, 120,
    ]);
    expect(pattern?.abXaExtension).toBeCloseTo(1.5);
    expect(pattern?.bcAbExtension).toBeCloseTo(1.6666667);
    expect(pattern?.xcOxRatio).toBeCloseTo(1);
    expect(pattern?.targetPrice).toBeCloseTo(107.5);
    expect(pattern?.stopLossPrice).toBeCloseTo(122);
  });

  it("rejects AB/XA above the configured 1.618 maximum", () => {
    const candles = makeBullishSharkCandles();
    candles[7] = makeCandle(7, 126, 130, 125, 128);
    candles[9] = makeCandle(9, 100, 102, 97.6, 99);
    candles[10] = makeCandle(10, 99, 102, 98, 100);
    const engine = createSharkEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects BC/AB below the configured 1.618 minimum", () => {
    const candles = makeBullishSharkCandles();
    candles[9] = makeCandle(9, 103, 105, 101.5, 103);
    candles[10] = makeCandle(10, 103, 106, 102, 104);
    const engine = createSharkEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects XC/OX below the configured 0.886 minimum", () => {
    const candles = makeBullishSharkCandles();
    candles[7] = makeCandle(7, 120, 122, 119, 121);
    candles[9] = makeCandle(9, 104, 106, 102.5, 104);
    candles[10] = makeCandle(10, 104, 107, 103, 105);
    const engine = createSharkEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("emits a confirmed setup only once", () => {
    const engine = createSharkEngine({ config: makeConfig() });
    const candles = makeBullishSharkCandles();
    const detected = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );
    expect(detected.pattern?.entryStage).toBe("pivot_confirmed");

    expect(engine.next(candles[candles.length - 1] as any)).toEqual(detected);
    expect(
      engine.next(makeCandle(11, 104, 108, 103, 107) as any).pattern,
    ).toBeNull();
  });

  it("rebuilds the signal identically from initial candles", () => {
    const config = makeConfig();
    const candles = makeBullishSharkCandles();
    const continuous = createSharkEngine({ config });
    for (const candle of candles.slice(0, -1)) {
      continuous.next(candle as any);
    }
    const continuousState = continuous.next(candles.at(-1) as any);

    const restored = createSharkEngine({
      config,
      initialCandles: candles.slice(0, -1) as any,
    });
    expect(restored.next(candles.at(-1) as any)).toEqual(continuousState);
  });
});
