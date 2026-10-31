export type Person = {
  id: string;
  givenName: string;
  familyName: string;
};

export type Partnership = {
  id: string;
  partnerIds: string[];
  childIds: string[];
};

export type TreeDocument = {
  version: 1;
  people: Person[];
  partnerships: Partnership[];
  focusId: string | null;
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
