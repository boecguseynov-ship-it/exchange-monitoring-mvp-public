import { saveContactLinkAction } from "../src/lib/admin-actions";
import { prisma } from "../src/lib/db/prisma";

// Mock FormData
class MockFormData {
  private data = new Map<string, string>();
  append(key: string, value: string) {
    this.data.set(key, value);
  }
  get(key: string) {
    return this.data.get(key) ?? null;
  }
}

async function main() {
  // Find the telegram link
  const linkBefore = await prisma.wikiEntry.findFirst({
    where: { group: "contactSocial", title: "Telegram" }
  });
  console.log("Before:", linkBefore);

  if (!linkBefore) return;

  // Let's call saveContactLinkAction
  const formData = new MockFormData() as any;
  formData.append("id", linkBefore.id);
  formData.append("key", linkBefore.icon);
  formData.append("label", "Telegram");
  formData.append("href", "https://t.me/test");
  formData.append("position", "20");
  // "enabled" is omitted, simulating unchecked checkbox

  // We need to bypass auth by mocking assertAuthRole/requireAdminAction if needed, 
  // but wait, requireAdminAction calls assertAuthRole. Let's see if it throws.
  try {
    await saveContactLinkAction(formData);
  } catch (e: any) {
    console.log("Action threw error (expected if auth is check, but let's see):", e.message);
  }

  // Let's check DB anyway
  const linkAfter = await prisma.wikiEntry.findUnique({
    where: { id: linkBefore.id }
  });
  console.log("After:", linkAfter);
}

main().catch(console.error);
