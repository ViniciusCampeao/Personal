import { ApiError, type ProblemDetails } from './api';
import { applyProblemToForm, fieldErrorsFrom, problemMessage } from './problem';

function problemWith(errors: string[]): ProblemDetails {
  return { type: 'about:blank', title: 'Dados inválidos', status: 400, errors };
}

describe('fieldErrorsFrom', () => {
  it('splits "campo: mensagem" into a field entry', () => {
    const { fields, formLevel } = fieldErrorsFrom(problemWith(['email: E-mail inválido.']));
    expect(fields).toEqual({ email: 'E-mail inválido.' });
    expect(formLevel).toEqual([]);
  });

  it('keeps nested paths dot-joined, as react-hook-form expects them', () => {
    const { fields } = fieldErrorsFrom(
      problemWith(['consents.terms: É necessário aceitar os Termos de Uso.']),
    );
    expect(fields['consents.terms']).toBe('É necessário aceitar os Termos de Uso.');
  });

  it('treats "(root)" as a form-level message', () => {
    const { fields, formLevel } = fieldErrorsFrom(
      problemWith(['(root): Informe e-mail ou telefone.']),
    );
    expect(fields).toEqual({});
    expect(formLevel).toEqual(['Informe e-mail ou telefone.']);
  });

  it('only splits on the first separator, so messages keep their colons', () => {
    const { fields } = fieldErrorsFrom(problemWith(['nome: inválido: use letras.']));
    expect(fields.nome).toBe('inválido: use letras.');
  });
});

describe('problemMessage', () => {
  it('prefers the detail over the title', () => {
    const error = new ApiError(
      { type: 'about:blank', title: 'Não autorizado', status: 401, detail: 'Senha incorreta.' },
      401,
    );
    expect(problemMessage(error)).toBe('Senha incorreta.');
  });

  it('explains a failed request as a connectivity problem', () => {
    expect(problemMessage(new TypeError('Failed to fetch'))).toBe(
      'Sem conexão. Verifique sua internet.',
    );
  });
});

describe('applyProblemToForm', () => {
  it('routes each message to its own field', () => {
    const setError = jest.fn();
    applyProblemToForm(new ApiError(problemWith(['email: E-mail inválido.']), 400), setError, [
      'email',
    ]);

    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'E-mail inválido.',
    });
  });

  it('sends messages for unknown fields to the form-level slot, so they are never swallowed', () => {
    const setError = jest.fn();
    applyProblemToForm(
      new ApiError(problemWith(['campoDesconhecido: Valor inválido.']), 400),
      setError,
      ['email'],
    );

    expect(setError).toHaveBeenCalledWith('root.serverError', {
      type: 'server',
      message: 'Valor inválido.',
    });
  });

  it('falls back to the problem message when there are no field errors', () => {
    const setError = jest.fn();
    applyProblemToForm(
      new ApiError(
        { type: 'about:blank', title: 'Conflito', status: 409, detail: 'Já existe.' },
        409,
      ),
      setError,
    );

    expect(setError).toHaveBeenCalledWith('root.serverError', {
      type: 'server',
      message: 'Já existe.',
    });
  });
});
