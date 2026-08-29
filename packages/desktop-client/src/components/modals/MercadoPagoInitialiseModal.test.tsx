import React from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TestProviders } from '#mocks';

import { MercadoPagoInitialiseModal } from './MercadoPagoInitialiseModal';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

vi.mock('#hooks/useCurrentAccess', () => ({
  useCurrentAccess: () => ({
    cloudFileId: 'test-file-123',
    isAdmin: true,
  }),
}));

describe('MercadoPagoInitialiseModal', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input for access token and scope toggle', () => {
    render(
      <TestProviders>
        <MercadoPagoInitialiseModal
          onSuccess={mockOnSuccess}
          credentialSource="per-budget-file"
        />
      </TestProviders>,
    );

    expect(
      screen.getByLabelText(/Access Token \(APP_USR-\.\.\.\):/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/For this budget only/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Save and continue/i }),
    ).toBeInTheDocument();
  });

  it('shows validation error when submitted with empty token', async () => {
    render(
      <TestProviders>
        <MercadoPagoInitialiseModal
          onSuccess={mockOnSuccess}
          credentialSource="per-budget-file"
        />
      </TestProviders>,
    );

    const submitBtn = screen.getByRole('button', {
      name: /Save and continue/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(
        /It is required to provide the Mercado Pago Access Token\./i,
      ),
    ).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it('successfully configures credentials and calls onSuccess', async () => {
    vi.mocked(send).mockResolvedValueOnce({
      configured: true,
    });

    render(
      <TestProviders>
        <MercadoPagoInitialiseModal
          onSuccess={mockOnSuccess}
          credentialSource="per-budget-file"
        />
      </TestProviders>,
    );

    const input = screen.getByLabelText(/Access Token \(APP_USR-\.\.\.\):/i);
    fireEvent.change(input, {
      target: { value: 'APP_USR-12345678-test-token' },
    });

    const submitBtn = screen.getByRole('button', {
      name: /Save and continue/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith('mercadopago-configure', {
        accessToken: 'APP_USR-12345678-test-token',
        fileId: 'test-file-123',
      });
      expect(mockOnSuccess).toHaveBeenCalledWith(true);
    });
  });

  it('displays API error details when configuration fails', async () => {
    vi.mocked(send).mockResolvedValueOnce({
      error: 'authentication-failed',
      details: 'Invalid Mercado Pago access token',
    });

    render(
      <TestProviders>
        <MercadoPagoInitialiseModal
          onSuccess={mockOnSuccess}
          credentialSource="per-budget-file"
        />
      </TestProviders>,
    );

    const input = screen.getByLabelText(/Access Token \(APP_USR-\.\.\.\):/i);
    fireEvent.change(input, {
      target: { value: 'APP_USR-invalid-token' },
    });

    const submitBtn = screen.getByRole('button', {
      name: /Save and continue/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Invalid Mercado Pago access token/i),
    ).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
