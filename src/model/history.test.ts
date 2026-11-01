import { describe, expect, it } from "vitest";
import { emptyHistory, pushHistory, redoHistory, undoHistory } from "./history";

describe("history", () => {
  it("returns to the previous value and can redo it", () => {
    let history = emptyHistory<string>();
    history = pushHistory(history, "one");
    history = pushHistory(history, "two");
    const undone = undoHistory(history, "three");
    expect(undone?.value).toBe("two");
    const redone = undone && redoHistory(undone.history, undone.value);
    expect(redone?.value).toBe("three");
    expect(undoHistory(emptyHistory<string>(), "one")).toBeNull();
    expect(redoHistory(emptyHistory<string>(), "one")).toBeNull();
  });

  it("forgets the oldest step and drops redo after a new edit", () => {
    let history = emptyHistory<number>();
    for (let value = 0; value < 35; value += 1) history = pushHistory(history, value);
    expect(history.past).toHaveLength(30);
    expect(history.past[0]).toBe(5);
    const undone = undoHistory(history, 35);
    const again = undone && pushHistory(undone.history, undone.value);
    expect(again?.future).toEqual([]);
  });
});
