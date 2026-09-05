import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { SharkPattern } from "./engine";

export const buildSharkFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: SharkPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const color = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const [o, x, a, b, c] = pattern.pivots;
  const patternPoints = [o, x, a, b, c].map(({ timestamp, value }) => ({
    timestamp,
    value,
  }));

  const lines: StrategyFigureLine[] = [
    {
      id: `shark-pattern-${entryTimestamp}`,
      kind: `shark_${pattern.kind}_pattern`,
      points: patternPoints,
      color,
      width: 2,
      style: "solid",
    },
    {
      id: `shark-triangle-${entryTimestamp}`,
      kind: "shark_oxc_triangle",
      points: [
        { timestamp: o.timestamp, value: o.value },
        { timestamp: x.timestamp, value: x.value },
        { timestamp: c.timestamp, value: c.value },
        { timestamp: o.timestamp, value: o.value },
      ],
      color: "#2563eb",
      width: 1,
      style: "dashed",
    },
    {
      id: `shark-target-${entryTimestamp}`,
      kind: "shark_target",
      points: [
        { timestamp: c.timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `shark-stop-${entryTimestamp}`,
      kind: "shark_stop",
      points: [
        { timestamp: c.timestamp, value: pattern.stopLossPrice },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `shark-pivots-${entryTimestamp}`,
      kind: `shark_${pattern.kind}_pivots`,
      points: patternPoints,
      color,
      radius: 4,
    },
    {
      id: `shark-entry-${entryTimestamp}`,
      kind: "shark_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color,
      radius: 5,
    },
  ];

  return { lines, points };
};
