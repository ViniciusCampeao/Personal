import { useNavigate } from 'react-router-dom';

/**
 * Goes back in history rather than to a fixed path: the same detail screens are reached
 * from the student's app and from the trainer's area, and a hardcoded destination would
 * throw one of them into the other's section.
 */
export function BackLink({ label }: { label: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="self-start text-sm text-accent underline"
    >
      ← {label}
    </button>
  );
}
