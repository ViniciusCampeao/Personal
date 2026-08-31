-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "logoKey" TEXT;

-- CreateTable
CREATE TABLE "ExerciseNameOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseNameOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseNameOverride_tenantId_exerciseId_key" ON "ExerciseNameOverride"("tenantId", "exerciseId");

-- AddForeignKey
ALTER TABLE "ExerciseNameOverride" ADD CONSTRAINT "ExerciseNameOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseNameOverride" ADD CONSTRAINT "ExerciseNameOverride_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
