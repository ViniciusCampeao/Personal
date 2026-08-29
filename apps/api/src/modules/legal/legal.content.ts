import { type LegalDocumentDto } from '@pt/shared';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../../common/legal/consent-versions';

/**
 * Spec §10.8: the Terms and the Privacy Policy are versioned and served by the API, so a
 * `Consent` row that records `version: 'v1'` can always be traced back to the exact text
 * the user accepted. Kept as source (not files read at runtime) so a build artefact can
 * never ship without them.
 *
 * Bump the version constants in `common/legal/consent-versions.ts` whenever the text
 * below changes in substance — an old consent must never silently point at new wording.
 */
const TERMS_BODY = `
## 1. Quem somos

Esta plataforma é operada pelo profissional de educação física (o "Treinador") que
convidou você, que utiliza este software para prescrever e acompanhar seus treinos.

## 2. O que você pode esperar

O aplicativo registra seus treinos, sua evolução e as avaliações físicas feitas pelo seu
Treinador. As prescrições de treino são de responsabilidade profissional do Treinador,
não da plataforma.

## 3. Sua conta

Você é responsável por manter sua senha em sigilo. A conta é pessoal e intransferível.
Avise seu Treinador imediatamente se suspeitar de acesso indevido.

## 4. Saúde e limites de uso

Este aplicativo não substitui avaliação médica. Interrompa o exercício e procure um
profissional de saúde se sentir dor, tontura ou qualquer sintoma incomum. Ao aceitar
estes termos você declara estar apto a praticar atividade física ou ter apresentado
atestado médico quando solicitado.

## 5. Encerramento

Você pode excluir sua conta a qualquer momento pelo próprio aplicativo, em Perfil. A
exclusão remove seus dados pessoais conforme descrito na Política de Privacidade.

## 6. Alterações

Se estes termos mudarem, uma nova versão será publicada e seu aceite será solicitado
novamente antes de continuar usando o aplicativo.
`.trim();

const PRIVACY_BODY = `
## 1. Controlador e finalidade

Seus dados são tratados pelo Treinador que convidou você, para prescrever treinos,
acompanhar sua evolução e registrar avaliações físicas. A base legal é o consentimento
que você fornece ao criar a conta (LGPD, art. 7º, I) e, para dados de saúde, o
consentimento específico e destacado (art. 11, I).

## 2. Quais dados tratamos

- **Cadastro:** nome, e-mail, telefone, data de nascimento, sexo e altura.
- **Treino:** séries, cargas, repetições, percepção de esforço e observações.
- **Saúde (dados sensíveis):** anamnese, PAR-Q, lesões, condições, medicamentos e
  atestados. Esses campos são armazenados cifrados (AES-256-GCM).
- **Avaliação física:** medidas, dobras cutâneas e, se você autorizar separadamente,
  fotos de progresso.

## 3. Com quem compartilhamos

Somente com o seu Treinador e com os prestadores de infraestrutura necessários para
operar o serviço. Não vendemos seus dados e não os usamos para publicidade.

## 4. Seus direitos

Você pode, a qualquer momento e pelo próprio aplicativo:

- **Acessar e exportar** todos os seus dados em formato JSON (Perfil → Exportar dados);
- **Corrigir** seus dados cadastrais;
- **Revogar** o consentimento para dados de saúde ou para fotos;
- **Excluir sua conta**, o que apaga seus dados pessoais e seu histórico de treinos.

## 5. Retenção

Seus dados são mantidos enquanto sua conta existir. Após a exclusão, registros
estritamente necessários para cumprimento de obrigação legal podem ser mantidos de forma
anonimizada.

## 6. Segurança

Acessos de terceiros a dados sensíveis (anamnese, atestado e fotos) são registrados em
log de auditoria. O tráfego é cifrado em trânsito e os campos sensíveis, em repouso.

## 7. Contato

Fale com seu Treinador para exercer qualquer um dos direitos acima que não esteja
disponível diretamente no aplicativo.
`.trim();

export const LEGAL_DOCUMENTS: Record<LegalDocumentDto['type'], LegalDocumentDto> = {
  terms: {
    type: 'terms',
    version: CURRENT_TERMS_VERSION,
    title: 'Termos de Uso',
    updatedAt: '2026-01-15',
    body: TERMS_BODY,
  },
  privacy: {
    type: 'privacy',
    version: CURRENT_PRIVACY_VERSION,
    title: 'Política de Privacidade',
    updatedAt: '2026-01-15',
    body: PRIVACY_BODY,
  },
};
