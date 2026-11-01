import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("accepts the original password and rejects anything else", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
    expect(await verifyPassword("correct horse", "plain")).toBe(false);
    expect(await verifyPassword("correct horse", `${stored}x`)).toBe(false);
  });
});
