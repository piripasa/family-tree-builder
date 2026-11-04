export type SourceFact = "name" | "birth" | "death" | "marriage";

export type SourceKind = "person" | "certificate" | "note";

export type FactSource = {
  id: string;
  fact: SourceFact;
  kind: SourceKind;
  detail: string;
};

export type Gender = "male" | "female" | "other";

export const SOCIAL_NETWORKS = [
  "facebook",
  "instagram",
  "x",
  "youtube",
  "linkedin",
  "tiktok",
  "whatsapp",
  "website",
  "other",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type SocialLink = {
  network: SocialNetwork;
  url: string;
};

export const SOCIAL_LIMIT = 8;

export function isSocialNetwork(value: string): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value);
}

export type Person = {
  id: string;
  givenName: string;
  familyName: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  socials?: SocialLink[];
  photo?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  note?: string;
  living?: boolean;
  sources?: FactSource[];
};

export type Partnership = {
  id: string;
  partnerIds: string[];
  childIds: string[];
  marriageDate?: string;
  marriagePlace?: string;
  sources?: FactSource[];
};

export type TreeDocument = {
  version: 1;
  people: Person[];
  partnerships: Partnership[];
  focusId: string | null;
};

export type SavedTree = {
  id: string;
  title: string;
  document: TreeDocument;
};

export type TreeLibrary = {
  version: 1;
  activeId: string;
  trees: SavedTree[];
};

export type RelativeSource =
  | { type: "new"; givenName: string; familyName: string }
  | { type: "existing"; personId: string };

export type TreeSuccess = {
  ok: true;
  document: TreeDocument;
  personId: string;
};

export type TreeFailure = {
  ok: false;
  error: string;
};

export type TreeResult = TreeSuccess | TreeFailure;
