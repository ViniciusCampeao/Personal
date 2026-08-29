import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ToastProvider, useToast } from '@/components/ui/use-toast';
import { AuthProvider } from '@/features/auth/auth-context';
import { createQueryClient } from '@/lib/query-client';
import { router } from '@/routes/router';

/**
 * Provider order matters: the query client needs the toaster to report failed mutations,
 * and `AuthProvider` needs the query client so signing out can clear the cache. The
 * router sits innermost so every screen sees all three.
 */
function AppProviders() {
  const { toast } = useToast();
  const [queryClient] = useState(() => createQueryClient((message) => toast(message, 'error')));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppProviders />
      <Toaster />
    </ToastProvider>
  );
}
