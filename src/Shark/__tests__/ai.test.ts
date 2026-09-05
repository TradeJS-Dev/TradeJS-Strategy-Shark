import { sharkAiAdapter } from "../adapters/ai";

describe("sharkAiAdapter", () => {
  it("carries Shark geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_shark",
      signalDirection: "LONG",
      abXaExtension: 1.5,
      bcAbExtension: 1.6666667,
      xcOxRatio: 1,
      pivots: [{ role: "O", value: 100 }],
    };
    const payload = sharkAiAdapter.buildPayload!({
      signal: { additionalIndicators: { sharkContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).sharkContext).toEqual(context);
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = sharkAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_shark");
    expect(prompt).toContain("abXaExtension=1.5");
    expect(prompt).toContain("bcAbExtension=1.6666667");
    expect(prompt).toContain("xcOxRatio=1");
  });
});
