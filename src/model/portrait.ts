import { isHiddenOnShare } from "./share";
import type { Person } from "./types";

export type PortraitKind = "photo" | "male" | "female" | "other" | "neutral";

export function portraitKind(person: Person): PortraitKind {
  if (isHiddenOnShare(person)) return "neutral";
  if (person.photo) return "photo";
  if (person.gender === "male" || person.gender === "female" || person.gender === "other") return person.gender;
  return "neutral";
}

export function avatarMarkup(kind: Exclude<PortraitKind, "photo">): string {
  if (kind === "male") {
    return `<circle cx="16" cy="16" r="16" fill="#d7e4dc"/><path d="M6.2 28.2c1-6.6 4.2-9.6 9.8-9.6s8.8 3 9.8 9.6" fill="#234237"/><circle cx="16" cy="13.2" r="5" fill="#f7f1e8"/><path d="M11 12.6c.15-2.8 2.1-4.8 5-4.8s4.85 2 5 4.8c-1.1-1.2-2.7-1.8-5-1.8s-3.9.6-5 1.8z" fill="#1c332b"/>`;
  }
  if (kind === "female") {
    return `<circle cx="16" cy="16" r="16" fill="#f3e2da"/><path d="M9 11.5c.4-4.6 3-7.4 7-7.4s6.6 2.8 7 7.4c.5 3.2-.1 7.4-1.4 10.2-1.5.6-3.2.9-5.6.9s-4.1-.3-5.6-.9C9.1 18.9 8.5 14.7 9 11.5z" fill="#6a4038"/><circle cx="16" cy="13.4" r="4.4" fill="#f7f1e8"/><path d="M6.8 28.4c1.2-5.4 4-7.8 9.2-7.8s8 2.4 9.2 7.8" fill="#6a4038"/>`;
  }
  if (kind === "other") {
    return `<circle cx="16" cy="16" r="16" fill="#e3e6f1"/><path d="M6.4 28c1-6.2 4.2-9.2 9.6-9.2s8.6 3 9.6 9.2" fill="#3c4a6b"/><circle cx="16" cy="13.2" r="4.8" fill="#f7f1e8"/><path d="M10.4 13.2c.5-3.6 2.6-5.8 5.6-5.8s5.1 2.2 5.6 5.8c-.6 1.2-2 2.2-5.6 2.2s-5-1-5.6-2.2z" fill="#3c4a6b"/>`;
  }
  return `<circle cx="16" cy="16" r="16" fill="#e7e0d4"/><circle cx="16" cy="12.6" r="4.5" fill="#8d8374"/><path d="M7.2 27.6c.9-5.4 3.8-8 8.8-8s7.9 2.6 8.8 8" fill="#8d8374"/>`;
}
