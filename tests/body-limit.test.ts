import { describe, it, expect } from "vitest";
import { readJson, BodyTooLargeError, MAX_SMALL_JSON_BYTES } from "@/lib/api/body";

/** A Request whose body streams in chunks, like a real upload. */
function streamed(text: string, opts?: { contentLength?: string; chunk?: number }): Request {
  const bytes = new TextEncoder().encode(text);
  const chunk = opts?.chunk ?? 64 * 1024;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });
  const headers = new Headers({ "content-type": "application/json" });
  if (opts?.contentLength !== undefined) headers.set("content-length", opts.contentLength);
  // duplex is required for a streaming request body
  return new Request("http://test/api", { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

describe("readJson", () => {
  it("parses a normal body", async () => {
    const req = streamed(JSON.stringify({ conceptId: "abc", n: 1 }));
    await expect(readJson(req)).resolves.toEqual({ conceptId: "abc", n: 1 });
  });

  it("rejects a body over the limit", async () => {
    const big = JSON.stringify({ text: "x".repeat(MAX_SMALL_JSON_BYTES + 1000) });
    await expect(readJson(streamed(big))).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rejects on Content-Length before reading a single byte", async () => {
    const req = streamed("{}", { contentLength: String(MAX_SMALL_JSON_BYTES * 10) });
    await expect(readJson(req)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("still stops a body that lies about its Content-Length", async () => {
    // The dangerous case: a small declared size, megabytes actually sent.
    const big = JSON.stringify({ text: "x".repeat(MAX_SMALL_JSON_BYTES + 1000) });
    const req = streamed(big, { contentLength: "10" });
    await expect(readJson(req)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("allows a large body where a larger limit is passed (captures)", async () => {
    const payload = JSON.stringify({ text: "x".repeat(MAX_SMALL_JSON_BYTES + 1000) });
    await expect(readJson(streamed(payload), MAX_SMALL_JSON_BYTES * 4)).resolves.toBeTruthy();
  });

  it("surfaces malformed JSON as a parse error, not a size error", async () => {
    await expect(readJson(streamed("{not json"))).rejects.not.toBeInstanceOf(BodyTooLargeError);
  });

  it("treats multi-byte characters by their byte length, not character count", async () => {
    // 3 bytes per character: a body that looks short but is not.
    const chars = Math.floor(MAX_SMALL_JSON_BYTES / 2);
    const payload = JSON.stringify({ text: "ü".repeat(chars) }); // 2 bytes each in UTF-8
    await expect(readJson(streamed(payload))).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
