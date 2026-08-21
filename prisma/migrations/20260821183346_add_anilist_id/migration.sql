-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "anilistId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Series_anilistId_key" ON "Series"("anilistId");

