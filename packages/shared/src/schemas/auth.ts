import { z } from 'zod';

/**
 * Shared between the API's validation pipe and the web app's React Hook Form —
 * this is the one place the login shape is defined (spec: "Forms | ... Zod
 * (schemas compartilhados com o back)").
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthenticatedUserDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'TRAINER' | 'STUDENT';
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthenticatedUserDto;
}
