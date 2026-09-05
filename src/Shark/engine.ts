import { Candle, Direction } from "@tradejs/types";
import { SharkConfig } from "./config";

export type SharkPatternKind = "bullish_shark" | "bearish_shark";
export type SharkPivotRole = "O" | "X" | "A" | "B" | "C";

export interface SharkPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface SharkPattern {
  setupId: string;
  kind: SharkPatternKind;
  direction: Direction;
  entryStage: "pivot_confirmed";
  pivots: [SharkPivot, SharkPivot, SharkPivot, SharkPivot, SharkPivot];
  targetPrice: number;
  stopLossPrice: number;
  completionZoneNearPrice: number;
  completionZoneFarPrice: number;
  height: number;
  patternHeightAtr: number;
  patternAgeBars: number;
  entryAfterCBars: number;
  oXBars: number;
  xABars: number;
  aBBars: number;
  bCBars: number;
  abXaExtension: number;
  bcAbExtension: number;
  xcOxRatio: number;
  confirmationDistancePct: number;
  confirmationDistanceAtr: number;
  confirmationDistanceBcRatio: number;
  timestamp: number;
  close: number;
}

export interface SharkRuntimeState {
  pattern: SharkPattern | null;
  pivots: SharkPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: SharkPivot[];
  pattern: SharkPattern | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getConfigNumbers = (config: SharkConfig) => {
  const minAbXaExtension = Math.max(
    0,
    Number(config.SHARK_MIN_AB_XA_EXTENSION ?? 1.13),
  );
  const minBcAbExtension = Math.max(
    0,
    Number(config.SHARK_MIN_BC_AB_EXTENSION ?? 1.618),
  );
  const minXcOxRatio = Math.max(
    0,
    Number(config.SHARK_MIN_XC_OX_RATIO ?? 0.886),
  );

  return {
    pivotLength: Math.max(1, Math.floor(config.SHARK_PIVOT_LENGTH ?? 2)),
    minAbXaExtension,
    maxAbXaExtension: Math.max(
      minAbXaExtension,
      Number(config.SHARK_MAX_AB_XA_EXTENSION ?? 1.618),
    ),
    minBcAbExtension,
    maxBcAbExtension: Math.max(
      minBcAbExtension,
      Number(config.SHARK_MAX_BC_AB_EXTENSION ?? 2.24),
    ),
    minXcOxRatio,
    maxXcOxRatio: Math.max(
      minXcOxRatio,
      Number(config.SHARK_MAX_XC_OX_RATIO ?? 1.13),
    ),
    targetBcRetracementPct: Math.max(
      0,
      Number(config.SHARK_TARGET_BC_RETRACEMENT_PCT ?? 50),
    ),
    stopOxPct: Math.max(0, Number(config.SHARK_STOP_OX_PCT ?? 10)),
    minPatternHeightPct: Math.max(
      0,
      Number(config.SHARK_MIN_PATTERN_HEIGHT_PCT ?? 0),
    ),
    minPatternHeightAtr: Math.max(
      0,
      Number(config.SHARK_MIN_PATTERN_HEIGHT_ATR ?? 0),
    ),
    atrPeriod: Math.max(2, Math.floor(config.SHARK_ATR_PERIOD ?? 14)),
    minLegBars: Math.max(1, Math.floor(config.SHARK_MIN_LEG_BARS ?? 1)),
    maxPatternAgeBars: Math.max(
      5,
      Math.floor(config.SHARK_MAX_PATTERN_AGE_BARS ?? 240),
    ),
    maxEntryAfterCBars: Math.max(
      1,
      Math.floor(config.SHARK_MAX_ENTRY_AFTER_C_BARS ?? 12),
    ),
    minConfirmationDistanceAtr: Math.max(
      0,
      Number(config.SHARK_MIN_CONFIRMATION_DISTANCE_ATR ?? 0),
    ),
    maxConfirmationDistanceBcRatio: Math.max(
      0,
      Number(config.SHARK_MAX_CONFIRMATION_DISTANCE_BC_RATIO ?? 0),
    ),
  };
};

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
};

