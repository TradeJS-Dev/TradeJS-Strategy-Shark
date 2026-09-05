import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, SharkConfig } from "./config";
import { createSharkCore } from "./core";
import { sharkManifest } from "./manifest";

export const SharkStrategyDefinition: ValidatedStrategyRegistryEntry<SharkConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "Shark",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createSharkCore,
    manifest: sharkManifest,
  };
