import { ACCOUNT_TREE_LIMIT, createLibrary } from "@/model/library";
import { parseTreeDocument } from "@/model/io";
import { sharedTree } from "@/model/share";
import {
  applySuggestion,
  parseSuggestion,
  readSuggestion,
  SUGGESTION_LIMIT,
  SuggestionError,
  type StoredSuggestion,
} from "@/model/suggestion";
import type { SavedTree, TreeDocument, TreeLibrary } from "@/model/types";
import { withDatabase, withTransaction, type Queryable } from "./db";
import { newSessionToken } from "./tokens";

export class AccountConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountConflict";
  }
}

export class AccountMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountMissing";
  }
}

type UserRow = { id: string; email: string; password_hash: string };

export async function createAccount(email: string, passwordHash: string, library: TreeLibrary): Promise<string> {
  const userId = crypto.randomUUID();
  try {
    await withTransaction(async (db) => {
      await db.query("INSERT INTO users (id, email, password_hash, active_tree_id) VALUES ($1, $2, $3, $4)", [
        userId,
        email,
        passwordHash,
        library.activeId,
      ]);
      for (let index = 0; index < library.trees.length; index += 1) {
        await insertTree(db, userId, library.trees[index], new Date(Date.now() + index));
      }
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      const constraint = "constraint" in error ? String(error.constraint) : "";
      throw new AccountConflict(
        constraint.includes("email")
          ? "An account with that email already exists."
          : "That tree is already in this account.",
      );
    }
    throw error;
  }
  return userId;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return withDatabase(async (db) => {
    const result = await db.query<UserRow>("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    return result.rows[0] ?? null;
  });
}

export async function loadOwnedLibrary(userId: string): Promise<TreeLibrary> {
  return withDatabase(async (db) => {
    const trees = await listTrees(db, userId);
    if (trees.length === 0) {
      const library = createLibrary();
      await insertTree(db, userId, library.trees[0]);
      await db.query("UPDATE users SET active_tree_id = $2 WHERE id = $1", [userId, library.activeId]);
      return library;
    }
    const active = await db.query<{ active_tree_id: string | null }>(
      "SELECT active_tree_id FROM users WHERE id = $1",
      [userId],
    );
    const activeId = active.rows[0]?.active_tree_id;
    return {
      version: 1,
      activeId: activeId && trees.some((tree) => tree.id === activeId) ? activeId : trees[0].id,
      trees,
    };
  });
}

export async function insertOwnedTree(userId: string, tree: SavedTree): Promise<void> {
  try {
    await withTransaction(async (db) => {
      const count = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM trees WHERE owner_id = $1", [
        userId,
      ]);
      if ((count.rows[0]?.count ?? 0) >= ACCOUNT_TREE_LIMIT) {
        throw new AccountConflict("An account can keep 5 trees.");
      }
      await insertTree(db, userId, tree);
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new AccountConflict("That tree is already in this account.");
    }
    throw error;
  }
}

export async function updateOwnedTree(userId: string, tree: SavedTree): Promise<void> {
  await withDatabase(async (db) => {
    const result = await db.query(
      "UPDATE trees SET title = $3, document = $4::jsonb WHERE owner_id = $1 AND id = $2",
      [userId, tree.id, tree.title, JSON.stringify(tree.document)],
    );
    if (result.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
  });
}

export async function deleteOwnedTree(userId: string, treeId: string): Promise<void> {
  await withDatabase(async (db) => {
    const result = await db.query("DELETE FROM trees WHERE owner_id = $1 AND id = $2", [userId, treeId]);
    if (result.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
    await db.query("UPDATE users SET active_tree_id = NULL WHERE id = $1 AND active_tree_id = $2", [userId, treeId]);
  });
}

async function ownedTree(db: Queryable, userId: string, treeId: string): Promise<void> {
  const owned = await db.query("SELECT 1 FROM trees WHERE owner_id = $1 AND id = $2", [userId, treeId]);
  if (owned.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
}

export async function ensureShare(userId: string, treeId: string): Promise<string> {
  return withDatabase(async (db) => {
    await ownedTree(db, userId, treeId);
    const existing = await db.query<{ token: string }>(
      "SELECT token FROM shares WHERE owner_id = $1 AND tree_id = $2",
      [userId, treeId],
    );
    if (existing.rows[0]) return existing.rows[0].token;
    const token = newSessionToken();
    try {
      await db.query("INSERT INTO shares (token, owner_id, tree_id) VALUES ($1, $2, $3)", [token, userId, treeId]);
      return token;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        const again = await db.query<{ token: string }>(
          "SELECT token FROM shares WHERE owner_id = $1 AND tree_id = $2",
          [userId, treeId],
        );
        if (again.rows[0]) return again.rows[0].token;
      }
      throw error;
    }
  });
}

export async function findShare(userId: string, treeId: string): Promise<string | null> {
  return withDatabase(async (db) => {
    await ownedTree(db, userId, treeId);
    const existing = await db.query<{ token: string }>(
      "SELECT token FROM shares WHERE owner_id = $1 AND tree_id = $2",
      [userId, treeId],
    );
    return existing.rows[0]?.token ?? null;
  });
}

export async function revokeShare(userId: string, treeId: string): Promise<void> {
  return withDatabase(async (db) => {
    await ownedTree(db, userId, treeId);
    await db.query("DELETE FROM shares WHERE owner_id = $1 AND tree_id = $2", [userId, treeId]);
  });
}

export async function replaceShare(userId: string, treeId: string): Promise<string> {
  return withDatabase(async (db) => {
    await ownedTree(db, userId, treeId);
    const token = newSessionToken();
    const updated = await db.query(
      "UPDATE shares SET token = $3, created_at = now() WHERE owner_id = $1 AND tree_id = $2",
      [userId, treeId, token],
    );
    if (updated.rowCount === 1) return token;
    try {
      await db.query("INSERT INTO shares (token, owner_id, tree_id) VALUES ($1, $2, $3)", [token, userId, treeId]);
      return token;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        const again = await db.query(
          "UPDATE shares SET token = $3, created_at = now() WHERE owner_id = $1 AND tree_id = $2",
          [userId, treeId, token],
        );
        if (again.rowCount === 1) return token;
      }
      throw error;
    }
  });
}

export async function loadSharedByToken(token: string): Promise<{ title: string; document: TreeDocument } | null> {
  return withDatabase(async (db) => {
    const result = await db.query<{ title: string; document: unknown }>(
      `SELECT trees.title, trees.document
       FROM shares
       JOIN trees ON trees.owner_id = shares.owner_id AND trees.id = shares.tree_id
       WHERE shares.token = $1`,
      [token],
    );
    const row = result.rows[0];
    if (!row) return null;
    const parsed = parseTreeDocument(row.document);
    if (!parsed.ok) return null;
    return { title: row.title, document: sharedTree(parsed.document) };
  });
}

export async function addSuggestion(token: string, input: unknown): Promise<string> {
  return withTransaction(async (db) => {
    const found = await db.query<{ owner_id: string; tree_id: string; document: unknown }>(
      `SELECT shares.owner_id, shares.tree_id, trees.document
       FROM shares
       JOIN trees ON trees.owner_id = shares.owner_id AND trees.id = shares.tree_id
       WHERE shares.token = $1
       FOR UPDATE OF trees`,
      [token],
    );
    const row = found.rows[0];
    if (!row) throw new AccountMissing("That share link could not be found.");
    const parsed = parseTreeDocument(row.document);
    if (!parsed.ok) throw new SuggestionError("That share link could not be found.");
    const count = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM suggestions WHERE owner_id = $1 AND tree_id = $2",
      [row.owner_id, row.tree_id],
    );
    if (Number(count.rows[0]?.count ?? 0) >= SUGGESTION_LIMIT) {
      throw new AccountConflict("This tree already has 30 suggestions waiting.");
    }
    const suggestion = readSuggestion(input, parsed.document);
    if (!suggestion.ok) throw new SuggestionError(suggestion.error);
    const preview = applySuggestion(parsed.document, suggestion.suggestion);
    if (!preview.ok) throw new SuggestionError(preview.error);
    const id = crypto.randomUUID();
    await db.query("INSERT INTO suggestions (id, owner_id, tree_id, payload) VALUES ($1, $2, $3, $4::jsonb)", [
      id,
      row.owner_id,
      row.tree_id,
      JSON.stringify(suggestion.suggestion),
    ]);
    return id;
  });
}

export async function listSuggestions(userId: string, treeId: string): Promise<StoredSuggestion[]> {
  return withDatabase(async (db) => {
    const owned = await db.query("SELECT 1 FROM trees WHERE owner_id = $1 AND id = $2", [userId, treeId]);
    if (owned.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
    const result = await db.query<{ id: string; payload: unknown }>(
      "SELECT id, payload FROM suggestions WHERE owner_id = $1 AND tree_id = $2 ORDER BY created_at, id",
      [userId, treeId],
    );
    const suggestions: StoredSuggestion[] = [];
    for (const row of result.rows) {
      const parsed = parseSuggestion(row.payload);
      if (parsed.ok) suggestions.push({ ...parsed.suggestion, id: row.id });
    }
    return suggestions;
  });
}

export async function acceptSuggestion(userId: string, treeId: string, suggestionId: string): Promise<TreeDocument> {
  return withTransaction(async (db) => {
    const tree = await db.query<{ document: unknown }>(
      "SELECT document FROM trees WHERE owner_id = $1 AND id = $2 FOR UPDATE",
      [userId, treeId],
    );
    if (tree.rowCount !== 1 || !tree.rows[0]) throw new AccountMissing("That tree is not in this account.");
    const waiting = await db.query<{ payload: unknown }>(
      "SELECT payload FROM suggestions WHERE id = $1 AND owner_id = $2 AND tree_id = $3 FOR UPDATE",
      [suggestionId, userId, treeId],
    );
    if (waiting.rowCount !== 1 || !waiting.rows[0]) throw new AccountMissing("That suggestion is no longer waiting.");
    const parsed = parseTreeDocument(tree.rows[0].document);
    if (!parsed.ok) throw new SuggestionError("That tree is unreadable.");
    const suggestion = parseSuggestion(waiting.rows[0].payload);
    if (!suggestion.ok) throw new SuggestionError(suggestion.error);
    const applied = applySuggestion(parsed.document, suggestion.suggestion);
    if (!applied.ok) throw new SuggestionError(applied.error);
    await db.query("UPDATE trees SET document = $3::jsonb WHERE owner_id = $1 AND id = $2", [
      userId,
      treeId,
      JSON.stringify(applied.document),
    ]);
    await db.query("DELETE FROM suggestions WHERE id = $1", [suggestionId]);
    return applied.document;
  });
}

export async function declineSuggestion(userId: string, treeId: string, suggestionId: string): Promise<void> {
  return withDatabase(async (db) => {
    const result = await db.query("DELETE FROM suggestions WHERE id = $1 AND owner_id = $2 AND tree_id = $3", [
      suggestionId,
      userId,
      treeId,
    ]);
    if (result.rowCount !== 1) throw new AccountMissing("That suggestion is no longer waiting.");
  });
}

export async function setOwnedActiveTree(userId: string, treeId: string): Promise<void> {
  await withDatabase(async (db) => {
    const result = await db.query(
      `UPDATE users SET active_tree_id = $2
       WHERE id = $1 AND EXISTS (SELECT 1 FROM trees WHERE owner_id = $1 AND id = $2)`,
      [userId, treeId],
    );
    if (result.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
  });
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await withDatabase(async (db) => {
    await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
      tokenHash,
      userId,
      expiresAt.toISOString(),
    ]);
  });
}

export async function userForSession(tokenHash: string): Promise<{ id: string; email: string } | null> {
  return withDatabase(async (db) => {
    const result = await db.query<{ id: string; email: string }>(
      `SELECT users.id, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  });
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await withDatabase(async (db) => {
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  });
}

async function listTrees(db: Queryable, userId: string): Promise<SavedTree[]> {
  const result = await db.query<{ id: string; title: string; document: unknown }>(
    "SELECT id, title, document FROM trees WHERE owner_id = $1 ORDER BY created_at, id",
    [userId],
  );
  const trees: SavedTree[] = [];
  for (const row of result.rows) {
    const parsed = parseTreeDocument(row.document);
    if (!parsed.ok) continue;
    trees.push({ id: row.id, title: row.title, document: parsed.document });
  }
  return trees;
}

async function insertTree(db: Queryable, userId: string, tree: SavedTree, createdAt = new Date()): Promise<void> {
  await db.query(
    "INSERT INTO trees (id, owner_id, title, document, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)",
    [tree.id, userId, tree.title, JSON.stringify(tree.document), createdAt.toISOString()],
  );
}
