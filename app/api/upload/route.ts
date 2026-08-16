import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { uploadImageBuffer } from "@/lib/cloudinary";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Signatures are checked against the actual buffer bytes — the client-supplied
// Content-Type / filename extension are never trusted for this decision.
const IMAGE_SIGNATURES: { mime: string; matches: (b: Buffer) => boolean }[] = [
  {
    mime: "image/jpeg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50, // "WEBP"
  },
];

function detectImageMimeType(buffer: Buffer): string | null {
  return IMAGE_SIGNATURES.find((sig) => sig.matches(buffer))?.mime ?? null;
}

export async function POST(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file ảnh (field 'file')" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File vượt quá dung lượng cho phép (tối đa 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = detectImageMimeType(buffer);
  if (!mimeType) {
    return NextResponse.json(
      { error: "File không phải ảnh hợp lệ (chỉ chấp nhận JPEG, PNG hoặc WebP)" },
      { status: 400 },
    );
  }

  try {
    const result = await uploadImageBuffer(buffer, { folder: "your-shelve" });
    return NextResponse.json({ url: result.secure_url }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload ảnh thất bại, vui lòng thử lại" }, { status: 502 });
  }
}
