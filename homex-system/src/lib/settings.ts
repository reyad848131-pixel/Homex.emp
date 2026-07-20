import { prisma } from "./prisma";

let cache: { data: Record<string, string>; ts: number } | null = null;
const TTL = 60_000;

export async function getSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  const rows = await prisma.settings.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  cache = { data: map, ts: Date.now() };
  return map;
}

export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  const all = await getSettings();
  return all[key] ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache = null;
}
