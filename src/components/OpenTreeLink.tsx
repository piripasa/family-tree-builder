"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { loadLibrary } from "@/model/storage";

export function OpenTreeLink({ className }: { className?: string }) {
  const { messages } = useI18n();
  const [hasPeople, setHasPeople] = useState(false);

  useEffect(() => {
    const library = loadLibrary();
    setHasPeople(library.trees.some((tree) => tree.document.people.length > 0));
  }, []);

  return (
    <Link className={className} href="/tree">
      {hasPeople ? messages.home.openTree : messages.home.startTree}
    </Link>
  );
}
