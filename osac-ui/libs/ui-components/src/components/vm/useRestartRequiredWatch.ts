import { useEffect, useState } from 'react';

import { apiQueryKey } from '../../api/types';
import { useApiQueryClient } from '../../api/use-api-query';

const listeners = new Set<() => void>();
const armedIds = new Set<string>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const armRestartRequiredWatch = (vmId: string) => {
  if (!vmId) {
    return;
  }
  armedIds.add(vmId);
  notify();
};

export const disarmRestartRequiredWatch = (vmId: string) => {
  if (!armedIds.delete(vmId)) {
    return;
  }
  notify();
};

export const useRestartRequiredArmed = (vmId: string): boolean => {
  const [armed, setArmed] = useState(() => armedIds.has(vmId));

  useEffect(() => {
    const sync = () => setArmed(armedIds.has(vmId));
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [vmId]);

  return armed;
};

export const RESTART_REQUIRED_WATCH_INTERVAL_MS = 2000;
export const RESTART_REQUIRED_WATCH_MAX_TICKS = 8;

export const useRestartRequiredWatch = ({
  vmId,
  enabled,
  intervalMs = RESTART_REQUIRED_WATCH_INTERVAL_MS,
  maxTicks = RESTART_REQUIRED_WATCH_MAX_TICKS,
}: {
  vmId: string;
  enabled: boolean;
  intervalMs?: number;
  maxTicks?: number;
}) => {
  const queryClient = useApiQueryClient();

  useEffect(() => {
    if (!enabled || !vmId) {
      return undefined;
    }

    let ticks = 0;
    const tick = () => {
      ticks += 1;
      void queryClient.invalidateQueries({
        queryKey: apiQueryKey('v1/compute_instances', [vmId]),
      });
      if (ticks >= maxTicks) {
        window.clearInterval(timer);
        disarmRestartRequiredWatch(vmId);
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, maxTicks, queryClient, vmId]);
};
