import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as sharkDefaultConfig } from "./Shark/config";
import { SharkStrategyDefinition } from "./Shark/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  SharkStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  Shark: sharkDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { SharkStrategyDefinition } from "./Shark/strategy";
export { sharkDefaultConfig };
export { sharkManifest } from "./Shark/manifest";
export { sharkAiAdapter } from "./Shark/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
