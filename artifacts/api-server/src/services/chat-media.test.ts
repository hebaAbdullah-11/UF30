import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { assertMediaOwner, mediaOwnerKey, MediaError, validateChatImage } from "./chat-media-policy.ts";

test("private attachments reject other accounts, kinds, URLs and traversal", () => {
  const path = `/objects/chat/${mediaOwnerKey("synthetic-owner")}/image/${randomUUID()}.png`;
  assert.doesNotThrow(() => assertMediaOwner("synthetic-owner", path, "image"));
  for (const bad of [path.replace("/image/", "/audio/"), `${path}/../x`, "https://example.com/photo.png", "/objects/../secret"]) {
    assert.throws(() => assertMediaOwner("synthetic-owner", bad, "image"), MediaError);
  }
  assert.throws(() => assertMediaOwner("another-owner", path, "image"), MediaError);
});
for (const format of ["jpeg", "png", "webp"] as const) {
  test(`valid ${format} image bytes are decoded, bounded and normalized for vision`, async () => {
    const original = await sharp({ create: { width: 2500, height: 100, channels: 3, background: "red" } })[format]().toBuffer();
    const output = await validateChatImage(original);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 2048);
    assert.equal(metadata.exif, undefined);
  });
}
test("empty, disguised, corrupt and SVG image uploads cannot reach the model", async () => {
  for (const invalid of [Buffer.alloc(0), Buffer.from("filename.png"), Buffer.from("<svg><script>alert(1)</script></svg>"), Buffer.from([137, 80, 78, 71])]) {
    await assert.rejects(validateChatImage(invalid), MediaError);
  }
});
