import { buildSharkFigures } from "../figures";
import { SharkPattern } from "../engine";

describe("Shark figures", () => {
  it("renders the OXABC zigzag, triangle, target, stop, pivots and entry", () => {
    const pattern: SharkPattern = {
      setupId: "bullish-shark-1",
      kind: "bullish_shark",
      direction: "LONG",
      entryStage: "pivot_confirmed",
      pivots: [
        { timestamp: 1, index: 0, value: 100, kind: "low", traded: false },
        { timestamp: 2, index: 1, value: 120, kind: "high", traded: false },
        { timestamp: 3, index: 2, value: 110, kind: "low", traded: false },
        { timestamp: 4, index: 3, value: 125, kind: "high", traded: false },
        { timestamp: 5, index: 4, value: 100, kind: "low", traded: true },
      ],
      targetPrice: 112.5,
      stopLossPrice: 98,
      completionZoneNearPrice: 102.28,
      completionZoneFarPrice: 97.4,
      height: 25,
      patternHeightAtr: 5,
      patternAgeBars: 5,
      entryAfterCBars: 1,
      oXBars: 1,
      xABars: 1,
      aBBars: 1,
      bCBars: 1,
      abXaExtension: 1.5,
      bcAbExtension: 1.6666667,
      xcOxRatio: 1,
      confirmationDistancePct: 4,
      confirmationDistanceAtr: 0.8,
      confirmationDistanceBcRatio: 0.16,
      timestamp: 6,
      close: 104,
    };

    const figures = buildSharkFigures({
      pattern,
      entryTimestamp: 6,
      entryPrice: 104,
    });

    expect(figures.lines).toHaveLength(4);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "shark_bullish_shark_pattern",
      "shark_oxc_triangle",
      "shark_target",
      "shark_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(5);
  });
});
