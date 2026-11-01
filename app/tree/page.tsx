import { TreeApp } from "@/components/TreeApp";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { readLocale } from "@/i18n/serverLocale";

export async function generateMetadata() {
  const messages = (await readLocale()) === "bn" ? bn : en;
  return { title: messages.treeTitle };
}

export default function TreePage() {
  return <TreeApp />;
}
