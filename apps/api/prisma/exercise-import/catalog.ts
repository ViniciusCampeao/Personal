import { type Equipment, type MovementPattern } from '@prisma/client';

/**
 * The curated library: which exercises from the vendored dataset make it in, and how each
 * one reads in Portuguese.
 *
 * This replaces a rule-based EN→PT translator that decomposed the English name, swapped
 * the tokens it recognized and glued the rest back untranslated — which is how the
 * library ended up with "Alongamento de Costas Middle Back" and "Extensora Leg Leg
 * Unilateral com Máquina". No dictionary can fix that: the failure is structural, so the
 * names are written out by hand instead. The same is true of the category, which used to
 * come from a regex over the English name and dumped 229 of 873 entries into "Isolamento"
 * and 121 into "Mobilidade" as catch-alls.
 *
 * The dataset ships 873 entries and only a third of them belong in a personal trainer's
 * library — the rest is strongman, exotic olympic variations, near-duplicates and SMR
 * drills nobody prescribes. Since there is no way to hide a global exercise from the app,
 * anything left in here is something the trainer scrolls past forever, so the bar for
 * inclusion is "would this be prescribed to a real client".
 *
 * Keyed by the source's `name`, verbatim — not by slug, so a typo is a test failure
 * (`catalog.spec.ts`) rather than a silently missing exercise.
 */
export interface CatalogEntry {
  /** How it reads in the library. Must be unique across the catalog. */
  name: string;
  pattern: MovementPattern;
  /**
   * Stated per exercise rather than mapped from the source's `equipment`, which has no
   * value for the Smith machine, suspension trainers or cardio machines — they all
   * collapsed onto MACHINE/OTHER — and is simply absent on most stretches.
   */
  equipment: Equipment;
}

