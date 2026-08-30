-- CreateEnum
CREATE TYPE "AgendaEventType" AS ENUM ('TRAINING', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "AgendaEventStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELED');

-- CreateTable
CREATE TABLE "DietPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietMeal" (
    "id" TEXT NOT NULL,
    "dietId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "time" TEXT,
    "items" TEXT[],
    "position" INTEGER NOT NULL,

    CONSTRAINT "DietMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dietId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DietComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "studentId" TEXT,
    "type" "AgendaEventType" NOT NULL,
    "status" "AgendaEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DietPlan_tenantId_studentId_active_idx" ON "DietPlan"("tenantId", "studentId", "active");

-- CreateIndex
CREATE INDEX "DietMeal_dietId_position_idx" ON "DietMeal"("dietId", "position");

-- CreateIndex
CREATE INDEX "DietComment_tenantId_dietId_createdAt_idx" ON "DietComment"("tenantId", "dietId", "createdAt");

-- CreateIndex
CREATE INDEX "DietComment_authorId_idx" ON "DietComment"("authorId");

-- CreateIndex
CREATE INDEX "AgendaEvent_tenantId_trainerId_startsAt_idx" ON "AgendaEvent"("tenantId", "trainerId", "startsAt");

-- CreateIndex
CREATE INDEX "AgendaEvent_tenantId_studentId_startsAt_idx" ON "AgendaEvent"("tenantId", "studentId", "startsAt");

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietMeal" ADD CONSTRAINT "DietMeal_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietComment" ADD CONSTRAINT "DietComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietComment" ADD CONSTRAINT "DietComment_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietComment" ADD CONSTRAINT "DietComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
