/**
 * M0 seed: one tenant, one trainer, two students. M2 adds the global exercise library
 * (spec §11). Idempotent — safe to re-run.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from '../src/common/auth/password';
import { importFreeExerciseDb } from './exercise-import/import';

const prisma = new PrismaClient();

const DEFAULT_DEV_PASSWORD = 'changeme123';

function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set before seeding a production database.`);
  }
  return fallback;
}

async function main(): Promise<void> {
  const tenantSlug = requireEnv('SEED_TENANT_SLUG', 'demo');
  const tenantName = requireEnv('SEED_TENANT_NAME', 'Academia Demo');
  const trainerEmail = requireEnv('SEED_TRAINER_EMAIL', 'trainer@demo.local');
  const trainerPassword = requireEnv('SEED_TRAINER_PASSWORD', DEFAULT_DEV_PASSWORD);
  const studentPassword = requireEnv('SEED_STUDENT_PASSWORD', DEFAULT_DEV_PASSWORD);

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { slug: tenantSlug, name: tenantName },
  });

  const trainerHash = await hashPassword(trainerPassword);
  const trainer = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: trainerEmail } },
    update: { passwordHash: trainerHash, status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      email: trainerEmail,
      name: 'Vinícius Personal',
      phone: '+5541999990000',
      role: 'TRAINER',
      status: 'ACTIVE',
      passwordHash: trainerHash,
      trainerProfile: {
        create: {
          cref: '000000-G/PR',
          bio: 'Treinamento de força e hipertrofia.',
          specialties: ['Hipertrofia', 'Força', 'Emagrecimento'],
        },
      },
    },
  });

  const studentHash = await hashPassword(studentPassword);
  const students: Array<{
    email: string;
    name: string;
    phone: string;
    profile: Omit<Prisma.StudentProfileCreateWithoutUserInput, 'tenant' | 'trainer'>;
  }> = [
    {
      email: 'ana@demo.local',
      name: 'Ana Souza',
      phone: '+5541988880001',
      profile: {
        birthDate: new Date('1996-04-12T00:00:00.000Z'),
        sex: 'FEMALE',
        heightCm: 165,
        goal: 'Ganhar massa magra e melhorar condicionamento',
        experienceLevel: 'BEGINNER',
        weeklyAvailability: 3,
        privateNotes: 'Histórico de dor lombar leve — evitar terra convencional no início.',
      },
    },
    {
      email: 'bruno@demo.local',
      name: 'Bruno Lima',
      phone: '+5541988880002',
      profile: {
        birthDate: new Date('1989-11-03T00:00:00.000Z'),
        sex: 'MALE',
        heightCm: 181,
        goal: 'Aumentar força nos básicos',
        experienceLevel: 'INTERMEDIATE',
        weeklyAvailability: 4,
      },
    },
  ];

  for (const student of students) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: student.email } },
      update: { passwordHash: studentHash, status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        email: student.email,
        name: student.name,
        phone: student.phone,
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash: studentHash,
        studentProfile: {
          create: {
            ...student.profile,
            tenant: { connect: { id: tenant.id } },
            trainer: { connect: { id: trainer.id } },
          },
        },
      },
    });
  }

  console.log(`Seed concluído para o tenant "${tenant.slug}" (${tenant.id}):`);
  console.log(`  TRAINER  ${trainerEmail}`);
  for (const student of students) console.log(`  STUDENT  ${student.email}`);
  if (trainerPassword === DEFAULT_DEV_PASSWORD) {
    console.log(`  senha de desenvolvimento: ${DEFAULT_DEV_PASSWORD}`);
  }

  await importFreeExerciseDb(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
