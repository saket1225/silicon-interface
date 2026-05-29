import { api } from "./api";
import { glyphSvg } from "./glyph";

/**
 * Deterministic Silicon glyph for a handle. Direct port of GlyphGenerator
 * (radial 7×7 grid of triangles/full/empty cells, character-by-character
 * progressive growth). Same handle always produces the same mark.
 */
export function identiconSvg(seed: string, size = 256): string {
  return glyphSvg(seed || "?", { size });
}

/**
 * Generate a new Carbon's jdenticon avatar from their Carbon ID, store it in the
 * `profile-icons/` tree in S3 via the presign flow, and point their profile at
 * it. Best-effort: never blocks sign-up — returns the stored key or null.
 * Requires an authenticated session (call after the session is set).
 */
export async function generateAndStoreAvatar(carbonId: string): Promise<string | null> {
  try {
    const svg = identiconSvg(carbonId, 256);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const r = await api.presignUpload({
      mime: "image/svg+xml",
      size: blob.size,
      kind: "profile_icon",
      filename: `${carbonId}.svg`,
    });
    if (!r.upload.dev_mode) {
      const form = new FormData();
      for (const [k, v] of Object.entries(r.upload.fields)) form.append(k, v);
      form.append("file", blob, `${carbonId}.svg`);
      const up = await fetch(r.upload.url, { method: r.upload.method || "POST", body: form });
      if (!up.ok) throw new Error(`upload failed (${up.status})`);
      // Flip pending → ready so the photo URL resolves immediately.
      await api.mediaComplete(r.media.media_id);
    }
    const key = (r.upload.fields as Record<string, string>).key || r.media.media_id;
    await api.patchMe({ profile_photo_key: key });
    return key;
  } catch {
    return null;
  }
}
