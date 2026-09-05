import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { SharkConfig } from "../config";

export const sharkAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        sharkContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.sharkContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.sharkContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional Shark context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- entryStage=${String(context.entryStage ?? "n/a")}
- abXaExtension=${String(context.abXaExtension ?? "n/a")}
- bcAbExtension=${String(context.bcAbExtension ?? "n/a")}
- xcOxRatio=${String(context.xcOxRatio ?? "n/a")}
- confirmationDistanceBcRatio=${String(context.confirmationDistanceBcRatio ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for Shark:
- A bullish Shark is O low, X high, A pullback, B above X, then C in the lower 0.886-1.13 OX reversal zone.
- A bearish Shark is the exact mirror image.
- AB/XA, BC/AB and XC/OX are geometry checks, not independent entry signals.
- The entry is emitted only after the C pivot is confirmed. Reject analysis that contradicts the signal direction.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<SharkConfig, "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY">,
    ),
};
