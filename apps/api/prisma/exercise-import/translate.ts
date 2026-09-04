import { type FreeExerciseDbEntry } from './source-types';

/**
 * Rule-based EN→PT-BR translation of the vendored dataset's exercise names. Not a
 * dictionary of all ~870 names (too much code for what it's worth) — instead it
 * decomposes each name into movement/angle/grip/equipment using the same structured
 * fields `map.ts` already relies on (equipment, primaryMuscles), so it stays accurate
 * even where the free-text name is unusual.
 *
 * Any word the dictionaries don't recognize (a proper noun like "Zercher"/"JM", a
 * variant like "Treadmill") is kept — Title Cased — rather than silently dropped, either
 * as the whole name (nothing else was recognized either) or tacked onto the translated
 * movement. Earlier this dropped unknown words, so every barbell squat variant collapsed
 * onto the same "Agachamento com Barra" — a trainer can still rename any entry via the
 * exercise edit screen, but it should not be *necessary* just to tell exercises apart.
 */

const EQUIPMENT_PT: Record<string, string> = {
  'body only': '',
  barbell: 'Barra',
  dumbbell: 'Halteres',
  kettlebells: 'Kettlebell',
  cable: 'Cabo',
  machine: 'Máquina',
  bands: 'Elástico',
  'exercise ball': 'Bola Suíça',
  'foam roll': 'Rolo de Espuma',
  'medicine ball': 'Medicine Ball',
  'e-z curl bar': 'Barra W',
  other: '',
};

const MUSCLE_PT: Record<string, string> = {
  abdominals: 'Abdômen',
  abductors: 'Abdutores',
  adductors: 'Adutores',
  biceps: 'Bíceps',
  calves: 'Panturrilha',
  chest: 'Peito',
  forearms: 'Antebraço',
  glutes: 'Glúteos',
  hamstrings: 'Posterior de Coxa',
  lats: 'Costas',
  'lower back': 'Lombar',
  'middle back': 'Costas',
  neck: 'Pescoço',
  quadriceps: 'Quadríceps',
  shoulders: 'Ombro',
  traps: 'Trapézio',
  triceps: 'Tríceps',
};

/** Gender of each PT movement noun, for adjective agreement (Alternado/Alternada etc). */
const GENDER: Record<string, 'm' | 'f'> = {
  Rosca: 'f',
  Remada: 'f',
  Elevação: 'f',
  Extensão: 'f',
  Ponte: 'f',
  Puxada: 'f',
  Flexão: 'f',
  'Barra Fixa': 'f',
  Caminhada: 'f',
  Prancha: 'f',
  Torção: 'f',
  Rotação: 'f',
  Marcha: 'f',
  'Elevação de Quadril': 'f',
  Hiperextensão: 'f',
  Flexora: 'f',
  Extensora: 'f',
  'Caminhada do Fazendeiro': 'f',
};

const GENDERED_ADJECTIVES = new Set([
  'Inclinado',
  'Declinado',
  'Sentado',
  'Deitado',
  'Ajoelhado',
  'Alternado',
  'Assistido',
  'Cruzado',
  'Reto',
]);

/** `-ado`/`-ido`/`-eto` masculine stems flip to `-a`; every other word is invariant. */
function agree(word: string, gender: 'm' | 'f'): string {
  if (gender === 'f' && (word.endsWith('ado') || word.endsWith('ido') || word.endsWith('eto'))) {
    return word.slice(0, -1) + 'a';
  }
  return word;
}

