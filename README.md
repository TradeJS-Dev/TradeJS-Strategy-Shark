# @tradejs/strategy-shark

TradeJS strategy plugin providing `Shark`.

## Strategy overview

`Shark` detects a five-pivot harmonic reversal pattern labelled `O–X–A–B–C`.
The bullish form uses `low → high → low → higher high → low` and enters long
after the final `C` low is confirmed. The bearish form is its exact mirror and
enters short after the final `C` high is confirmed.

The detector uses the standard harmonic measurements:

1. `AB / XA` is between `1.13` and `1.618`;
2. `BC / AB` is between `1.618` and `2.24`;
3. `XC / OX` is between `0.886` and `1.13`.

In a bullish pattern `B` must be above `X`, while `A` is below both points and
`C` completes in the lower reversal zone. The bearish pattern mirrors every
comparison.

![Shark strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Shark/main/docs/strategy-logic.svg)

## Signal geometry

![Bullish Shark signal](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Shark/main/docs/signal-example.svg)

The illustrations are schematic. Defaults use wick pivots, a two-bar confirmed
fractal, a 50% retracement of `BC` as the target, and a stop 10% of `OX` beyond
`C`. Every tolerance is explicit in the strategy config so research can change
geometry without changing detector code.

## Install

```bash
yarn add @tradejs/strategy-shark
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-shark"],
});
```

The package exports `strategyEntries`, the `Shark` strategy definition,
manifest, default config, and AI adapter.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow.

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads a hidden nested engine, types package, or Strategy Kit.
