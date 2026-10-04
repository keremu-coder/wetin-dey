import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { readGps, stripExifClient, stripExifServer } from "./exif";

async function jpegWithGps(): Promise<Buffer> {
  const base = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 31, g: 122, b: 77 }
    }
  })
    .jpeg()
    .toBuffer();

  const withMeta = await sharp(base)
    .withMetadata({
      exif: {
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: [[6, 1], [27, 1], [0, 1]],
          GPSLongitudeRef: "E",
          GPSLongitude: [[3, 1], [23, 1], [0, 1]]
        }
      }
    })
    .jpeg()
    .toBuffer();

  const gps = await readGps(withMeta);
  if (gps && gps.latitude != null) {
    return withMeta;
  }

  return injectApp1Gps(base);
}

function injectApp1Gps(jpeg: Buffer): Buffer {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error("not jpeg");
  }
  const app1 = buildGpsApp1();
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

function buildGpsApp1(): Buffer {
  const tiffHeader = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00
  ]);

  const ifd0Count = Buffer.from([0x02, 0x00]);
  const gpsPointerOffset = 8 + 2 + 12 * 2 + 4;
  const ifd0 = Buffer.concat([
    ifd0Count,
    Buffer.from([0x1a, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from([0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00]),
    u32(gpsPointerOffset),
    u32(0)
  ]);

  const gpsIfdCount = Buffer.from([0x05, 0x00]);
  const numbersStart = gpsPointerOffset + 2 + 12 * 5 + 4;
  const gpsIfd = Buffer.concat([
    gpsIfdCount,
    tag(0x0001, 2, 2, Buffer.from("N\0\0\0")),
    tag(0x0002, 5, 3, u32(numbersStart)),
    tag(0x0003, 2, 2, Buffer.from("E\0\0\0")),
    tag(0x0004, 5, 3, u32(numbersStart + 24)),
    tag(0x0005, 1, 1, u32(0)),
    u32(0)
  ]);

  const rationals = Buffer.concat([
    u32(6), u32(1), u32(27), u32(1), u32(0), u32(1),
    u32(3), u32(1), u32(23), u32(1), u32(0), u32(1)
  ]);

  const tiff = Buffer.concat([tiffHeader, ifd0, gpsIfd, rationals]);
  const exifHeader = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const len = exifHeader.length + 2;
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]),
    exifHeader
  ]);
  return app1;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function tag(id: number, type: number, count: number, value: Buffer): Buffer {
  const b = Buffer.alloc(12);
  b.writeUInt16LE(id, 0);
  b.writeUInt16LE(type, 2);
  b.writeUInt32LE(count, 4);
  value.copy(b, 8);
  return b;
}

describe("EXIF GPS stripping", () => {
  it("fails if GPS survives the client pass", async () => {
    const dirty = await jpegWithGps();
    const before = await readGps(dirty);
    expect(before?.latitude ?? null, "fixture must contain GPS latitude").not.toBeNull();
    expect(before?.longitude ?? null, "fixture must contain GPS longitude").not.toBeNull();

    const cleaned = await stripExifClient(dirty);
    const after = await readGps(cleaned);
    expect(after?.latitude ?? null).toBeNull();
    expect(after?.longitude ?? null).toBeNull();
  });

  it("fails if GPS survives the server pass", async () => {
    const dirty = await jpegWithGps();
    const before = await readGps(dirty);
    expect(before?.latitude ?? null, "fixture must contain GPS latitude").not.toBeNull();
    expect(before?.longitude ?? null, "fixture must contain GPS longitude").not.toBeNull();

    const cleaned = await stripExifServer(dirty);
    const after = await readGps(cleaned);
    expect(after?.latitude ?? null).toBeNull();
    expect(after?.longitude ?? null).toBeNull();
  });
});
