import { afterEach, describe, expect, it, vi } from "vitest";
import { readProfilePhoto } from "./photo";

class FakeImage {
  width = 960;
  height = 480;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("readProfilePhoto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a file that is not an image or is too large", async () => {
    await expect(readProfilePhoto({ type: "text/plain", size: 10 } as File)).rejects.toThrow("Choose an image file.");
    await expect(readProfilePhoto({ type: "image/png", size: 8 * 1024 * 1024 + 1 } as File)).rejects.toThrow(
      "That image is too large.",
    );
  });

  it("resizes the longest edge to 480 pixels", async () => {
    const drawn: number[] = [];
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:photo", revokeObjectURL: () => undefined });
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage(_image: unknown, _x: number, _y: number, width: number, height: number) {
            drawn.push(width, height);
          },
        }),
        toDataURL: () => "data:image/jpeg;base64,small",
      }),
    });
    await expect(readProfilePhoto({ type: "image/png", size: 20 } as File)).resolves.toBe("data:image/jpeg;base64,small");
    expect(drawn).toEqual([480, 240]);
  });

  it("reports an image that cannot be read", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:photo", revokeObjectURL: () => undefined });
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    await expect(readProfilePhoto({ type: "image/png", size: 20 } as File)).rejects.toThrow("That image could not be read.");

    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    await expect(readProfilePhoto({ type: "image/png", size: 20 } as File)).rejects.toThrow("That image could not be read.");
  });
});
