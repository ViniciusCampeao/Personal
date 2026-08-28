-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRAINER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'ABDUCTORS', 'ABS', 'LOWER_BACK', 'TRAPS', 'NECK', 'FULL_BODY', 'CARDIO');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'SMITH', 'KETTLEBELL', 'BODYWEIGHT', 'BAND', 'SUSPENSION', 'MEDICINE_BALL', 'CARDIO_MACHINE', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementPattern" AS ENUM ('HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'SQUAT', 'HINGE', 'LUNGE', 'CARRY', 'ROTATION', 'ISOLATION', 'CONDITIONING', 'MOBILITY');

-- CreateEnum
CREATE TYPE "LoadType" AS ENUM ('EXTERNAL', 'BODYWEIGHT', 'BODYWEIGHT_PLUS', 'TIME', 'DISTANCE', 'NONE');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Technique" AS ENUM ('NORMAL', 'BISET', 'TRISET', 'CIRCUIT', 'DROPSET', 'REST_PAUSE', 'CLUSTER', 'AMRAP', 'PYRAMID', 'ISOMETRIC');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'WORK', 'BACKOFF', 'DROP', 'FAILURE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SkinfoldProtocol" AS ENUM ('NONE', 'POLLOCK_3', 'POLLOCK_7', 'GUEDES', 'FAULKNER');

-- CreateEnum
CREATE TYPE "PhotoPose" AS ENUM ('FRONT', 'BACK', 'SIDE_LEFT', 'SIDE_RIGHT');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'HEALTH_DATA', 'PHOTO');

