import "server-only";
import { spawn } from "child_process";
import { mkdtemp, readFile, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Strip metadata (GPS, author, creation device, chapters) from an audio or
 * video file using ffmpeg-static.
 *
 * Uses -c copy, so no re-encode. A 25MB file strips in ~1 second. The
 * stripping is the whole point: MP4 and MOV containers can carry GPS
 * coordinates that would identify where a reporter physically stood. SPEC
 * rule 2 promises metadata is stripped from all uploads.
 *
 * Fail-closed by design: any failure (spawn error, non-zero exit, timeout,
 * missing binary) throws. Callers must catch and reject the upload rather
 * than store the raw file.
 */

const TIMEOUT_MS = 25_000;

let ffmpegPath: string | null = null;
try {
  // ffmpeg-static has no TypeScript types. It exports the absolute path
  // to the binary at require-time, resolving per-platform.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ffmpegPath = require("ffmpeg-static") as string;
} catch {
  ffmpegPath = null;
}

export async function stripMediaMetadata(
  input: Buffer,
  ext: string
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static not available — refusing to store raw media");
  }

  const dir = await mkdtemp(join(tmpdir(), "wd-strip-"));
  const inputPath = join(dir, `input.${ext}`);
  const outputPath = join(dir, `output.${ext}`);

  try {
    await writeFile(inputPath, input);

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-y",
        "-i",
        inputPath,
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-c",
        "copy",
        outputPath
      ];

      const proc = spawn(ffmpegPath as string, args, {
        stdio: ["ignore", "ignore", "pipe"]
      });

      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-2000);
      });

      const timer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        reject(new Error("ffmpeg timed out"));
      }, TIMEOUT_MS);

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `ffmpeg exit ${code}: ${stderr.split("\n").slice(-3).join(" | ")}`
            )
          );
        }
      });
    });

    const out = await readFile(outputPath);
    if (out.length === 0) {
      throw new Error("ffmpeg produced empty output");
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {
      /* ignore */
    });
  }
}