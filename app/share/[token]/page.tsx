import { SharedView } from "@/components/SharedView";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { readLocale } from "@/i18n/serverLocale";

export async function generateMetadata() {
  const messages = (await readLocale()) === "bn" ? bn : en;
  return { title: messages.sharedTitle };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedView token={token} />;
}