export const CATALOG: Record<string, CatalogEntry> = {
  // ---------------------------------------------------------------- peito
  'Barbell Bench Press - Medium Grip': {
    name: 'Supino Reto com Barra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BARBELL',
  },
  'Barbell Incline Bench Press - Medium Grip': {
    name: 'Supino Inclinado com Barra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BARBELL',
  },
  'Decline Barbell Bench Press': {
    name: 'Supino Declinado com Barra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BARBELL',
  },
  'Wide-Grip Barbell Bench Press': {
    name: 'Supino Reto com Barra Pegada Aberta',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BARBELL',
  },
  'Dumbbell Bench Press': {
    name: 'Supino Reto com Halteres',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Incline Dumbbell Press': {
    name: 'Supino Inclinado com Halteres',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Decline Dumbbell Bench Press': {
    name: 'Supino Declinado com Halteres',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Dumbbell Bench Press with Neutral Grip': {
    name: 'Supino com Halteres Pegada Neutra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Hammer Grip Incline DB Bench Press': {
    name: 'Supino Inclinado com Halteres Pegada Neutra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'One Arm Dumbbell Bench Press': {
    name: 'Supino Unilateral com Halter',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Machine Bench Press': {
    name: 'Supino na Máquina',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'MACHINE',
  },
  'Leverage Incline Chest Press': {
    name: 'Supino Inclinado Articulado',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'MACHINE',
  },
  'Leverage Decline Chest Press': {
    name: 'Supino Declinado Articulado',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'MACHINE',
  },
  'Smith Machine Bench Press': {
    name: 'Supino Reto no Smith',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'SMITH',
  },
  'Smith Machine Incline Bench Press': {
    name: 'Supino Inclinado no Smith',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'SMITH',
  },
  'Cable Chest Press': {
    name: 'Supino na Polia',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'CABLE',
  },
  'Incline Cable Chest Press': {
    name: 'Supino Inclinado na Polia',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'CABLE',
  },
  'Dumbbell Flyes': {
    name: 'Crucifixo com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Incline Dumbbell Flyes': {
    name: 'Crucifixo Inclinado com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Decline Dumbbell Flyes': {
    name: 'Crucifixo Declinado com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  Butterfly: { name: 'Voador na Máquina', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Cable Crossover': { name: 'Crossover na Polia', pattern: 'ISOLATION', equipment: 'CABLE' },
  'Low Cable Crossover': {
    name: 'Crossover na Polia Baixa',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Incline Cable Flye': {
    name: 'Crucifixo Inclinado na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Flat Bench Cable Flyes': {
    name: 'Crucifixo na Polia no Banco Reto',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Straight-Arm Dumbbell Pullover': {
    name: 'Pullover com Halter',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  Pushups: { name: 'Flexão de Braço', pattern: 'HORIZONTAL_PUSH', equipment: 'BODYWEIGHT' },
  'Push-Ups With Feet Elevated': {
    name: 'Flexão de Braço com Pés Elevados',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Incline Push-Up': {
    name: 'Flexão de Braço Inclinada',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Push-Up Wide': {
    name: 'Flexão de Braço com Pegada Aberta',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Single-Arm Push-Up': {
    name: 'Flexão de Braço Unilateral',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Suspended Push-Up': {
    name: 'Flexão de Braço em Suspensão',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'SUSPENSION',
  },
  'Dips - Chest Version': {
    name: 'Mergulho em Paralelas (Peito)',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Plyo Push-up': {
    name: 'Flexão Pliométrica',
    pattern: 'CONDITIONING',
    equipment: 'BODYWEIGHT',
  },
  'Push Up to Side Plank': {
    name: 'Flexão com Prancha Lateral',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },

  // ---------------------------------------------------------------- costas
  'Wide-Grip Lat Pulldown': {
    name: 'Puxada Aberta na Polia',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'Close-Grip Front Lat Pulldown': {
    name: 'Puxada Fechada na Polia',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'Underhand Cable Pulldowns': {
    name: 'Puxada Supinada na Polia',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'V-Bar Pulldown': {
    name: 'Puxada com Triângulo',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'Wide-Grip Pulldown Behind The Neck': {
    name: 'Puxada Atrás da Nuca',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'One Arm Lat Pulldown': {
    name: 'Puxada Unilateral na Polia',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },
  'Straight-Arm Pulldown': {
    name: 'Pulldown com Braços Estendidos',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Rope Straight-Arm Pulldown': {
    name: 'Pulldown com Corda',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  Pullups: { name: 'Barra Fixa', pattern: 'VERTICAL_PULL', equipment: 'BODYWEIGHT' },
  'Chin-Up': { name: 'Barra Fixa Supinada', pattern: 'VERTICAL_PULL', equipment: 'BODYWEIGHT' },
  'V-Bar Pullup': {
    name: 'Barra Fixa com Triângulo',
    pattern: 'VERTICAL_PULL',
    equipment: 'BODYWEIGHT',
  },
  'Wide-Grip Rear Pull-Up': {
    name: 'Barra Fixa Atrás da Nuca',
    pattern: 'VERTICAL_PULL',
    equipment: 'BODYWEIGHT',
  },
  'Weighted Pull Ups': {
    name: 'Barra Fixa com Peso',
    pattern: 'VERTICAL_PULL',
    equipment: 'BODYWEIGHT',
  },
  'Band Assisted Pull-Up': {
    name: 'Barra Fixa com Elástico',
    pattern: 'VERTICAL_PULL',
    equipment: 'BAND',
  },
  'Scapular Pull-Up': {
    name: 'Retração Escapular na Barra',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },
  'Bent Over Barbell Row': {
    name: 'Remada Curvada com Barra',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'BARBELL',
  },
  'Reverse Grip Bent-Over Rows': {
    name: 'Remada Curvada Supinada com Barra',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'BARBELL',
  },
  'Bent Over Two-Dumbbell Row': {
    name: 'Remada Curvada com Halteres',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'DUMBBELL',
  },
  'One-Arm Dumbbell Row': {
    name: 'Remada Serrote',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'DUMBBELL',
  },
  'Dumbbell Incline Row': {
    name: 'Remada Inclinada com Halteres',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'DUMBBELL',
  },
  'Seated Cable Rows': {
    name: 'Remada Sentada na Polia',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'CABLE',
  },
  'Seated One-arm Cable Pulley Rows': {
    name: 'Remada Sentada Unilateral na Polia',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'CABLE',
  },
  'Kneeling High Pulley Row': {
    name: 'Remada Alta Ajoelhado na Polia',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'CABLE',
  },
  'Lying T-Bar Row': {
    name: 'Remada Cavalinho na Máquina',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'MACHINE',
  },
  'T-Bar Row with Handle': {
    name: 'Remada Cavalinho com Barra',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'BARBELL',
  },
  'Leverage High Row': {
    name: 'Remada Alta Articulada',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'MACHINE',
  },
  'Leverage Iso Row': {
    name: 'Remada Articulada na Máquina',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'MACHINE',
  },
  'Smith Machine Bent Over Row': {
    name: 'Remada Curvada no Smith',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'SMITH',
  },
  'Inverted Row': {
    name: 'Remada Invertida',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'BODYWEIGHT',
  },
  'Suspended Row': {
    name: 'Remada em Suspensão',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'SUSPENSION',
  },
  'One-Arm Kettlebell Row': {
    name: 'Remada Unilateral com Kettlebell',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'KETTLEBELL',
  },
  'Alternating Renegade Row': {
    name: 'Remada Renegada Alternada',
    pattern: 'HORIZONTAL_PULL',
    equipment: 'KETTLEBELL',
  },
  'Bent-Arm Barbell Pullover': {
    name: 'Pullover com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },

  // ---------------------------------------------------------------- posterior, glúteo e lombar
  'Barbell Deadlift': {
    name: 'Levantamento Terra com Barra',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Sumo Deadlift': { name: 'Levantamento Terra Sumô', pattern: 'HINGE', equipment: 'BARBELL' },
  'Romanian Deadlift': {
    name: 'Levantamento Terra Romeno',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Deficit Deadlift': {
    name: 'Levantamento Terra com Déficit',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Rack Pulls': {
    name: 'Levantamento Terra Parcial (Rack Pull)',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Trap Bar Deadlift': {
    name: 'Levantamento Terra com Barra Hexagonal',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Stiff-Legged Barbell Deadlift': {
    name: 'Stiff com Barra',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Stiff-Legged Dumbbell Deadlift': {
    name: 'Stiff com Halteres',
    pattern: 'HINGE',
    equipment: 'DUMBBELL',
  },
  'Kettlebell One-Legged Deadlift': {
    name: 'Levantamento Terra Unilateral com Kettlebell',
    pattern: 'HINGE',
    equipment: 'KETTLEBELL',
  },
  'Good Morning': { name: 'Bom Dia com Barra', pattern: 'HINGE', equipment: 'BARBELL' },
  'Barbell Hip Thrust': {
    name: 'Elevação Pélvica com Barra',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Barbell Glute Bridge': {
    name: 'Ponte de Glúteo com Barra',
    pattern: 'HINGE',
    equipment: 'BARBELL',
  },
  'Butt Lift (Bridge)': { name: 'Ponte de Glúteo', pattern: 'HINGE', equipment: 'BODYWEIGHT' },
  'Single Leg Glute Bridge': {
    name: 'Ponte de Glúteo Unilateral',
    pattern: 'HINGE',
    equipment: 'BODYWEIGHT',
  },
  'One-Arm Kettlebell Swings': {
    name: 'Swing Unilateral com Kettlebell',
    pattern: 'HINGE',
    equipment: 'KETTLEBELL',
  },
  'Pull Through': { name: 'Pull Through na Polia', pattern: 'HINGE', equipment: 'CABLE' },
  'Glute Kickback': {
    name: 'Extensão de Quadril em Quatro Apoios',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },
  'One-Legged Cable Kickback': {
    name: 'Extensão de Quadril na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Hip Extension with Bands': {
    name: 'Extensão de Quadril com Elástico',
    pattern: 'ISOLATION',
    equipment: 'BAND',
  },
  'Glute Ham Raise': {
    name: 'Flexão Nórdica na Máquina (GHR)',
    pattern: 'HINGE',
    equipment: 'MACHINE',
  },
  'Natural Glute Ham Raise': {
    name: 'Flexão Nórdica',
    pattern: 'HINGE',
    equipment: 'BODYWEIGHT',
  },
  'Hyperextensions (Back Extensions)': {
    name: 'Hiperextensão Lombar',
    pattern: 'HINGE',
    equipment: 'MACHINE',
  },
  'Reverse Hyperextension': {
    name: 'Hiperextensão Reversa',
    pattern: 'HINGE',
    equipment: 'MACHINE',
  },
  Superman: { name: 'Superman', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Lying Leg Curls': { name: 'Mesa Flexora', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Seated Leg Curl': { name: 'Cadeira Flexora', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Standing Leg Curl': { name: 'Flexora em Pé', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Ball Leg Curl': {
    name: 'Flexão de Joelhos na Bola',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },

  // ---------------------------------------------------------------- quadríceps e pernas
  'Barbell Squat': { name: 'Agachamento Livre com Barra', pattern: 'SQUAT', equipment: 'BARBELL' },
  'Barbell Full Squat': {
    name: 'Agachamento Profundo com Barra',
    pattern: 'SQUAT',
    equipment: 'BARBELL',
  },
  'Front Barbell Squat': {
    name: 'Agachamento Frontal com Barra',
    pattern: 'SQUAT',
    equipment: 'BARBELL',
  },
  'Box Squat': { name: 'Agachamento no Caixote', pattern: 'SQUAT', equipment: 'BARBELL' },
  'Wide Stance Barbell Squat': {
    name: 'Agachamento Sumô com Barra',
    pattern: 'SQUAT',
    equipment: 'BARBELL',
  },
  'Narrow Stance Squats': {
    name: 'Agachamento com Base Fechada',
    pattern: 'SQUAT',
    equipment: 'BARBELL',
  },
  'Zercher Squats': { name: 'Agachamento Zercher', pattern: 'SQUAT', equipment: 'BARBELL' },
  'Bodyweight Squat': { name: 'Agachamento Livre', pattern: 'SQUAT', equipment: 'BODYWEIGHT' },
  'Goblet Squat': { name: 'Agachamento Goblet', pattern: 'SQUAT', equipment: 'KETTLEBELL' },
  'Dumbbell Squat': { name: 'Agachamento com Halteres', pattern: 'SQUAT', equipment: 'DUMBBELL' },
  'Smith Machine Squat': { name: 'Agachamento no Smith', pattern: 'SQUAT', equipment: 'SMITH' },
  'Hack Squat': { name: 'Agachamento Hack na Máquina', pattern: 'SQUAT', equipment: 'MACHINE' },
  'Barbell Hack Squat': {
    name: 'Agachamento Hack com Barra',
    pattern: 'SQUAT',
    equipment: 'BARBELL',
  },
  'Leg Press': { name: 'Leg Press', pattern: 'SQUAT', equipment: 'MACHINE' },
  'Narrow Stance Leg Press': {
    name: 'Leg Press com Base Fechada',
    pattern: 'SQUAT',
    equipment: 'MACHINE',
  },
  'Kettlebell Pistol Squat': {
    name: 'Agachamento Pistol com Kettlebell',
    pattern: 'SQUAT',
    equipment: 'KETTLEBELL',
  },
  'One Leg Barbell Squat': {
    name: 'Agachamento Búlgaro com Barra',
    pattern: 'LUNGE',
    equipment: 'BARBELL',
  },
  'Freehand Jump Squat': {
    name: 'Agachamento com Salto',
    pattern: 'CONDITIONING',
    equipment: 'BODYWEIGHT',
  },
  'Leg Extensions': { name: 'Cadeira Extensora', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Single-Leg Leg Extension': {
    name: 'Cadeira Extensora Unilateral',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Barbell Lunge': { name: 'Afundo com Barra', pattern: 'LUNGE', equipment: 'BARBELL' },
  'Dumbbell Lunges': { name: 'Afundo com Halteres', pattern: 'LUNGE', equipment: 'DUMBBELL' },
  'Dumbbell Rear Lunge': {
    name: 'Afundo Reverso com Halteres',
    pattern: 'LUNGE',
    equipment: 'DUMBBELL',
  },
  'Barbell Walking Lunge': { name: 'Avanço com Barra', pattern: 'LUNGE', equipment: 'BARBELL' },
  'Split Squat with Dumbbells': {
    name: 'Afundo Estático com Halteres',
    pattern: 'LUNGE',
    equipment: 'DUMBBELL',
  },
  'Smith Single-Leg Split Squat': {
    name: 'Afundo Estático Unilateral no Smith',
    pattern: 'LUNGE',
    equipment: 'SMITH',
  },
  'Suspended Split Squat': {
    name: 'Afundo Estático em Suspensão',
    pattern: 'LUNGE',
    equipment: 'SUSPENSION',
  },
  'Dumbbell Step Ups': {
    name: 'Subida no Banco com Halteres',
    pattern: 'LUNGE',
    equipment: 'DUMBBELL',
  },
  'Barbell Step Ups': {
    name: 'Subida no Banco com Barra',
    pattern: 'LUNGE',
    equipment: 'BARBELL',
  },
  'Step-up with Knee Raise': {
    name: 'Subida no Banco com Elevação de Joelho',
    pattern: 'LUNGE',
    equipment: 'BODYWEIGHT',
  },
  'Thigh Abductor': { name: 'Cadeira Abdutora', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Thigh Adductor': { name: 'Cadeira Adutora', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Cable Hip Adduction': {
    name: 'Adução de Quadril na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Band Hip Adductions': {
    name: 'Adução de Quadril com Elástico',
    pattern: 'ISOLATION',
    equipment: 'BAND',
  },
  'Monster Walk': { name: 'Caminhada com Elástico', pattern: 'CONDITIONING', equipment: 'BAND' },

  // ---------------------------------------------------------------- panturrilha
  'Standing Calf Raises': {
    name: 'Panturrilha em Pé na Máquina',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Seated Calf Raise': {
    name: 'Panturrilha Sentado na Máquina',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Standing Barbell Calf Raise': {
    name: 'Panturrilha em Pé com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Standing Dumbbell Calf Raise': {
    name: 'Panturrilha em Pé com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Calf Press On The Leg Press Machine': {
    name: 'Panturrilha no Leg Press',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Smith Machine Calf Raise': {
    name: 'Panturrilha no Smith',
    pattern: 'ISOLATION',
    equipment: 'SMITH',
  },
  'Donkey Calf Raises': {
    name: 'Panturrilha Burro',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },

  // ---------------------------------------------------------------- ombros
  'Barbell Shoulder Press': {
    name: 'Desenvolvimento com Barra',
    pattern: 'VERTICAL_PUSH',
    equipment: 'BARBELL',
  },
  'Seated Barbell Military Press': {
    name: 'Desenvolvimento Militar Sentado',
    pattern: 'VERTICAL_PUSH',
    equipment: 'BARBELL',
  },
  'Standing Military Press': {
    name: 'Desenvolvimento Militar em Pé',
    pattern: 'VERTICAL_PUSH',
    equipment: 'BARBELL',
  },
  'Dumbbell Shoulder Press': {
    name: 'Desenvolvimento com Halteres',
    pattern: 'VERTICAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Seated Dumbbell Press': {
    name: 'Desenvolvimento Sentado com Halteres',
    pattern: 'VERTICAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Arnold Dumbbell Press': {
    name: 'Desenvolvimento Arnold',
    pattern: 'VERTICAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Dumbbell One-Arm Shoulder Press': {
    name: 'Desenvolvimento Unilateral com Halter',
    pattern: 'VERTICAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Machine Shoulder (Military) Press': {
    name: 'Desenvolvimento na Máquina',
    pattern: 'VERTICAL_PUSH',
    equipment: 'MACHINE',
  },
  'Leverage Shoulder Press': {
    name: 'Desenvolvimento Articulado',
    pattern: 'VERTICAL_PUSH',
    equipment: 'MACHINE',
  },
  'Smith Machine Overhead Shoulder Press': {
    name: 'Desenvolvimento no Smith',
    pattern: 'VERTICAL_PUSH',
    equipment: 'SMITH',
  },
  'Cable Shoulder Press': {
    name: 'Desenvolvimento na Polia',
    pattern: 'VERTICAL_PUSH',
    equipment: 'CABLE',
  },
  'Two-Arm Kettlebell Military Press': {
    name: 'Desenvolvimento Militar com Kettlebells',
    pattern: 'VERTICAL_PUSH',
    equipment: 'KETTLEBELL',
  },
  'Push Press': {
    name: 'Desenvolvimento com Impulso (Push Press)',
    pattern: 'VERTICAL_PUSH',
    equipment: 'BARBELL',
  },
  'Handstand Push-Ups': {
    name: 'Flexão Invertida na Parada de Mão',
    pattern: 'VERTICAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Side Lateral Raise': {
    name: 'Elevação Lateral com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Seated Side Lateral Raise': {
    name: 'Elevação Lateral Sentado',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'One-Arm Side Laterals': {
    name: 'Elevação Lateral Unilateral',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Cable Seated Lateral Raise': {
    name: 'Elevação Lateral na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Lateral Raise - With Bands': {
    name: 'Elevação Lateral com Elástico',
    pattern: 'ISOLATION',
    equipment: 'BAND',
  },
  'Front Dumbbell Raise': {
    name: 'Elevação Frontal com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Front Cable Raise': {
    name: 'Elevação Frontal na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Front Plate Raise': {
    name: 'Elevação Frontal com Anilha',
    pattern: 'ISOLATION',
    equipment: 'OTHER',
  },
  'Dumbbell Scaption': {
    name: 'Elevação em Scaption com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Reverse Flyes': {
    name: 'Crucifixo Inverso com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Reverse Machine Flyes': {
    name: 'Crucifixo Inverso na Máquina',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Cable Rear Delt Fly': {
    name: 'Crucifixo Inverso na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Seated Bent-Over Rear Delt Raise': {
    name: 'Crucifixo Inverso Sentado',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Face Pull': { name: 'Face Pull na Polia', pattern: 'HORIZONTAL_PULL', equipment: 'CABLE' },
  'Band Pull Apart': { name: 'Abertura com Elástico', pattern: 'ISOLATION', equipment: 'BAND' },
  'External Rotation with Cable': {
    name: 'Rotação Externa na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Internal Rotation with Band': {
    name: 'Rotação Interna com Elástico',
    pattern: 'ISOLATION',
    equipment: 'BAND',
  },
  'Cuban Press': { name: 'Desenvolvimento Cubano', pattern: 'ISOLATION', equipment: 'DUMBBELL' },
  'Upright Barbell Row': {
    name: 'Remada Alta com Barra',
    pattern: 'VERTICAL_PULL',
    equipment: 'BARBELL',
  },
  'Standing Dumbbell Upright Row': {
    name: 'Remada Alta com Halteres',
    pattern: 'VERTICAL_PULL',
    equipment: 'DUMBBELL',
  },
  'Upright Cable Row': {
    name: 'Remada Alta na Polia',
    pattern: 'VERTICAL_PULL',
    equipment: 'CABLE',
  },

  // ---------------------------------------------------------------- trapézio
  'Barbell Shrug': { name: 'Encolhimento com Barra', pattern: 'ISOLATION', equipment: 'BARBELL' },
  'Dumbbell Shrug': {
    name: 'Encolhimento com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Cable Shrugs': { name: 'Encolhimento na Polia', pattern: 'ISOLATION', equipment: 'CABLE' },
  'Leverage Shrug': { name: 'Encolhimento na Máquina', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Smith Machine Behind the Back Shrug': {
    name: 'Encolhimento no Smith por Trás',
    pattern: 'ISOLATION',
    equipment: 'SMITH',
  },

  // ---------------------------------------------------------------- bíceps
  'Barbell Curl': { name: 'Rosca Direta com Barra', pattern: 'ISOLATION', equipment: 'BARBELL' },
  'EZ-Bar Curl': { name: 'Rosca Direta com Barra W', pattern: 'ISOLATION', equipment: 'BARBELL' },
  'Close-Grip Standing Barbell Curl': {
    name: 'Rosca Direta Pegada Fechada',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Wide-Grip Standing Barbell Curl': {
    name: 'Rosca Direta Pegada Aberta',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Dumbbell Bicep Curl': {
    name: 'Rosca Direta com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Dumbbell Alternate Bicep Curl': {
    name: 'Rosca Alternada com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Seated Dumbbell Curl': {
    name: 'Rosca Sentado com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Hammer Curls': { name: 'Rosca Martelo', pattern: 'ISOLATION', equipment: 'DUMBBELL' },
  'Cross Body Hammer Curl': {
    name: 'Rosca Martelo Cruzada',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Cable Hammer Curls - Rope Attachment': {
    name: 'Rosca Martelo na Polia com Corda',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Incline Dumbbell Curl': {
    name: 'Rosca Inclinada com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Concentration Curls': { name: 'Rosca Concentrada', pattern: 'ISOLATION', equipment: 'DUMBBELL' },
  'Preacher Curl': { name: 'Rosca Scott com Barra', pattern: 'ISOLATION', equipment: 'BARBELL' },
  'Cable Preacher Curl': {
    name: 'Rosca Scott na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Machine Preacher Curls': {
    name: 'Rosca Scott na Máquina',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Spider Curl': { name: 'Rosca Spider', pattern: 'ISOLATION', equipment: 'BARBELL' },
  'Standing Biceps Cable Curl': {
    name: 'Rosca Direta na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Reverse Barbell Curl': {
    name: 'Rosca Inversa com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Zottman Curl': { name: 'Rosca Zottman', pattern: 'ISOLATION', equipment: 'DUMBBELL' },
  'Machine Bicep Curl': { name: 'Rosca na Máquina', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Drag Curl': { name: 'Rosca Arrasto', pattern: 'ISOLATION', equipment: 'BARBELL' },

  // ---------------------------------------------------------------- tríceps
  'Triceps Pushdown': {
    name: 'Tríceps na Polia com Barra',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Triceps Pushdown - Rope Attachment': {
    name: 'Tríceps na Polia com Corda',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Triceps Pushdown - V-Bar Attachment': {
    name: 'Tríceps na Polia com Barra V',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Reverse Grip Triceps Pushdown': {
    name: 'Tríceps na Polia Pegada Supinada',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Cable Rope Overhead Triceps Extension': {
    name: 'Tríceps Francês na Polia com Corda',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Cable One Arm Tricep Extension': {
    name: 'Tríceps Unilateral na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'EZ-Bar Skullcrusher': {
    name: 'Tríceps Testa com Barra W',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Decline EZ Bar Triceps Extension': {
    name: 'Tríceps Testa Declinado com Barra W',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Lying Dumbbell Tricep Extension': {
    name: 'Tríceps Testa com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Standing Overhead Barbell Triceps Extension': {
    name: 'Tríceps Francês em Pé com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Seated Triceps Press': {
    name: 'Tríceps Francês Sentado com Halter',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Dumbbell One-Arm Triceps Extension': {
    name: 'Tríceps Francês Unilateral com Halter',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Tricep Dumbbell Kickback': {
    name: 'Tríceps Coice com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Machine Triceps Extension': {
    name: 'Tríceps na Máquina',
    pattern: 'ISOLATION',
    equipment: 'MACHINE',
  },
  'Close-Grip Barbell Bench Press': {
    name: 'Supino Fechado com Barra',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BARBELL',
  },
  'Close-Grip Dumbbell Press': {
    name: 'Supino Fechado com Halteres',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'DUMBBELL',
  },
  'Smith Machine Close-Grip Bench Press': {
    name: 'Supino Fechado no Smith',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'SMITH',
  },
  'Dips - Triceps Version': {
    name: 'Mergulho em Paralelas (Tríceps)',
    pattern: 'HORIZONTAL_PUSH',
    equipment: 'BODYWEIGHT',
  },
  'Bench Dips': { name: 'Mergulho no Banco', pattern: 'HORIZONTAL_PUSH', equipment: 'BODYWEIGHT' },
  'JM Press': { name: 'JM Press', pattern: 'HORIZONTAL_PUSH', equipment: 'BARBELL' },

  // ---------------------------------------------------------------- antebraço e pegada
  'Palms-Up Barbell Wrist Curl Over A Bench': {
    name: 'Rosca de Punho com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Palms-Down Wrist Curl Over A Bench': {
    name: 'Rosca de Punho Invertida com Barra',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Seated Dumbbell Palms-Up Wrist Curl': {
    name: 'Rosca de Punho Sentado com Halteres',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Wrist Roller': { name: 'Rolo de Punho', pattern: 'ISOLATION', equipment: 'OTHER' },
  'Plate Pinch': { name: 'Pinça com Anilha', pattern: 'CARRY', equipment: 'OTHER' },
  "Farmer's Walk": { name: 'Caminhada do Fazendeiro', pattern: 'CARRY', equipment: 'DUMBBELL' },

  // ---------------------------------------------------------------- abdômen e core
  Crunches: { name: 'Abdominal Supra', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Sit-Up': { name: 'Abdominal Completo', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Decline Crunch': { name: 'Abdominal Declinado', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Cross-Body Crunch': {
    name: 'Abdominal Cruzado',
    pattern: 'ROTATION',
    equipment: 'BODYWEIGHT',
  },
  'Oblique Crunches': { name: 'Abdominal Oblíquo', pattern: 'ROTATION', equipment: 'BODYWEIGHT' },
  'Reverse Crunch': { name: 'Abdominal Invertido', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Air Bike': { name: 'Abdominal Bicicleta', pattern: 'ROTATION', equipment: 'BODYWEIGHT' },
  'Cable Crunch': {
    name: 'Abdominal na Polia Ajoelhado',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Rope Crunch': { name: 'Abdominal na Polia com Corda', pattern: 'ISOLATION', equipment: 'CABLE' },
  'Cable Reverse Crunch': {
    name: 'Abdominal Invertido na Polia',
    pattern: 'ISOLATION',
    equipment: 'CABLE',
  },
  'Ab Crunch Machine': { name: 'Abdominal na Máquina', pattern: 'ISOLATION', equipment: 'MACHINE' },
  'Exercise Ball Crunch': {
    name: 'Abdominal na Bola Suíça',
    pattern: 'ISOLATION',
    equipment: 'OTHER',
  },
  'Hanging Leg Raise': {
    name: 'Elevação de Pernas na Barra',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },
  'Knee/Hip Raise On Parallel Bars': {
    name: 'Elevação de Joelhos nas Paralelas',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },
  'Flat Bench Lying Leg Raise': {
    name: 'Elevação de Pernas no Banco',
    pattern: 'ISOLATION',
    equipment: 'BODYWEIGHT',
  },
  Plank: { name: 'Prancha Isométrica', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Side Bridge': { name: 'Prancha Lateral', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Dead Bug': { name: 'Dead Bug', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Ab Roller': { name: 'Abdominal com Roda', pattern: 'ISOLATION', equipment: 'OTHER' },
  'Barbell Ab Rollout - On Knees': {
    name: 'Rollout com Barra Ajoelhado',
    pattern: 'ISOLATION',
    equipment: 'BARBELL',
  },
  'Russian Twist': { name: 'Russian Twist', pattern: 'ROTATION', equipment: 'BODYWEIGHT' },
  'Cable Russian Twists': {
    name: 'Russian Twist na Polia',
    pattern: 'ROTATION',
    equipment: 'CABLE',
  },
  'Standing Cable Wood Chop': {
    name: 'Lenhador na Polia',
    pattern: 'ROTATION',
    equipment: 'CABLE',
  },
  'Standing Cable Lift': {
    name: 'Elevação Diagonal na Polia',
    pattern: 'ROTATION',
    equipment: 'CABLE',
  },
  'Pallof Press': { name: 'Pallof Press', pattern: 'ROTATION', equipment: 'CABLE' },
  'Pallof Press With Rotation': {
    name: 'Pallof Press com Rotação',
    pattern: 'ROTATION',
    equipment: 'CABLE',
  },
  'Dumbbell Side Bend': {
    name: 'Flexão Lateral de Tronco com Halter',
    pattern: 'ISOLATION',
    equipment: 'DUMBBELL',
  },
  'Stomach Vacuum': { name: 'Vacuum Abdominal', pattern: 'ISOLATION', equipment: 'BODYWEIGHT' },
  'Spider Crawl': { name: 'Spider Crawl', pattern: 'CONDITIONING', equipment: 'BODYWEIGHT' },
  'Mountain Climbers': { name: 'Escalador', pattern: 'CONDITIONING', equipment: 'BODYWEIGHT' },

  // ---------------------------------------------------------------- levantamentos olímpicos
  'Power Clean': { name: 'Clean de Potência', pattern: 'HINGE', equipment: 'BARBELL' },
  'Hang Clean': { name: 'Clean Suspenso', pattern: 'HINGE', equipment: 'BARBELL' },
  'Clean and Jerk': { name: 'Arremesso (Clean and Jerk)', pattern: 'HINGE', equipment: 'BARBELL' },
  Snatch: { name: 'Arranco (Snatch)', pattern: 'HINGE', equipment: 'BARBELL' },
  'Power Snatch': { name: 'Arranco de Potência', pattern: 'HINGE', equipment: 'BARBELL' },
  'Overhead Squat': { name: 'Agachamento Overhead', pattern: 'SQUAT', equipment: 'BARBELL' },
  'Kettlebell Thruster': {
    name: 'Thruster com Kettlebell',
    pattern: 'CONDITIONING',
    equipment: 'KETTLEBELL',
  },
  'One-Arm Kettlebell Snatch': {
    name: 'Arranco Unilateral com Kettlebell',
    pattern: 'CONDITIONING',
    equipment: 'KETTLEBELL',
  },
  'Kettlebell Turkish Get-Up (Squat style)': {
    name: 'Turkish Get-Up com Kettlebell',
    pattern: 'CONDITIONING',
    equipment: 'KETTLEBELL',
  },
  'Kettlebell Sumo High Pull': {
    name: 'Puxada Alta Sumô com Kettlebell',
    pattern: 'CONDITIONING',
    equipment: 'KETTLEBELL',
  },

  // ---------------------------------------------------------------- condicionamento
  'Rope Jumping': { name: 'Pular Corda', pattern: 'CONDITIONING', equipment: 'OTHER' },
  'Battling Ropes': { name: 'Corda Naval', pattern: 'CONDITIONING', equipment: 'OTHER' },
  'Front Box Jump': { name: 'Salto no Caixote', pattern: 'CONDITIONING', equipment: 'OTHER' },
  'Sled Push': { name: 'Empurrar Trenó', pattern: 'CONDITIONING', equipment: 'OTHER' },
  'Sled Drag - Harness': {
    name: 'Puxar Trenó com Cinto',
    pattern: 'CONDITIONING',
    equipment: 'OTHER',
  },
  'Tire Flip': { name: 'Virada de Pneu', pattern: 'CONDITIONING', equipment: 'OTHER' },
  'Medicine Ball Chest Pass': {
    name: 'Arremesso de Medicine Ball no Peito',
    pattern: 'CONDITIONING',
    equipment: 'MEDICINE_BALL',
  },
  'Overhead Slam': {
    name: 'Arremesso de Medicine Ball no Solo',
    pattern: 'CONDITIONING',
    equipment: 'MEDICINE_BALL',
  },
  'Running, Treadmill': {
    name: 'Corrida na Esteira',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },
  'Walking, Treadmill': {
    name: 'Caminhada na Esteira',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },
  'Bicycling, Stationary': {
    name: 'Bicicleta Ergométrica',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },
  'Recumbent Bike': {
    name: 'Bicicleta Horizontal',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },
  'Elliptical Trainer': { name: 'Elíptico', pattern: 'CONDITIONING', equipment: 'CARDIO_MACHINE' },
  'Rowing, Stationary': {
    name: 'Remo Ergômetro',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },
  Stairmaster: {
    name: 'Simulador de Escada',
    pattern: 'CONDITIONING',
    equipment: 'CARDIO_MACHINE',
  },

  // ---------------------------------------------------------------- mobilidade e alongamento
  'Cat Stretch': { name: 'Mobilidade Gato-Camelo', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  "Child's Pose": { name: 'Postura da Criança', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  'Hug Knees To Chest': { name: 'Joelhos ao Peito', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  'One Knee To Chest': {
    name: 'Um Joelho ao Peito',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Pelvic Tilt Into Bridge': {
    name: 'Báscula de Quadril até a Ponte',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  Inchworm: { name: 'Lagarta (Inchworm)', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  "World's Greatest Stretch": {
    name: 'Alongamento Completo do Quadril (WGS)',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Standing Gastrocnemius Calf Stretch': {
    name: 'Alongamento de Panturrilha em Pé',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Standing Soleus And Achilles Stretch': {
    name: 'Alongamento de Sóleo e Tendão de Aquiles',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Seated Hamstring': {
    name: 'Alongamento de Posterior de Coxa Sentado',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Standing Toe Touches': {
    name: 'Alongamento de Posterior de Coxa em Pé',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'All Fours Quad Stretch': {
    name: 'Alongamento de Quadríceps em Quatro Apoios',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Kneeling Hip Flexor': {
    name: 'Alongamento de Flexor de Quadril Ajoelhado',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Side Lying Groin Stretch': {
    name: 'Alongamento de Adutores Deitado',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Seated Glute': {
    name: 'Alongamento de Glúteo Sentado',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Lying Glute': {
    name: 'Alongamento de Glúteo Deitado',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Behind Head Chest Stretch': {
    name: 'Alongamento de Peitoral com Braços Atrás',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Chest And Front Of Shoulder Stretch': {
    name: 'Alongamento de Peitoral e Ombro',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Shoulder Stretch': {
    name: 'Alongamento de Ombro',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Triceps Stretch': {
    name: 'Alongamento de Tríceps',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Upper Back Stretch': {
    name: 'Alongamento de Costas',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Spinal Stretch': { name: 'Alongamento da Coluna', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  'Chin To Chest Stretch': {
    name: 'Alongamento Cervical (Queixo ao Peito)',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Side Neck Stretch': {
    name: 'Alongamento Lateral do Pescoço',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Arm Circles': { name: 'Circundução de Braços', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },
  'Shoulder Circles': {
    name: 'Circundução de Ombros',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Hip Circles (prone)': {
    name: 'Circundução de Quadril',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Ankle Circles': {
    name: 'Circundução de Tornozelo',
    pattern: 'MOBILITY',
    equipment: 'BODYWEIGHT',
  },
  'Wrist Circles': { name: 'Circundução de Punho', pattern: 'MOBILITY', equipment: 'BODYWEIGHT' },

  // Liberação miofascial — mantida só onde um personal realmente prescreve o rolo.
  'Quadriceps-SMR': {
    name: 'Liberação de Quadríceps no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Hamstring-SMR': {
    name: 'Liberação de Posterior de Coxa no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Calves-SMR': {
    name: 'Liberação de Panturrilha no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Iliotibial Tract-SMR': {
    name: 'Liberação da Banda Iliotibial no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Piriformis-SMR': {
    name: 'Liberação de Piriforme no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Latissimus Dorsi-SMR': {
    name: 'Liberação de Dorsal no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  'Lower Back-SMR': {
    name: 'Liberação de Lombar no Rolo',
    pattern: 'MOBILITY',
    equipment: 'OTHER',
  },
  Adductor: { name: 'Liberação de Adutores no Rolo', pattern: 'MOBILITY', equipment: 'OTHER' },
};
