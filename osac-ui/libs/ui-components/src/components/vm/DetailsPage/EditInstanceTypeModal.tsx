import type { ComputeInstance, InstanceType } from '@osac/types';
import { ComputeInstanceState } from '@osac/types';

import { useInstanceType } from '../../../api/v1/instance-types';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ResourceListItem } from '../../Form/ResourceSelectField';
import EditInstanceTypeFormModal from '../EditInstanceTypeModal';
import { useUpdateVmInstanceType } from '../useUpdateVmInstanceType';
import { formatInstanceTypeOptionLabel } from '../utils';

interface EditInstanceTypeModalProps {
  vm: ComputeInstance;
  onClose: () => void;
}

const hasGpu = (item: { spec?: { gpu?: unknown } } | undefined): boolean => Boolean(item?.spec?.gpu);

const EditInstanceTypeModal = ({ vm, onClose }: EditInstanceTypeModalProps) => {
  const { t } = useTranslation();
  const { updateInstanceType } = useUpdateVmInstanceType();
  const {
    data: currentType,
    isLoading,
    isError,
    refetch,
  } = useInstanceType(vm.spec?.instanceType?.id);

  const currentTypeStatus = isLoading ? 'loading' : isError || !currentType ? 'error' : 'ready';
  const stopped = vm.status?.state === ComputeInstanceState.STOPPED;

  return (
    <EditInstanceTypeFormModal
      title={t('Edit instance type')}
      description={t('Select a new instance type for this virtual machine.')}
      selectConfig={{
        filterItems: (item: ResourceListItem) => {
          if (currentTypeStatus !== 'ready' || !currentType) {
            return true;
          }
          return hasGpu(item as InstanceType) === hasGpu(currentType);
        },
        formatOptionLabel: (item) => formatInstanceTypeOptionLabel(item as InstanceType),
      }}
      initialInstanceType={
        currentTypeStatus === 'ready' && currentType
          ? {
              id: currentType.id,
              label: currentType.metadata?.name || currentType.id,
            }
          : undefined
      }
      currentTypeStatus={currentTypeStatus}
      alert={
        stopped
          ? { variant: 'info', text: t('Resize will apply on next start.') }
          : undefined
      }
      isLoading={isLoading}
      onRetryCurrentType={() => {
        void refetch();
      }}
      onSave={(instanceTypeId, instanceTypeLabel) =>
        updateInstanceType(vm, instanceTypeId, instanceTypeLabel)
      }
      onClose={onClose}
    />
  );
};

export default EditInstanceTypeModal;
