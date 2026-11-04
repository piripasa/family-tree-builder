import { avatarMarkup, portraitKind, type PortraitKind } from "@/model/portrait";
import type { Person } from "@/model/types";

export function PersonPortrait({ person, size }: { person: Person; size: number }) {
  const kind = portraitKind(person);
  return (
    <span className="portrait" style={{ width: size, height: size }}>
      {kind === "photo" ? <img src={person.photo} alt="" /> : <Avatar kind={kind} />}
    </span>
  );
}

export function Avatar({ kind }: { kind: Exclude<PortraitKind, "photo"> }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" dangerouslySetInnerHTML={{ __html: avatarMarkup(kind) }} />
  );
}
