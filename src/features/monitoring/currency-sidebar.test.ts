import { describe, expect, it } from "vitest";
import { groupAssetsForDisplay, type AssetOption } from "./currency-sidebar";

const assets: AssetOption[] = [
  { code: "USDTTRC", name: "Tether USD TRC20", kind: "CRYPTO", networks: [{ code: "TRC20" }] },
  { code: "USDTTRC20", name: "Tether USD TRC20", kind: "CRYPTO", networks: [{ code: "TRC20" }] },
  { code: "USDTERC20", name: "Tether USD ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] }
];

describe("currency sidebar grouping", () => {
  it("shows duplicate display currencies only once", () => {
    const display = groupAssetsForDisplay(assets, { expanded: true });
    const codes = display.groups.flatMap((group) => group.assets.map((asset) => asset.code));

    expect(codes).toHaveLength(2);
    expect(codes.filter((code) => code === "USDTTRC" || code === "USDTTRC20")).toHaveLength(1);
    expect(codes).toContain("USDTERC20");
  });

  it("keeps the selected duplicate visible", () => {
    const display = groupAssetsForDisplay(assets, { expanded: true, selectedCode: "USDTTRC20" });
    const codes = display.groups.flatMap((group) => group.assets.map((asset) => asset.code));

    expect(codes).toHaveLength(2);
    expect(codes).toContain("USDTTRC20");
    expect(codes).toContain("USDTERC20");
  });
});
