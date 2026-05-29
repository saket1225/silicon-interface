// Browser-side metadata extraction for uploads.
//
// • measureImage(file)  → { width, height }
// • computePeaks(blob)  → { duration_ms, peaks: number[] }
//
// Both return Promise<T | null> — we never block the upload on metadata,
// and a measurement failure just means the bubble gets the default
// placeholder treatment.

/** Decode an image enough to read its natural dimensions. */
export async function measureImage(
  file: File | Blob,
): Promise<{ width: number; height: number } | null> {
  if (!file || !file.type.startsWith("image/")) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Decode video metadata (duration + dimensions). */
export async function measureVideo(
  file: File | Blob,
): Promise<{ width: number; height: number; duration_ms: number } | null> {
  if (!file || !file.type.startsWith("video/")) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const out = {
        width: v.videoWidth,
        height: v.videoHeight,
        duration_ms: Math.round((v.duration || 0) * 1000),
      };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

/**
 * Decode an audio blob and compress its samples into a fixed-count peaks
 * array (0..1 normalized) plus the duration in ms. Uses OfflineAudioContext
 * for fully-headless decoding — never touches the speakers.
 */
export async function computePeaks(
  blob: Blob,
  bucketCount = 60,
): Promise<{ duration_ms: number; peaks: number[] } | null> {
  if (!blob || typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    const buf = await blob.arrayBuffer();
    const ctx = new Ctor();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    // Mono-mix every channel (max amplitude across channels) so the result
    // reads as the loudest envelope, not a single channel that happens to
    // be quieter.
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const samplesPerBucket = Math.max(1, Math.floor(length / bucketCount));
    const peaks: number[] = new Array(bucketCount).fill(0);
    for (let ch = 0; ch < channels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < bucketCount; i++) {
        const start = i * samplesPerBucket;
        const end = Math.min(start + samplesPerBucket, length);
        let peak = 0;
        for (let j = start; j < end; j++) {
          const v = Math.abs(data[j]);
          if (v > peak) peak = v;
        }
        if (peak > peaks[i]) peaks[i] = peak;
      }
    }
    // Normalize so the loudest moment hits 1.0 — the bars are a relative
    // shape, not an absolute level meter.
    let max = 0;
    for (const v of peaks) if (v > max) max = v;
    if (max > 0) {
      for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i] / max;
    }
    const duration_ms = Math.round(decoded.duration * 1000);
    try {
      await ctx.close();
    } catch {
      /* some browsers can't close offline contexts */
    }
    return { duration_ms, peaks: peaks.map((v) => Number(v.toFixed(3))) };
  } catch {
    return null;
  }
}
