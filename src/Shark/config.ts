import { FEE_PERCENT as RISK_FEE_RATE } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface SharkSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  RISK_FEE_RATE,
  RISK_SLIPPAGE_BPS: 0,
  RISK_MARKET_IMPACT_BPS: 0,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  SHARK_PIVOT_LENGTH: 2,
  SHARK_MIN_AB_XA_EXTENSION: 1.13,
  SHARK_MAX_AB_XA_EXTENSION: 1.618,
  SHARK_MIN_BC_AB_EXTENSION: 1.618,
  SHARK_MAX_BC_AB_EXTENSION: 2.24,
  SHARK_MIN_XC_OX_RATIO: 0.886,
  SHARK_MAX_XC_OX_RATIO: 1.13,
  SHARK_TARGET_BC_RETRACEMENT_PCT: 50,
  SHARK_STOP_OX_PCT: 10,
  SHARK_MIN_PATTERN_HEIGHT_PCT: 0.2,
  SHARK_MIN_PATTERN_HEIGHT_ATR: 1,
  SHARK_ATR_PERIOD: 14,
  SHARK_MIN_LEG_BARS: 1,
  SHARK_MAX_PATTERN_AGE_BARS: 240,
  SHARK_MAX_ENTRY_AFTER_C_BARS: 12,
  SHARK_MIN_CONFIRMATION_DISTANCE_ATR: 0.05,
  SHARK_MAX_CONFIRMATION_DISTANCE_BC_RATIO: 0.5,
  SHARK_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type SharkConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    LONG: SharkSideConfig;
    SHORT: SharkSideConfig;
  };
