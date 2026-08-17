import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { upsertCollectionSchema } from "@/lib/validation/collection";

export async function PUT(request: Request, context: RouteContext<"/api/collections/[volumeId]">) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { volumeId } = await context.params;

  const volume = await prisma.volume.findUnique({ where: { id: volumeId } });
  if (!volume) {
    return NextResponse.json({ error: "Không tìm thấy volume" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { owned, edition, price, purchaseDate } = parsed.data;
  const priceValue = price ?? null;
  const purchaseDateValue = purchaseDate ? new Date(purchaseDate) : null;

  // userId comes from the verified token, never from the body — the compound key below
  // ties the write to the current user regardless of what volumeId is requested.
  const collection = await prisma.userCollection.upsert({
    where: { userId_volumeId: { userId, volumeId } },
    create: {
      userId,
      volumeId,
      owned,
      edition,
      price: priceValue,
      purchaseDate: purchaseDateValue,
    },
    update: {
      owned,
      edition,
      price: priceValue,
      purchaseDate: purchaseDateValue,
    },
  });

  return NextResponse.json(collection);
}

export async function DELETE(request: Request, context: RouteContext<"/api/collections/[volumeId]">) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { volumeId } = await context.params;

  try {
    // userId is part of the lookup key itself, not a separate check-then-delete step —
    // this can never delete another user's collection row for the same volumeId.
    await prisma.userCollection.delete({
      where: { userId_volumeId: { userId, volumeId } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy bản ghi sưu tầm" }, { status: 404 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