const appendPivot = (state: EngineState, pivot: SharkPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 20) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value == null) ||
    lows.some((value) => value == null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const patternRolesForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["low", "high", "low", "high", "low"] as const)
    : (["high", "low", "high", "low", "high"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): [SharkPivot, SharkPivot, SharkPivot, SharkPivot, SharkPivot] | null => {
  const roles = patternRolesForDirection(direction);

  for (let index = state.pivots.length - 5; index >= 0; index -= 1) {
    const candidate = state.pivots.slice(index, index + 5);
    if (
      candidate.length === 5 &&
      candidate.every((pivot, roleIndex) => pivot.kind === roles[roleIndex]) &&
      candidate[4]!.index < state.currentIndex &&
      !candidate[4]!.traded
    ) {
      return candidate as [
        SharkPivot,
        SharkPivot,
        SharkPivot,
        SharkPivot,
        SharkPivot,
      ];
    }
  }

  return null;
};

const isBetween = (value: number, minimum: number, maximum: number) =>
  value >= minimum && value <= maximum;

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markConsumed = (state: EngineState, pattern: SharkPattern) => {
  state.consumedSetupIds.push(pattern.setupId);
  if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  const completionPivot = state.pivots.find(
    (pivot) => pivot.timestamp === pattern.pivots[4].timestamp,
  );
  if (completionPivot) completionPivot.traded = true;
};

const buildPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): SharkPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const [o, x, a, b, c] = pivots;
  const sign = direction === "LONG" ? 1 : -1;
  const [oValue, xValue, aValue, bValue, cValue] = pivots.map(
    (pivot) => pivot.value * sign,
  );

  if (
    xValue <= oValue ||
    bValue <= xValue ||
    aValue >= xValue ||
    aValue >= bValue ||
    cValue >= aValue
  ) {
    return null;
  }

  const ox = xValue - oValue;
  const xa = xValue - aValue;
  const ab = bValue - aValue;
  const bc = bValue - cValue;
  const xc = xValue - cValue;
  if (Math.min(ox, xa, ab, bc, xc) <= 0) return null;

  const abXaExtension = ab / xa;
  const bcAbExtension = bc / ab;
  const xcOxRatio = xc / ox;
  if (
    !isBetween(
      abXaExtension,
      options.minAbXaExtension,
      options.maxAbXaExtension,
    ) ||
    !isBetween(
      bcAbExtension,
      options.minBcAbExtension,
      options.maxBcAbExtension,
    ) ||
    !isBetween(xcOxRatio, options.minXcOxRatio, options.maxXcOxRatio)
  ) {
    return null;
  }

  const oXBars = x.index - o.index;
  const xABars = a.index - x.index;
  const aBBars = b.index - a.index;
  const bCBars = c.index - b.index;
  if (Math.min(oXBars, xABars, aBBars, bCBars) < options.minLegBars) {
    return null;
  }

  const patternAgeBars = state.currentIndex - o.index;
  const entryAfterCBars = state.currentIndex - c.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    entryAfterCBars > options.maxEntryAfterCBars
  ) {
    return null;
  }

  const height = bc;
  const heightPct = b.value !== 0 ? (height / Math.abs(b.value)) * 100 : 0;
  const patternHeightAtr = atr != null && atr > 0 ? height / atr : 0;
  if (
    heightPct < options.minPatternHeightPct ||
    patternHeightAtr < options.minPatternHeightAtr
  ) {
    return null;
  }

  const close = asNumber(candle.close);
  if (close == null) return null;
  const confirmationDistance = close * sign - cValue;
  if (confirmationDistance <= 0) return null;

  const confirmationDistancePct =
    c.value !== 0 ? (confirmationDistance / Math.abs(c.value)) * 100 : 0;
  const confirmationDistanceAtr =
    atr != null && atr > 0 ? confirmationDistance / atr : 0;
  const confirmationDistanceBcRatio = confirmationDistance / bc;
  if (
    confirmationDistanceAtr < options.minConfirmationDistanceAtr ||
    (options.maxConfirmationDistanceBcRatio > 0 &&
      confirmationDistanceBcRatio > options.maxConfirmationDistanceBcRatio)
  ) {
    return null;
  }

  const kind: SharkPatternKind =
    direction === "LONG" ? "bullish_shark" : "bearish_shark";
  const setupId = `${kind}:${o.timestamp}:${x.timestamp}:${a.timestamp}:${b.timestamp}:${c.timestamp}`;
  if (hasConsumed(state, setupId)) return null;

  return {
    setupId,
    kind,
    direction,
    entryStage: "pivot_confirmed",
    pivots,
    targetPrice: c.value + sign * bc * (options.targetBcRetracementPct / 100),
    stopLossPrice: c.value - sign * ox * (options.stopOxPct / 100),
    completionZoneNearPrice: (xValue - ox * options.minXcOxRatio) * sign,
    completionZoneFarPrice: (xValue - ox * options.maxXcOxRatio) * sign,
    height,
    patternHeightAtr,
    patternAgeBars,
    entryAfterCBars,
    oXBars,
    xABars,
    aBBars,
    bCBars,
    abXaExtension,
    bcAbExtension,
    xcOxRatio,
    confirmationDistancePct,
    confirmationDistanceAtr,
    confirmationDistanceBcRatio,
    timestamp: candle.timestamp,
    close,
  };
};

export const buildSharkSignalContext = (pattern: SharkPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  entryStage: pattern.entryStage,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  completionZoneNearPrice: pattern.completionZoneNearPrice,
  completionZoneFarPrice: pattern.completionZoneFarPrice,
  height: pattern.height,
  patternHeightAtr: pattern.patternHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  entryAfterCBars: pattern.entryAfterCBars,
  oXBars: pattern.oXBars,
  xABars: pattern.xABars,
  aBBars: pattern.aBBars,
  bCBars: pattern.bCBars,
  abXaExtension: pattern.abXaExtension,
  bcAbExtension: pattern.bcAbExtension,
  xcOxRatio: pattern.xcOxRatio,
  confirmationDistancePct: pattern.confirmationDistancePct,
  confirmationDistanceAtr: pattern.confirmationDistanceAtr,
  confirmationDistanceBcRatio: pattern.confirmationDistanceBcRatio,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: (["O", "X", "A", "B", "C"] as SharkPivotRole[])[index],
    timestamp,
    value,
    kind,
  })),
});

export type SharkSignalContext = ReturnType<typeof buildSharkSignalContext>;

export const createSharkEngine = ({
  config,
  initialCandles = [],
}: {
  config: SharkConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => SharkRuntimeState;
  getState: () => SharkRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars + options.pivotLength * 2 + 5,
    options.atrPeriod + 2,
  );

  const snapshot = (): SharkRuntimeState => ({
    pattern: state.pattern
      ? { ...state.pattern, pivots: [...state.pattern.pivots] }
      : null,
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): SharkRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    const pattern =
      buildPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    if (!pattern) return snapshot();

    markConsumed(state, pattern);
    state.pattern = pattern;
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
