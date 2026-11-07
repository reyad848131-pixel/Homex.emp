import { describe, it, expect } from "vitest";
import { ensureVersions, pushVersion, applyVersion, removeVersion, type VersionableItem } from "./item-versions";

const base = (): VersionableItem & { id: string } => ({
  id: "x",
  description: "v1",
  details: { w: 1 },
  quantity: 1,
  unitPrice: 100,
  extras: 0,
  lineTotal: 100,
});

describe("item-versions", () => {
  it("seeds a single version from current values", () => {
    const it = ensureVersions(base());
    expect(it.versions).toHaveLength(1);
    expect(it.activeVersion).toBe(0);
    expect(it.versions![0].lineTotal).toBe(100);
  });

  it("keeps the pre-edit values as version 1 when an edit is pushed", () => {
    // simulate: edit the item (new numbers) then push as a new version
    const edited = { ...ensureVersions(base()), description: "v2", unitPrice: 200, lineTotal: 200 };
    const it = pushVersion(edited);
    expect(it.versions).toHaveLength(2);
    expect(it.activeVersion).toBe(1);              // newest is approved
    expect(it.versions![0].lineTotal).toBe(100);   // original preserved
    expect(it.versions![1].lineTotal).toBe(200);
    expect(it.lineTotal).toBe(200);                // top-level mirrors approved
  });

  it("approving an older version mirrors its values onto the item", () => {
    const edited = { ...ensureVersions(base()), description: "v2", unitPrice: 200, lineTotal: 200 };
    let it = pushVersion(edited);
    it = applyVersion(it, 0);                        // go back to the original
    expect(it.activeVersion).toBe(0);
    expect(it.lineTotal).toBe(100);
    expect(it.unitPrice).toBe(100);
    expect(it.description).toBe("v1");
  });

  it("deleting the approved version re-points approval to a neighbour and re-mirrors", () => {
    const edited = { ...ensureVersions(base()), description: "v2", unitPrice: 200, lineTotal: 200 };
    let it = pushVersion(edited);                    // [100, 200], active 1
    it = removeVersion(it, 1);                       // drop the approved (200)
    expect(it.versions).toHaveLength(1);
    expect(it.activeVersion).toBe(0);
    expect(it.lineTotal).toBe(100);                 // total follows the surviving version
  });

  it("never deletes the last remaining version", () => {
    const it = ensureVersions(base());
    const same = removeVersion(it, 0);
    expect(same.versions).toHaveLength(1);
    expect(same.lineTotal).toBe(100);
  });

  it("deleting a non-approved older version keeps approval stable", () => {
    // build three versions: 100, 200, 300 (approved = index 2)
    let it = pushVersion({ ...ensureVersions(base()), unitPrice: 200, lineTotal: 200 });
    it = pushVersion({ ...it, unitPrice: 300, lineTotal: 300 });
    expect(it.activeVersion).toBe(2);
    it = removeVersion(it, 0);                       // drop the oldest (100)
    expect(it.versions).toHaveLength(2);
    expect(it.activeVersion).toBe(1);               // still pointing at 300
    expect(it.lineTotal).toBe(300);
  });

  it("snapshots deep-copy details so later edits do not mutate history", () => {
    const it = pushVersion({ ...ensureVersions(base()), details: { w: 2 }, lineTotal: 150 });
    (it.details as any).w = 999;                     // mutate current details
    expect(it.versions![0].details.w).toBe(1);       // original snapshot untouched
    expect(it.versions![1].details.w).toBe(2);
  });
});
