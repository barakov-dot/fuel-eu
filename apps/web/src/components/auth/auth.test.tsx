import { ApiError } from '@/lib/api/types';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';

jest.mock('@/lib/api/auth', () => ({
  loginAccount: jest.fn(),
    fetchAuthMe: jest.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
  logoutAccount: jest.fn(),
}));

jest.mock('@/lib/api/favorites', () => ({
  fetchFavorites: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const { loginAccount } = jest.requireMock('@/lib/api/auth');

describe('LoginForm', () => {
  beforeEach(() => {
    loginAccount.mockReset();
  });

  it('renders EN login fields', () => {
    render(
      <I18nProvider locale="en">
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </I18nProvider>,
    );
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows invalid credentials error', async () => {
    loginAccount.mockRejectedValue(new ApiError('Invalid email or password', 401));

    render(
      <I18nProvider locale="en">
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password-xyz' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });
});
