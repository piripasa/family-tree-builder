import { ACCOUNT_TREE_LIMIT, createLibrary } from "@/model/library";
import { parseTreeDocument } from "@/model/io";
import { sharedTree } from "@/model/share";
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

export async function ensureShare(userId: string, treeId: string): Promise<string> {
  return withDatabase(async (db) => {
    const owned = await db.query("SELECT 1 FROM trees WHERE owner_id = $1 AND id = $2", [userId, treeId]);
    if (owned.rowCount !== 1) throw new AccountMissing("That tree is not in this account.");
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