-- CreateEnum
CREATE TYPE "PrType" AS ENUM ('MAX_LOAD', 'MAX_REPS', 'EST_1RM', 'MAX_SET_VOLUME');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "avatarKey" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "userId" TEXT NOT NULL,
    "cref" TEXT,
    "bio" TEXT,
    "specialties" TEXT[],

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "sex" "Sex",
    "heightCm" DOUBLE PRECISION,
    "goal" TEXT,
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
    "weeklyAvailability" INTEGER,
    "privateNotes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anamnesis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parq" JSONB NOT NULL,
    "injuries" JSONB NOT NULL,
    "conditions" TEXT,
    "medications" TEXT,
    "surgeries" TEXT,
    "smokes" BOOLEAN NOT NULL DEFAULT false,
    "alcohol" TEXT,
    "sleepHours" DOUBLE PRECISION,
    "trainingHistory" TEXT,
    "notes" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Anamnesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalClearance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "MedicalClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "cues" TEXT[],
    "commonMistakes" TEXT[],
    "movementPattern" "MovementPattern" NOT NULL,
    "equipment" "Equipment" NOT NULL,
    "loadType" "LoadType" NOT NULL DEFAULT 'EXTERNAL',
    "unilateral" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "thumbKey" TEXT,
    "substitutionGroup" TEXT,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "exerciseId" TEXT NOT NULL,
    "muscle" "MuscleGroup" NOT NULL,
    "role" "MuscleRole" NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId","muscle")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "studentId" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "sourceProgramId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "notes" TEXT,
    "weeks" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDay" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "notes" TEXT,
    "estimatedMinutes" INTEGER,

    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescribedExercise" (
    "id" TEXT NOT NULL,
    "workoutDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "groupKey" TEXT,
    "groupOrder" INTEGER,
    "technique" "Technique" NOT NULL DEFAULT 'NORMAL',
    "restSeconds" INTEGER,
    "tempo" TEXT,
    "notes" TEXT,
    "progressionRule" JSONB,

    CONSTRAINT "PrescribedExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescribedSet" (
    "id" TEXT NOT NULL,
    "prescribedExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" "SetType" NOT NULL DEFAULT 'WORK',
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "targetLoadKg" DOUBLE PRECISION,
    "targetRir" INTEGER,
    "targetRpe" DOUBLE PRECISION,
    "targetSeconds" INTEGER,
    "targetDistanceM" DOUBLE PRECISION,
    "restSecondsOverride" INTEGER,

    CONSTRAINT "PrescribedSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT,
    "workoutDayId" TEXT,
    "clientUuid" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "perceivedEffort" INTEGER,
    "mood" INTEGER,
    "notes" TEXT,
    "totalVolumeKg" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "prescribedExerciseId" TEXT,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "substitutedFromExerciseId" TEXT,
    "substitutionReason" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" "SetType" NOT NULL DEFAULT 'WORK',
    "reps" INTEGER,
    "loadKg" DOUBLE PRECISION,
    "rir" INTEGER,
    "rpe" DOUBLE PRECISION,
    "seconds" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "toFailure" BOOLEAN NOT NULL DEFAULT false,
    "estimated1rm" DOUBLE PRECISION,
    "doneAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "type" "PrType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER,
    "setLogId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "protocol" "SkinfoldProtocol" NOT NULL DEFAULT 'NONE',
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "fatMassKg" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "restingHr" INTEGER,
    "bloodPressure" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentMeasurement" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "valueCm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AssessmentMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSkinfold" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "valueMm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AssessmentSkinfold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPhoto" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "pose" "PhotoPose" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "sleepQuality" INTEGER,
    "energy" INTEGER,
    "soreness" INTEGER,
    "stress" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "SessionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenantId_role_status_idx" ON "User"("tenantId", "role", "status");

-- CreateIndex
CREATE INDEX "User_tenantId_deletedAt_idx" ON "User"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "StudentProfile_tenantId_trainerId_idx" ON "StudentProfile"("tenantId", "trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_tenantId_trainerId_acceptedAt_idx" ON "Invite"("tenantId", "trainerId", "acceptedAt");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Consent_tenantId_userId_type_idx" ON "Consent"("tenantId", "userId", "type");

-- CreateIndex
CREATE INDEX "Anamnesis_tenantId_studentId_answeredAt_idx" ON "Anamnesis"("tenantId", "studentId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Anamnesis_studentId_version_key" ON "Anamnesis"("studentId", "version");

-- CreateIndex
CREATE INDEX "MedicalClearance_tenantId_studentId_idx" ON "MedicalClearance"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "MedicalClearance_expiresAt_idx" ON "MedicalClearance"("expiresAt");

-- CreateIndex
CREATE INDEX "Exercise_tenantId_isActive_idx" ON "Exercise"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Exercise_movementPattern_equipment_idx" ON "Exercise"("movementPattern", "equipment");

-- CreateIndex
CREATE INDEX "Exercise_substitutionGroup_idx" ON "Exercise"("substitutionGroup");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_tenantId_slug_key" ON "Exercise"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscle_role_idx" ON "ExerciseMuscle"("muscle", "role");

-- CreateIndex
CREATE INDEX "Program_tenantId_studentId_status_idx" ON "Program"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "Program_tenantId_trainerId_isTemplate_idx" ON "Program"("tenantId", "trainerId", "isTemplate");

-- CreateIndex
CREATE INDEX "WorkoutDay_programId_orderIndex_idx" ON "WorkoutDay"("programId", "orderIndex");

-- CreateIndex
CREATE INDEX "PrescribedExercise_workoutDayId_orderIndex_idx" ON "PrescribedExercise"("workoutDayId", "orderIndex");

-- CreateIndex
CREATE INDEX "PrescribedExercise_exerciseId_idx" ON "PrescribedExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescribedSet_prescribedExerciseId_setNumber_key" ON "PrescribedSet"("prescribedExerciseId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_clientUuid_key" ON "WorkoutSession"("clientUuid");

-- CreateIndex
CREATE INDEX "WorkoutSession_tenantId_studentId_startedAt_idx" ON "WorkoutSession"("tenantId", "studentId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_tenantId_status_idx" ON "WorkoutSession"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_programId_idx" ON "WorkoutSession"("programId");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutDayId_idx" ON "WorkoutSession"("workoutDayId");

-- CreateIndex
CREATE INDEX "SessionExercise_sessionId_orderIndex_idx" ON "SessionExercise"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "SessionExercise_prescribedExerciseId_idx" ON "SessionExercise"("prescribedExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_clientUuid_key" ON "SetLog"("clientUuid");

-- CreateIndex
CREATE INDEX "SetLog_sessionExerciseId_setNumber_idx" ON "SetLog"("sessionExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "SetLog_doneAt_idx" ON "SetLog"("doneAt");

-- CreateIndex
CREATE INDEX "PersonalRecord_tenantId_studentId_achievedAt_idx" ON "PersonalRecord"("tenantId", "studentId", "achievedAt");

-- CreateIndex
CREATE INDEX "PersonalRecord_exerciseId_idx" ON "PersonalRecord"("exerciseId");

-- CreateIndex
CREATE INDEX "PersonalRecord_setLogId_idx" ON "PersonalRecord"("setLogId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_studentId_exerciseId_type_key" ON "PersonalRecord"("studentId", "exerciseId", "type");

-- CreateIndex
CREATE INDEX "Assessment_tenantId_studentId_assessedAt_idx" ON "Assessment"("tenantId", "studentId", "assessedAt");

-- CreateIndex
CREATE INDEX "Assessment_trainerId_idx" ON "Assessment"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentMeasurement_assessmentId_site_key" ON "AssessmentMeasurement"("assessmentId", "site");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSkinfold_assessmentId_site_key" ON "AssessmentSkinfold"("assessmentId", "site");

-- CreateIndex
CREATE INDEX "AssessmentPhoto_assessmentId_idx" ON "AssessmentPhoto"("assessmentId");

-- CreateIndex
CREATE INDEX "CheckIn_tenantId_weekStart_idx" ON "CheckIn"("tenantId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_studentId_weekStart_key" ON "CheckIn"("studentId", "weekStart");

-- CreateIndex
CREATE INDEX "SessionComment_tenantId_sessionId_createdAt_idx" ON "SessionComment"("tenantId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionComment_authorId_idx" ON "SessionComment"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_ownerId_kind_idx" ON "MediaAsset"("tenantId", "ownerId", "kind");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalClearance" ADD CONSTRAINT "MedicalClearance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalClearance" ADD CONSTRAINT "MedicalClearance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalClearance" ADD CONSTRAINT "MedicalClearance_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_sourceProgramId_fkey" FOREIGN KEY ("sourceProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescribedExercise" ADD CONSTRAINT "PrescribedExercise_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescribedExercise" ADD CONSTRAINT "PrescribedExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescribedSet" ADD CONSTRAINT "PrescribedSet_prescribedExerciseId_fkey" FOREIGN KEY ("prescribedExerciseId") REFERENCES "PrescribedExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_prescribedExerciseId_fkey" FOREIGN KEY ("prescribedExerciseId") REFERENCES "PrescribedExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_substitutedFromExerciseId_fkey" FOREIGN KEY ("substitutedFromExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_setLogId_fkey" FOREIGN KEY ("setLogId") REFERENCES "SetLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentMeasurement" ADD CONSTRAINT "AssessmentMeasurement_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSkinfold" ADD CONSTRAINT "AssessmentSkinfold_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPhoto" ADD CONSTRAINT "AssessmentPhoto_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionComment" ADD CONSTRAINT "SessionComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionComment" ADD CONSTRAINT "SessionComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionComment" ADD CONSTRAINT "SessionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Global exercises (tenantId IS NULL) are not covered by "Exercise_tenantId_slug_key":
-- PostgreSQL treats NULLs as distinct, so that unique index would happily accept two
-- global exercises with the same slug. This partial index closes the hole.
CREATE UNIQUE INDEX "Exercise_global_slug_key" ON "Exercise"("slug") WHERE "tenantId" IS NULL;
