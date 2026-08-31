import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type CreateExerciseInput,
  type ExerciseDto,
  type ListExercisesQuery,
  type ListExercisesResponseDto,
  type UpdateExerciseInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { StorageService } from '../../common/storage/storage.service';
import { slugify } from '../../common/util/slugify';

const VIDEO_URL_EXPIRY_SECONDS = 300;

/** What `findMany`/`findFirst` return with `include: { muscles: true }`. */
type ExerciseWithMuscles = Prisma.ExerciseGetPayload<{ include: { muscles: true } }>;

@Injectable()
export class ExercisesService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  /**
   * `Exercise.tenantId` is nullable (null = global) and deliberately excluded from the
   * tenant-scope Prisma extension (see `common/prisma/tenant-scope.ts`) — every query
   * here builds its own tenant-or-global filter by hand.
   */
  private tenantFilter(
    scope: 'global' | 'custom' | 'all',
    tenantId: string,
  ): Prisma.ExerciseWhereInput {
    if (scope === 'global') return { tenantId: null };
    if (scope === 'custom') return { tenantId };
    return { OR: [{ tenantId }, { tenantId: null }] };
  }

  private async toDto(exercise: ExerciseWithMuscles): Promise<ExerciseDto> {
    return {
      id: exercise.id,
      tenantId: exercise.tenantId,
      name: exercise.name,
      description: exercise.description,
      instructions: exercise.instructions,
      cues: exercise.cues,
      commonMistakes: exercise.commonMistakes,
      movementPattern: exercise.movementPattern,
      equipment: exercise.equipment,
      loadType: exercise.loadType,
      unilateral: exercise.unilateral,
      videoUrl: exercise.videoUrl
        ? await this.storage.presignGet(exercise.videoUrl, VIDEO_URL_EXPIRY_SECONDS)
        : null,
      imageUrls: exercise.imageUrls,
      substitutionGroup: exercise.substitutionGroup,
      isActive: exercise.isActive,
      muscles: exercise.muscles.map((m) => ({ muscle: m.muscle, role: m.role })),
    };
  }

  async list(query: ListExercisesQuery): Promise<ListExercisesResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Prisma.ExerciseWhereInput = {
      ...this.tenantFilter(query.scope, tenantId),
      isActive: true,
      ...(query.equipment && { equipment: query.equipment }),
      ...(query.pattern && { movementPattern: query.pattern }),
      ...(query.muscle && { muscles: { some: { muscle: query.muscle } } }),
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    };

    const rows = await this.db.exercise.findMany({
      where,
      include: { muscles: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: await Promise.all(page.map((row) => this.toDto(row))),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async findOne(id: string): Promise<ExerciseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const exercise = await this.db.exercise.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
      include: { muscles: true },
    });
    if (!exercise) throw new NotFoundException('Exercício não encontrado.');
    return this.toDto(exercise);
  }

  async create(userId: string, input: CreateExerciseInput): Promise<ExerciseDto> {
    const tenantId = this.tenantContext.getTenantId();
    try {
      const exercise = await this.db.exercise.create({
        data: {
          tenantId,
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
          instructions: input.instructions,
          cues: input.cues,
          commonMistakes: input.commonMistakes,
          movementPattern: input.movementPattern,
          equipment: input.equipment,
          loadType: input.loadType,
          unilateral: input.unilateral,
          substitutionGroup: input.substitutionGroup,
          videoUrl: input.videoUrl,
          createdById: userId,
          // ExerciseMuscle has no tenantId column — nothing to stamp here.
          muscles: { createMany: { data: input.muscles } },
        },
        include: { muscles: true },
      });
      return await this.toDto(exercise);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um exercício seu com esse nome.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateExerciseInput): Promise<ExerciseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.db.exercise.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Exercício não encontrado.');

    const { muscles, ...rest } = input;
    try {
      const exercise = await this.db.exercise.update({
        where: { id },
        data: {
          ...rest,
          ...(input.name && { slug: slugify(input.name) }),
          ...(muscles && { muscles: { deleteMany: {}, createMany: { data: muscles } } }),
        },
        include: { muscles: true },
      });
      return await this.toDto(exercise);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um exercício seu com esse nome.');
      }
      throw error;
    }
  }

  async substitutes(id: string): Promise<ExerciseDto[]> {
    const tenantId = this.tenantContext.getTenantId();
    const exercise = await this.db.exercise.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
      include: { muscles: true },
    });
    if (!exercise) throw new NotFoundException('Exercício não encontrado.');

    const primaryMuscles = exercise.muscles
      .filter((m) => m.role === 'PRIMARY')
      .map((m) => m.muscle);

    const where: Prisma.ExerciseWhereInput = exercise.substitutionGroup
      ? {
          substitutionGroup: exercise.substitutionGroup,
          id: { not: id },
          isActive: true,
          OR: [{ tenantId }, { tenantId: null }],
        }
      : {
          movementPattern: exercise.movementPattern,
          muscles: { some: { muscle: { in: primaryMuscles }, role: 'PRIMARY' } },
          id: { not: id },
          isActive: true,
          OR: [{ tenantId }, { tenantId: null }],
        };

    const rows = await this.db.exercise.findMany({ where, include: { muscles: true }, take: 20 });
    return Promise.all(rows.map((row) => this.toDto(row)));
  }
}
