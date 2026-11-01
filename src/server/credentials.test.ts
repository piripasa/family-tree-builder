import { describe, expect, it } from "vitest";
import { normalizeEmail, passwordError } from "./credentials";

describe("credentials", () => {
  it("accepts an email and a usable password", () => {
    expect(normalizeEmail("  Ada@Example.com ")).toBe("ada@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@b.co`)).toBeNull();
    expect(passwordError("short")).toBe("Use at least 8 characters.");
    expect(passwordError("a".repeat(201))).toBe("That password is too long.");
    expect(passwordError("long-enough")).toBeNull();
  });
});
