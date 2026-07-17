import { prisma } from "./prisma";

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.settings.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  const row = await prisma.settings.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
