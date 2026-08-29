import type { equipments, movementPatterns, muscleGroups, setTypes, techniques } from '@pt/shared';

/**
 * The API speaks the domain in English enums (spec §0: code in English, UI in pt-BR).
 * Every user-facing translation of those enums lives here, so a label is never invented
 * twice in two screens.
 */
type Dict<T extends readonly string[]> = Record<T[number], string>;

export const EQUIPMENT_LABELS: Dict<typeof equipments> = {
  BARBELL: 'Barra',
  DUMBBELL: 'Halteres',
  MACHINE: 'Máquina',
  CABLE: 'Polia',
  SMITH: 'Smith',
  KETTLEBELL: 'Kettlebell',
  BODYWEIGHT: 'Peso corporal',
  BAND: 'Elástico',
  SUSPENSION: 'Suspensão',
  MEDICINE_BALL: 'Medicine ball',
  CARDIO_MACHINE: 'Cardio',
  OTHER: 'Outro',
};

export const MOVEMENT_PATTERN_LABELS: Dict<typeof movementPatterns> = {
  HORIZONTAL_PUSH: 'Empurrar horizontal',
  VERTICAL_PUSH: 'Empurrar vertical',
  HORIZONTAL_PULL: 'Puxar horizontal',
  VERTICAL_PULL: 'Puxar vertical',
  SQUAT: 'Agachamento',
  HINGE: 'Quadril',
  LUNGE: 'Afundo',
  CARRY: 'Carregamento',
  ROTATION: 'Rotação',
  ISOLATION: 'Isolado',
  CONDITIONING: 'Condicionamento',
  MOBILITY: 'Mobilidade',
};

export const MUSCLE_LABELS: Dict<typeof muscleGroups> = {
  CHEST: 'Peito',
  BACK: 'Costas',
  SHOULDERS: 'Ombros',
  BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps',
  FOREARMS: 'Antebraços',
  QUADS: 'Quadríceps',
  HAMSTRINGS: 'Posteriores',
  GLUTES: 'Glúteos',
  CALVES: 'Panturrilhas',
  ADDUCTORS: 'Adutores',
  ABDUCTORS: 'Abdutores',
  ABS: 'Abdômen',
  LOWER_BACK: 'Lombar',
  TRAPS: 'Trapézio',
  NECK: 'Pescoço',
  FULL_BODY: 'Corpo inteiro',
  CARDIO: 'Cardio',
};

export const TECHNIQUE_LABELS: Dict<typeof techniques> = {
  NORMAL: 'Normal',
  BISET: 'Bi-set',
  TRISET: 'Tri-set',
  CIRCUIT: 'Circuito',
  DROPSET: 'Drop-set',
  REST_PAUSE: 'Rest-pause',
  CLUSTER: 'Cluster',
  AMRAP: 'AMRAP',
  PYRAMID: 'Pirâmide',
  ISOMETRIC: 'Isometria',
};

export const SET_TYPE_LABELS: Dict<typeof setTypes> = {
  WARMUP: 'Aquecimento',
  WORK: 'Válida',
  BACKOFF: 'Back-off',
  DROP: 'Drop',
  FAILURE: 'Até a falha',
};

export const PR_TYPE_LABELS = {
  MAX_LOAD: 'Carga máxima',
  MAX_REPS: 'Máximo de repetições',
  EST_1RM: '1RM estimado',
  MAX_SET_VOLUME: 'Maior volume em uma série',
} as const;

/** Falls back to the raw value: an unmapped enum is a bug, not a blank screen. */
export function labelOf<T extends string>(dict: Record<T, string>, value: T | string): string {
  return (dict as Record<string, string>)[value] ?? value;
}
