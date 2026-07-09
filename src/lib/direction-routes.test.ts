import { describe, expect, it } from "vitest";
import { buildDirectionPath, parseDirectionSlug, type DirectionAsset } from "./direction-routes";

const assets: DirectionAsset[] = [
  { code: "BTC", name: "Bitcoin", kind: "CRYPTO", networks: [{ code: "BTC" }] },
  { code: "SBERRUB", name: "Sberbank RUB", kind: "FIAT", networks: [] },
  { code: "YAMRUB", name: "YooMoney RUB", kind: "FIAT", networks: [] },
  { code: "USDTPOLYGON", name: "Tether USD Polygon", kind: "CRYPTO", networks: [{ code: "POLYGON" }] },
  { code: "USDTERC20", name: "Tether USD ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] }
];

describe("direction routes", () => {
  it("builds readable exchange direction paths", () => {
    expect(buildDirectionPath("BTC", "SBERRUB", assets)).toBe("/bitcoin-to-sberbank");
  });

  it("parses legacy html direction links", () => {
    expect(parseDirectionSlug("bitcoin-to-yoomoney.html", assets)).toEqual({
      from: "BTC",
      to: "YAMRUB"
    });
  });

  it("parses provider code style direction links", () => {
    expect(parseDirectionSlug("USDTPOLYGON-to-USDTERC20", assets)).toEqual({
      from: "USDTPOLYGON",
      to: "USDTERC20"
    });
  });

  it("parses same-asset exchange direction links", () => {
    expect(parseDirectionSlug("bitcoin-to-bitcoin", assets)).toEqual({
      from: "BTC",
      to: "BTC"
    });
  });
});
