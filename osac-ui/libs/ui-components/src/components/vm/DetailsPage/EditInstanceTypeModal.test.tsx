import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type ComputeInstance,
  ComputeInstanceState,
  ComputeInstances,
  type InstanceType,
  InstanceTypeState,
  InstanceTypes,
} from '@osac/types';

import EditInstanceTypeModal from './EditInstanceTypeModal';
import { renderWithProviders } from '../../../test-utils/TestProviders';

const cpu = {
  id: 'cpu-1',
  metadata: { name: 'CPU small' },
  spec: { state: InstanceTypeState.ACTIVE, vcpus: 2, memoryGib: 4 },
} as InstanceType;

const cpuLarge = {
  id: 'cpu-2',
  metadata: { name: 'CPU large' },
  spec: { state: InstanceTypeState.ACTIVE, vcpus: 8, memoryGib: 16 },
} as InstanceType;

const gpu = {
  id: 'gpu-1',
  metadata: { name: 'GPU small' },
  spec: {
    state: InstanceTypeState.ACTIVE,
    vcpus: 4,
    memoryGib: 16,
    gpu: { count: 1, resourceName: 'nvidia.com/gpu' },
  },
} as InstanceType;

const vm = (state: ComputeInstanceState, instanceTypeId: string): ComputeInstance =>
  ({
    id: 'vm-1',
    metadata: { name: 'web-01' },
    status: { state },
    spec: { instanceType: { id: instanceTypeId } },
  }) as ComputeInstance;

const renderWrapper = ({
  instance = vm(ComputeInstanceState.RUNNING, 'cpu-1'),
  types = [cpu, cpuLarge, gpu],
  getMode = 'ready' as 'ready' | 'loading' | 'error',
  onUpdate,
  rejectUpdate = false,
}: {
  instance?: ComputeInstance;
  types?: InstanceType[];
  getMode?: 'ready' | 'loading' | 'error';
  onUpdate?: (request: unknown) => void;
  rejectUpdate?: boolean;
} = {}) => {
  let getCalls = 0;
  const transport = createRouterTransport((router) => {
    router.service(InstanceTypes, {
      list: () => ({ items: types }),
      get: () => {
        getCalls += 1;
        if (getMode === 'error') {
          throw new ConnectError('lookup failed', Code.Unavailable);
        }
        if (getMode === 'loading' && getCalls === 1) {
          return new Promise(() => undefined);
        }
        return { object: types.find((item) => item.id === instance.spec?.instanceType?.id) };
      },
    });
    router.service(ComputeInstances, {
      update: (request) => {
        onUpdate?.(request);
        if (rejectUpdate) {
          throw new ConnectError('cannot change GPU configuration', Code.FailedPrecondition);
        }
        return { object: request.object, warnings: [] };
      },
    });
  });

  return renderWithProviders(<EditInstanceTypeModal vm={instance} onClose={vi.fn()} />, {
    transport,
  });
};

describe('EditInstanceTypeModal wrapper', () => {
  it('offers only GPU types when the current type has a GPU', async () => {
    const { user } = renderWrapper({
      instance: vm(ComputeInstanceState.RUNNING, 'gpu-1'),
      types: [cpu, gpu],
    });

    await user.click(await screen.findByRole('combobox'));
    expect(await screen.findByRole('option', { name: /GPU small/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /CPU small/ })).not.toBeInTheDocument();
  });

  it('does not force a non-GPU filter while the current type is still loading', async () => {
    const { user } = renderWrapper({ getMode: 'loading', types: [cpu, gpu] });

    await user.click(await screen.findByRole('combobox'));
    expect(await screen.findByRole('option', { name: /CPU small/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /GPU small/ })).toBeInTheDocument();
  });

  it('passes the next-start alert for a stopped VM after the selection changes', async () => {
    const { user } = renderWrapper({
      instance: vm(ComputeInstanceState.STOPPED, 'cpu-1'),
    });

    expect(screen.queryByText('Resize will apply on next start.')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /CPU large/ }));
    expect(await screen.findByText('Resize will apply on next start.')).toBeInTheDocument();
  });

  it('shows an inline danger alert when the server rejects the update', async () => {
    const { user } = renderWrapper({
      instance: vm(ComputeInstanceState.RUNNING, 'cpu-1'),
      rejectUpdate: true,
    });

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /CPU large/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to update the instance type')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Edit instance type' })).toBeInTheDocument();
  });

  it('updates with the explicit instance type mask', async () => {
    let request: { updateMask?: { paths?: string[] }; object?: { spec?: { instanceType?: { id?: string } } } } | undefined;
    const { user } = renderWrapper({
      onUpdate: (value) => {
        request = value as typeof request;
      },
    });

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /CPU large/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(request?.updateMask?.paths).toEqual(['spec.instance_type']));
    expect(request?.object?.spec?.instanceType?.id).toBe('cpu-2');
  });
});
