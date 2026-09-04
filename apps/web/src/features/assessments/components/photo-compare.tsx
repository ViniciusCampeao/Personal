import { useState } from 'react';
import type { AssessmentPhotoDto } from '@pt/shared';
import { formatDate } from '@/lib/format';
import { segmentedClass } from '@/components/ui/segmented';

const POSE_LABELS: Record<AssessmentPhotoDto['pose'], string> = {
  FRONT: 'Frente',
  BACK: 'Costas',
  SIDE_LEFT: 'Lado esquerdo',
  SIDE_RIGHT: 'Lado direito',
};

interface PhotoCompareProps {
  before: { photos: AssessmentPhotoDto[]; assessedAt: string };
  after: { photos: AssessmentPhotoDto[]; assessedAt: string };
}

/**
 * Before/after wipe (spec §8). Two photos of the same pose are stacked and the top one
 * is clipped by a range input, so the comparison is a single gesture instead of two
 * images side by side on a phone-width screen.
 */
export function PhotoCompare({ before, after }: PhotoCompareProps) {
  const poses = (['FRONT', 'BACK', 'SIDE_LEFT', 'SIDE_RIGHT'] as const).filter(
    (pose) =>
      before.photos.some((photo) => photo.pose === pose) &&
      after.photos.some((photo) => photo.pose === pose),
  );
  const [pose, setPose] = useState(poses[0]);
  const [position, setPosition] = useState(50);

  if (poses.length === 0 || !pose) return null;

  const beforePhoto = before.photos.find((photo) => photo.pose === pose)!;
  const afterPhoto = after.photos.find((photo) => photo.pose === pose)!;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Comparação de fotos</h2>

      {poses.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {poses.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={pose === option}
              onClick={() => setPose(option)}
              className={segmentedClass(pose === option)}
            >
              {POSE_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-card border border-border bg-surface-sunken">
        <img
          src={beforePhoto.url}
          alt={`${POSE_LABELS[pose]} em ${formatDate(before.assessedAt)}`}
          className="block w-full"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          <img
            src={afterPhoto.url}
            alt={`${POSE_LABELS[pose]} em ${formatDate(after.assessedAt)}`}
            className="block w-full"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-accent"
          style={{ left: `${position}%` }}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Arraste para comparar {formatDate(before.assessedAt)} e {formatDate(after.assessedAt)}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="h-touch w-full accent-[var(--color-accent)]"
        />
      </label>
    </section>
  );
}
