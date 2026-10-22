import type { ComponentProps } from 'react';
import { Code, ConnectError } from '@connectrpc/connect';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type InstanceType, InstanceTypeState } from '@osac/types';

import EditInstanceTypeFormModal from './EditInstanceTypeModal';
import { renderWithProviders } from '../../test-utils/TestProviders';

const current = {
  id: 'standard-4-8',
  metadata: { name: 'Standard' },
  spec: { state: InstanceTypeState.ACTIVE, vcpus: 4, memoryGib: 8 },
} as InstanceType;

const other = {
  id: 'standard-8-16',
  metadata: { name: 'Large' },
  spec: { state: InstanceTypeState.ACTIVE, vcpus: 8, memoryGib: 16 },
} as InstanceType;

const renderModal = (props: Partial<ComponentProps<typeof EditInstanceTypeFormModal>> = {}) =>
  renderWithProviders(
    <EditInstanceTypeFormModal
      title="Edit instance type"
      description="Select a new instance type for this virtual machine."
      selectConfig={{ filterItems: () => true }}
      currentTypeStatus="ready"
      initialInstanceType={{ id: current.id, label: 'Standard' }}
      isLoading={false}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      {...props}
    />,
    { apiFixtures: { instanceTypes: [current, other] } },
  );

describe('EditInstanceTypeFormModal', () => {
  it('renders the title, description, instance type field, and Save', () => {
    renderModal();

    expect(screen.getByText('Edit instance type')).toBeInTheDocument();
    expect(
      screen.getByText('Select a new instance type for this virtual machine.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Instance type/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Save while the current type is loading', () => {
    renderModal({ currentTypeStatus: 'loading', initialInstanceType: undefined, isLoading: true });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('blocks Save and offers retry when the current type failed to load', async () => {
    const onRetryCurrentType = vi.fn();
    const { user } = renderModal({
      currentTypeStatus: 'error',
      initialInstanceType: undefined,
      onRetryCurrentType,
    });

    expect(screen.getByText('Could not load the current instance type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByText('Standard')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryCurrentType).toHaveBeenCalled();
  });

  it('does not show a restart warning when the selection changes', async () => {
    const { user } = renderModal();

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Large/ }));

    expect(screen.queryByText(/restart/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Resize will apply on next start/)).not.toBeInTheDocument();
  });

  it('shows the stopped info alert only after the selection changes', async () => {
    const { user } = renderModal({
      alert: { variant: 'info', text: 'Resize will apply on next start.' },
    });

    expect(screen.queryByText('Resize will apply on next start.')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Large/ }));

    expect(await screen.findByText('Resize will apply on next start.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the modal open and shows a danger alert when save fails', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new ConnectError('cannot change GPU', Code.FailedPrecondition));
    const onClose = vi.fn();
    const { user } = renderModal({ onSave, onClose });

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Large/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to update the instance type')).toBeInTheDocument();
    expect(screen.getByText('cannot change GPU')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { user } = renderModal({ onSave, onClose });

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Large/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('standard-8-16', expect.any(String)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