/** Longest-match phrases, checked before single-word tokens so context wins (e.g. "bench press"). */
const PHRASES: Array<[RegExp, string]> = [
  [/\b(shoulder|military|overhead|push)\s*press\b/, 'Desenvolvimento'],
  [/\bbench\s*press\b/, 'Supino'],
  [/\bchest\s*press\b/, 'Supino'],
  [/\bgood\s*morning\b/, 'Bom Dia'],
  [/\bfarmer'?s?\s*walk\b/, 'Caminhada do Fazendeiro'],
  [/\bleg\s*press\b/, 'Leg Press'],
  [/\bhip\s*thrust\b/, 'Elevação de Quadril'],
  [/\bbox\s*jump\b/, 'Salto na Caixa'],
  [/\bwall\s*ball\b/, 'Wall Ball'],
  [/\bmountain\s*climber/, 'Escalador'],
  [/\bjumping\s*jack/, 'Polichinelo'],
  [/\bsit[\s-]?up/, 'Abdominal'],
  [/\bpush[\s-]?up/, 'Flexão'],
  [/\bpull[\s-]?up/, 'Barra Fixa'],
  [/\bchin[\s-]?up/, 'Barra Fixa Supinada'],
  [/\bpull[\s-]?over/, 'Pullover'],
  [/\bpull[\s-]?down/, 'Puxada'],
  [/\bhyperextension/, 'Hiperextensão'],
  [/\bhip\s*circles?/, 'Círculos de Quadril'],
  [/\bneck\s*circles?/, 'Círculos de Pescoço'],
  [/\bstiff[\s-]?leg/, 'Stiff'],
  [/\bglute\s*ham\s*raise/, 'Mesa Flexora'],
  [/\bwrist\s*roller/, 'Rolo de Punho'],
  [/\bank(le)?\s*circles?/, 'Círculos de Tornozelo'],
];

const MOVEMENT_PT: Record<string, string> = {
  press: 'Press',
  row: 'Remada',
  squat: 'Agachamento',
  deadlift: 'Levantamento Terra',
  raise: 'Elevação',
  raises: 'Elevação',
  extension: 'Extensão',
  crunch: 'Abdominal',
  crunches: 'Abdominal',
  shrug: 'Encolhimento',
  shrugs: 'Encolhimento',
  lunge: 'Afundo',
  lunges: 'Afundo',
  snatch: 'Arranco',
  clean: 'Clean',
  jerk: 'Arremesso',
  throw: 'Arremesso',
  stretch: 'Alongamento',
  twist: 'Torção',
  rotation: 'Rotação',
  fly: 'Crucifixo',
  flye: 'Crucifixo',
  flyes: 'Crucifixo',
  dip: 'Mergulho',
  dips: 'Mergulho',
  jump: 'Salto',
  jumps: 'Salto',
  walk: 'Caminhada',
  bridge: 'Ponte',
  kickback: 'Kickback',
  swing: 'Swing',
  swings: 'Swing',
  thrust: 'Elevação de Quadril',
  plank: 'Prancha',
  roll: 'Rolamento',
  rollout: 'Rollout',
  march: 'Marcha',
  circles: 'Círculos',
  circle: 'Círculo',
  superman: 'Superman',
  curl: 'Rosca',
  drag: 'Arrasto',
  drags: 'Arrasto',
  flip: 'Giro',
  crawl: 'Rastejamento',
  hop: 'Salto',
  hops: 'Salto',
  skip: 'Skip',
  skipping: 'Skip',
  shuffle: 'Deslocamento Lateral',
  sprint: 'Sprint',
  wheel: 'Roda',
  bound: 'Salto',
  kick: 'Chute',
  load: 'Levantamento',
};

const LEG_MUSCLES = new Set(['hamstrings', 'quadriceps', 'calves', 'glutes']);

const ANGLE_PT: Record<string, string> = {
  incline: 'Inclinado',
  decline: 'Declinado',
  seated: 'Sentado',
  standing: 'Em Pé',
  lying: 'Deitado',
  kneeling: 'Ajoelhado',
  floor: 'no Chão',
  overhead: 'Acima da Cabeça',
  front: 'Frontal',
  rear: 'Posterior',
  upright: 'Vertical',
  flat: 'Reto',
};

const GRIP_PT: Record<string, string> = {
  wide: 'Pegada Aberta',
  close: 'Pegada Fechada',
  reverse: 'Pegada Invertida',
  alternating: 'Alternado',
  single: 'Unilateral',
  one: 'Unilateral',
  hammer: 'Martelo',
  behind: 'Atrás da Nuca',
  weighted: 'com Peso',
  assisted: 'Assistido',
  banded: 'com Elástico',
  smith: 'Smith',
  plate: 'com Anilha',
  cross: 'Cruzado',
  crossover: 'Cruzado',
  v: 'V',
  zottman: 'Zottman',
};

const EQUIPMENT_TOKENS = new Set([
  'barbell',
  'dumbbell',
  'dumbbells',
  'kettlebell',
  'kettlebells',
  'cable',
  'machine',
  'band',
  'bands',
  'ball',
  'bar',
  'rope',
  'ez',
]);

const STOP_WORDS = new Set([
  'and',
  'the',
  'a',
  'to',
  'on',
  'in',
  'with',
  'bars',
  'of',
  'ab',
  'an',
  'full',
]);

/** Tries `token` as-is, then its naive singular — the dictionaries only list singulars. */
function resolveKey<T>(dict: Record<string, T>, token: string): string | undefined {
  if (token in dict) return token;
  const singular = token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : null;
  return singular && singular in dict ? singular : undefined;
}

/** Unrecognized words are almost always a proper noun ("JM", "RDL") or a plain English
 * qualifier ("Treadmill") — short tokens read better fully capitalized. */
function titleCase(token: string): string {
  return token.length <= 2 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1);
}

