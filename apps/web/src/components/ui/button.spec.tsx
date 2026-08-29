import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
  });

  it('marks itself busy and disabled while loading', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('does not fire while loading', async () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
