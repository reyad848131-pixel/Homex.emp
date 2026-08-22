import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { settingsAccessIds, canAccessSettings } from "@/lib/settings-access";
import SettingsClient from "./settings-client";

// Settings is restricted to the two permanent owners (Riyad / Salim by civil id)
// plus anyone they designate in Settings. Enforced here on the server so the
// page can't be reached by URL, and again in the settings API for saves.
export default async function SettingsPage() {
  const session = await getAuth();
  if (!session) redirect("/login");
  const user = session.user as { id: string; civilId: string };
  const editorIds = await settingsAccessIds().catch(() => [] as string[]);
  if (!canAccessSettings(user.civilId, user.id, editorIds)) redirect("/");
  return <SettingsClient />;
}
