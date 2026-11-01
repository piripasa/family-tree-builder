"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLibrary } from "@/model/storage";

export function OpenTreeLink({ className }: { className?: string }) {
  const [label, setLabel] = useState("Start a tree");

  useEffect(() => {
    const library = loadLibrary();
    const hasPeople = library.trees.some((tree) => tree.document.people.length > 0);
    setLabel(hasPeople ? "Open your tree" : "Start a tree");
  }, []);

  return (
    <Link className={className} href="/tree">
      {label}
    </Link>
  );
}
