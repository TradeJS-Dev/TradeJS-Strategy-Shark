import { StrategyManifest } from "@tradejs/types";
import { sharkAiAdapter } from "./adapters/ai";

export const sharkManifest: StrategyManifest = {
  name: "Shark",
  aiAdapter: sharkAiAdapter,
};
