// An item's description is auto-built as parts joined by " · " (e.g.
// "مطبخ 2.6م · MDF - 2 Unit · اكسسوارات المطبخ: درج، سلة · ملاحظة"). Parsing it
// lets every screen render it structured instead of one long line: a title
// (with measurements), accessories broken into chips, and the rest as tags.
export interface ParsedDesc {
  title: string;
  accessories: { label: string; values: string[] }[];
  others: string[];
}

export function parseItemDesc(text: string | null | undefined): ParsedDesc {
  const parts = (text || "").split(" · ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { title: "", accessories: [], others: [] };
  const [title, ...rest] = parts;
  const isAcc = (p: string) => /اكسسوار|إكسسوار|accessor/i.test(p);
  const accessories = rest.filter(isAcc).map((a) => {
    const idx = a.indexOf(":");
    const label = idx > -1 ? a.slice(0, idx).trim() : "اكسسوارات";
    const values = (idx > -1 ? a.slice(idx + 1) : a).split("،").map((x) => x.trim()).filter(Boolean);
    return { label, values };
  });
  const others = rest.filter((p) => !isAcc(p));
  return { title: title || "", accessories, others };
}
