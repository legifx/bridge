import { NextResponse } from "next/server";

/**
 * Read a JSON body with a hard size ceiling.
 *
 * `await req.json()` buffers whatever arrives — the whole body lands in memory
 * before any schema gets to reject it. A capture request legitimately carries
 * megabytes of base64 pages, so the app cannot simply refuse large bodies; but
 * without a ceiling, one request can exhaust the process (and on a small box,
 * take every other learner's session down with it). Validation limits in Zod
 * run too late to help: the memory is already gone.
 *
 * Checks Content-Length first (cheap, honest clients), then counts bytes while
 * streaming so a lying or chunked request is cut off mid-flight.
 */
export const MAX_JSON_BYTES = 24 * 1024 * 1024; // captures: 16 downscaled pages + slack
export const MAX_SMALL_JSON_BYTES = 256 * 1024; // everything that is just ids and short text

export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large.");
    this.name = "BodyTooLargeError";
  }
}

export async function readJson(req: Request, maxBytes = MAX_SMALL_JSON_BYTES): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();

  const body = req.body;
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(joined));
}

/** 413 with a shape the client already knows how to show. */
export function tooLargeResponse() {
  return NextResponse.json({ error: "That upload is too large." }, { status: 413 });
}
