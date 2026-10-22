import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ComputeInstance,
  ComputeInstanceConditionType,
  ComputeInstanceState,
  ConditionStatus,
} from '@osac/types';

import RestartRequiredBanner from './RestartRequiredBanner';
import {
  armRestartRequiredWatch,
  disarmRestartRequiredWatch,
  useRestartRequiredArmed,
  useRestartRequiredWatch,
} from './useRestartRequiredWatch';
import * as apiQuery from '../../api/use-api-query';
import { renderWithProviders } from '../../test-utils/TestProviders';

const baseVm = {
  id: 'vm-watch',
  status: { state: ComputeInstanceState.RUNNING, conditions: [] },
} as unknown as ComputeInstance;

const WatchHarness = ({ intervalMs, maxTicks }: { intervalMs: number; maxTicks: number }) => {
  const armed = useRestartRequiredArmed(baseVm.id);
  useRestartRequiredWatch({
    vmId: baseVm.id,
    enabled: armed,
    intervalMs,
    maxTicks,
  });
  return <output aria-label="armed">{armed ? 'yes' : 'no'}</output>;
};

describe('useRestartRequiredWatch', () => {
  beforeEach(() => {
    disarmRestartRequiredWatch(baseVm.id);
  });

  it('stops invalidating after the bounded window', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(apiQuery, 'useApiQueryClient').mockReturnValue({
      invalidateQueries,
      refetchQueries: vi.fn(),
      cancelQueries: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
      setQueriesData: vi.fn(),
    });

    armRestartRequiredWatch(baseVm.id);
    renderWithProviders(<WatchHarness intervalMs={15} maxTicks={2} />);

    await waitFor(() => expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(2));
    const callsAtBound = invalidateQueries.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(invalidateQueries.mock.calls.length).toBe(callsAtBound);
    await waitFor(() => expect(screen.getByLabelText('armed')).toHaveTextContent('no'));
    vi.restoreAllMocks();
  });

  it('shows the banner after a later condition arrives', async () => {
    const withCondition = {
      ...baseVm,
      status: {
        state: ComputeInstanceState.RUNNING,
        conditions: [
          {
            type: ComputeInstanceConditionType.RESTART_REQUIRED,
            status: ConditionStatus.TRUE,
          },
        ],
      },
    } as unknown as ComputeInstance;

    const Harness = () => {
      const [vm, setVm] = useState(baseVm);
      return (
        <>
          <RestartRequiredBanner vm={vm} />
          <button type="button" onClick={() => setVm(withCondition)}>
            Apply condition
          </button>
        </>
      );
    };

    const view = renderWithProviders(<Harness />);
    expect(screen.queryByText('Restart required')).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Apply condition' }));
    expect(await screen.findByText('Restart required')).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Warning alert details' }));
    expect(screen.getByText('Detected changes')).toBeInTheDocument();
  });
});