export function translateExerciseName(entry: FreeExerciseDbEntry): string {
  let low = ` ${entry.name.toLowerCase()} `;
  let movement: string | null = null;

  for (const [pattern, pt] of PHRASES) {
    if (pattern.test(low)) {
      movement = pt;
      low = low.replace(pattern, ' ');
      break;
    }
  }

  const tokens = low.match(/[a-z']+/g) ?? [];
  const primary = entry.primaryMuscles[0] ?? null;
  const angleBits: string[] = [];
  const gripBits: string[] = [];
  // Words none of the dictionaries recognize. Kept (not dropped) so distinct exercises
  // that share a movement/muscle don't collapse onto the same translated name.
  const leftover: string[] = [];

  for (const token of tokens) {
    if (STOP_WORDS.has(token) || EQUIPMENT_TOKENS.has(token)) continue;

    const movementKey = !movement ? resolveKey(MOVEMENT_PT, token) : undefined;
    if (movementKey) {
      if (movementKey === 'curl' && primary && LEG_MUSCLES.has(primary)) {
        movement = 'Flexora';
      } else if (movementKey === 'extension' && primary === 'quadriceps') {
        movement = 'Extensora';
      } else {
        movement = MOVEMENT_PT[movementKey];
      }
      continue;
    }

    const angleKey = resolveKey(ANGLE_PT, token);
    if (angleKey) {
      angleBits.push(ANGLE_PT[angleKey]);
      continue;
    }

    const gripKey = resolveKey(GRIP_PT, token);
    if (gripKey) {
      gripBits.push(GRIP_PT[gripKey]);
      continue;
    }

    leftover.push(token);
  }

  if (!movement) {
    // Prefer reconstructing from the exercise's own distinguishing words over a generic
    // muscle-group label — "Dead Bug"/"Ab Roller"/"Air Bike" stay apart instead of all
    // three becoming "Abdômen". Only fall back to the muscle (or raw name) when the
    // source name turned out to be nothing but stop words/equipment terms.
    movement =
      leftover.length > 0
        ? leftover.splice(0).map(titleCase).join(' ')
        : (primary && MUSCLE_PT[primary]) || entry.name;
  } else if (movement === 'Alongamento' && primary) {
    // Bare "stretch" swallows every named pose ("Cat Stretch", "Groin Stretch", ...) into
    // one word — qualify with the target muscle so the list stays distinguishable.
    movement = `Alongamento de ${MUSCLE_PT[primary]}`;
  }

  const gender = GENDER[movement] ?? 'm';
  const agreeIfNeeded = (word: string) =>
    GENDERED_ADJECTIVES.has(word) ? agree(word, gender) : word;
  const leftoverSuffix = leftover.map(titleCase).join(' ');

  const parts = [
    movement,
    leftoverSuffix,
    ...angleBits.map(agreeIfNeeded),
    ...gripBits.map(agreeIfNeeded),
  ].filter(Boolean);
  const equipmentPt = EQUIPMENT_PT[entry.equipment ?? 'other'] ?? '';
  const result = equipmentPt ? `${parts.join(' ')} com ${equipmentPt}` : parts.join(' ');
  return result.trim();
}
