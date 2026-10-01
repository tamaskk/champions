import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FORMATIONS, formationLayout, formationRoles } from "../src/index";

describe("formations", () => {
  it("every formation has 10 outfield players (plus the goalkeeper)", () => {
    for (const f of FORMATIONS) {
      const outfield = f.split(" ")[0]!.split("-").reduce((sum, n) => sum + Number(n), 0);
      assert.equal(outfield, 10, f);
    }
  });

  it("every layout has 11 spots and exactly one goalkeeper", () => {
    for (const f of FORMATIONS) {
      const layout = formationLayout(f);
      const roles = formationRoles(f);
      assert.equal(layout.length, 11, f);
      assert.equal(roles.length, 11, f);
      assert.equal(roles.filter((r) => r === "GK").length, 1, f);
      for (const spot of layout) assert.ok(spot.x >= 0 && spot.x <= 1 && spot.y >= 0 && spot.y <= 1, `${f} ${spot.code}`);
    }
  });

  it("formation names are unique", () => {
    assert.equal(new Set(FORMATIONS).size, FORMATIONS.length);
  });
});
