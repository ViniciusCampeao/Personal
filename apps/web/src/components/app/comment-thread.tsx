import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { problemMessage } from '@/lib/problem';

interface CommentLike {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/**
 * A one-way note attached to a resource (session, diet) — not a chat: whoever posts is
 * notified to the other side, but there is no reply thread, only a flat, timestamped list.
 */
export function CommentThread({
  comments,
  currentUserId,
  onSubmit,
  submitting,
  error,
  placeholder = 'Deixe um comentário…',
}: {
  comments: CommentLike[];
  currentUserId: string | undefined;
  onSubmit: (body: string) => void;
  submitting: boolean;
  error?: unknown;
  placeholder?: string;
}) {
  const [body, setBody] = useState('');

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody('');
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhum comentário ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id}>
              <Card>
                <CardContent className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                    <span className="font-medium text-text">
                      {comment.authorId === currentUserId ? 'Você' : comment.authorName}
                    </span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm">{comment.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {error ? <Alert variant="error">{problemMessage(error)}</Alert> : null}

      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          placeholder={placeholder}
          className="rounded-field border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
        />
        <Button
          size="md"
          variant="secondary"
          className="self-start"
          loading={submitting}
          disabled={!body.trim()}
          onClick={handleSubmit}
        >
          Comentar
        </Button>
      </div>
    </div>
  );
}
