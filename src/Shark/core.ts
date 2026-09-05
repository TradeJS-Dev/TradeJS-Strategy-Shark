import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { SharkConfig } from "./config";
import { buildSharkSignalContext, createSharkEngine } from "./engine";
import { buildSharkFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const buildSharkStateKey = (config: SharkConfig) =>
  JSON.stringify({
    pivotLength: config.SHARK_PIVOT_LENGTH,
    minAbXaExtension: config.SHARK_MIN_AB_XA_EXTENSION,
    maxAbXaExtension: config.SHARK_MAX_AB_XA_EXTENSION,
    minBcAbExtension: config.SHARK_MIN_BC_AB_EXTENSION,
    maxBcAbExtension: config.SHARK_MAX_BC_AB_EXTENSION,
    minXcOxRatio: config.SHARK_MIN_XC_OX_RATIO,
    maxXcOxRatio: config.SHARK_MAX_XC_OX_RATIO,
    targetBcRetracementPct: config.SHARK_TARGET_BC_RETRACEMENT_PCT,
    stopOxPct: config.SHARK_STOP_OX_PCT,
    minPatternHeightPct: config.SHARK_MIN_PATTERN_HEIGHT_PCT,
    minPatternHeightAtr: config.SHARK_MIN_PATTERN_HEIGHT_ATR,
    atrPeriod: config.SHARK_ATR_PERIOD,
    minLegBars: config.SHARK_MIN_LEG_BARS,
    maxPatternAgeBars: config.SHARK_MAX_PATTERN_AGE_BARS,
    maxEntryAfterCBars: config.SHARK_MAX_ENTRY_AFTER_C_BARS,
    minConfirmationDistanceAtr: config.SHARK_MIN_CONFIRMATION_DISTANCE_ATR,
    maxConfirmationDistanceBcRatio:
      config.SHARK_MAX_CONFIRMATION_DISTANCE_BC_RATIO,
  });

export const createSharkCore: CreateStrategyCore<
  SharkConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createSharkEngine> },
    ReturnType<ReturnType<typeof createSharkEngine>["next"]>,
    ReturnType<ReturnType<typeof createSharkEngine>["getState"]>
  >(
    "Shark",
    () => ({
      engine: createSharkEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildSharkStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createSharkEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (Boolean(config.SHARK_EXIT_ON_OPPOSITE_PATTERN) && oppositePattern) {
        return strategyApi.exit({
          code: "SHARK_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const signalContext = {
      ...buildSharkSignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
    };
    const indicators = indicatorsState.snapshot();
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? "SHARK_BULLISH_PIVOT_CONFIRMED"
          : "SHARK_BEARISH_PIVOT_CONFIRMED",
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { sharkContext: signalContext },
      figures: buildSharkFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
