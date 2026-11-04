import exifr from "exifr";
import sharp from "sharp";

export type GpsInfo = {
  latitude?: number;
  longitude?: number;
} | null;

export async function readGps(buffer: Buffer): Promise<GpsInfo> {
  try {
    const gps = await exifr.gps(buffer);
    if (!gps) return null;
    if (gps.latitude == null && gps.longitude == null) return null;
    return { latitude: gps.latitude, longitude: gps.longitude };
  } catch {
    return null;
  }
}

async function reencodeCleanJpeg(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

/** Client-equivalent pass: decode to pixels and re-encode with no metadata. */
export async function stripExifClient(buffer: Buffer): Promise<Buffer> {
  return reencodeCleanJpeg(buffer);
}

/** Server pass: sharp rotate + buffer, then verify no GPS remains. */
export async function stripExifServer(buffer: Buffer): Promise<Buffer> {
  const out = await sharp(buffer).rotate().jpeg({ quality: 86 }).toBuffer();
  const gps = await readGps(out);
  if (gps && (gps.latitude != null || gps.longitude != null)) {
    return reencodeCleanJpeg(buffer);
  }
  const meta = await sharp(out).metadata();
  if (meta.exif) {
    return reencodeCleanJpeg(out);
  }
  return out;
}

export async function stripExifBoth(buffer: Buffer): Promise<Buffer> {
  const client = await stripExifClient(buffer);
  return stripExifServer(client);
}
