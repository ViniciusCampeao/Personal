import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { problemMessage } from '@/lib/problem';
import { currentSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from './push';

type PushState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

/** Opt-in card for Web Push — §11 requires explicit permission, never a boot-time prompt. */
export function PushToggle() {
  const { toast } = useToast();
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      return;
    }
    let cancelled = false;
    currentSubscription()
      .then((subscription) => {
        if (!cancelled) setState(subscription ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setState('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking' || state === 'unsupported') return null;

  async function toggle() {
    setBusy(true);
    try {
      if (state === 'on') {
        await unsubscribeFromPush();
        setState('off');
      } else {
        await subscribeToPush();
        setState('on');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'permission-denied') {
        setState('blocked');
      } else {
        toast(problemMessage(error), 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Notificações no dispositivo</span>
          <CardDescription>
            {state === 'blocked'
              ? 'Bloqueadas pelo navegador. Libere nas permissões do site para reativar.'
              : state === 'on'
                ? 'Você recebe lembretes de treino e check-in neste dispositivo.'
                : 'Receba lembretes de treino e check-in mesmo com o app fechado.'}
          </CardDescription>
        </div>
        {state !== 'blocked' && (
          <Button
            variant={state === 'on' ? 'secondary' : 'primary'}
            loading={busy}
            onClick={toggle}
          >
            {state === 'on' ? 'Desativar' : 'Ativar'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
