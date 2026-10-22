import { useState } from 'react';
import {
  Alert,
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import { Formik } from 'formik';
import type { TFunction } from 'i18next';
import * as Yup from 'yup';

import { InstanceTypes } from '@osac/types';

import { INSTANCE_TYPE_ACTIVE_LIST_FILTER } from '../../api/v1/instance-types';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorMessage } from '../../utils/error';
import OsacForm from '../Form/OsacForm';
import {
  type ResourceListItem,
  ResourceSelectField,
  type ResourceSelectValue,
  emptyResourceSelectValue,
} from '../Form/ResourceSelectField';

export type CurrentTypeStatus = 'loading' | 'ready' | 'error';

export interface EditInstanceTypeFormModalProps {
  title: string;
  description: string;
  selectConfig: {
    filterItems: (item: ResourceListItem) => boolean;
    formatOptionLabel?: (item: ResourceListItem) => string;
  };
  initialInstanceType?: { id: string; label: string };
  currentTypeStatus: CurrentTypeStatus;
  alert?: { variant: 'info'; text: string };
  isLoading: boolean;
  onSave: (instanceTypeId: string, instanceTypeLabel: string) => Promise<unknown>;
  onClose: () => void;
  onRetryCurrentType?: () => void;
}

interface FormValues {
  instanceType: ResourceSelectValue;
}

const validationSchema = (t: TFunction) =>
  Yup.object({
    instanceType: Yup.object({
      id: Yup.string().required(t('An instance type is required')),
    }),
  });

const EditInstanceTypeFormModal = ({
  title,
  description,
  selectConfig,
  initialInstanceType,
  currentTypeStatus,
  alert,
  isLoading,
  onSave,
  onClose,
  onRetryCurrentType,
}: EditInstanceTypeFormModalProps) => {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<unknown>();
  const initialValue =
    currentTypeStatus === 'ready' && initialInstanceType
      ? { id: initialInstanceType.id, name: initialInstanceType.label }
      : emptyResourceSelectValue();

  return (
    <Formik<FormValues>
      enableReinitialize
      initialValues={{ instanceType: initialValue }}
      validationSchema={validationSchema(t)}
      onSubmit={async (values) => {
        if (!values.instanceType.id || currentTypeStatus !== 'ready') {
          return;
        }
        setSubmitError(undefined);
        try {
          await onSave(values.instanceType.id, values.instanceType.name || values.instanceType.id);
          onClose();
        } catch (error) {
          setSubmitError(error);
        }
      }}
    >
      {({ submitForm, isSubmitting, values }) => {
        const selectionDiffers =
          Boolean(values.instanceType.id) && values.instanceType.id !== initialInstanceType?.id;
        const saveDisabled =
          isSubmitting ||
          isLoading ||
          currentTypeStatus !== 'ready' ||
          !values.instanceType.id;

        return (
          <Modal
            variant="small"
            isOpen
            onClose={isSubmitting ? undefined : onClose}
            aria-labelledby="edit-instance-type-modal-title"
          >
            <ModalHeader title={title} labelId="edit-instance-type-modal-title" />
            <ModalBody>
              <Content component="p">{description}</Content>
              {currentTypeStatus === 'error' ? (
                <Alert
                  variant="danger"
                  isInline
                  title={t('Could not load the current instance type')}
                  actionLinks={
                    <Button variant="link" onClick={onRetryCurrentType}>
                      {t('Retry')}
                    </Button>
                  }
                />
              ) : null}
              <OsacForm>
                <ResourceSelectField
                  name="instanceType"
                  label={t('Instance type')}
                  fieldId="edit-instance-type"
                  service={InstanceTypes}
                  request={{ filter: INSTANCE_TYPE_ACTIVE_LIST_FILTER }}
                  isRequired
                  isTypeahead
                  isDisabled={currentTypeStatus === 'error'}
                  filterItems={selectConfig.filterItems}
                  formatOptionLabel={selectConfig.formatOptionLabel}
                  placeholder={t('Select an instance type')}
                  loadErrorTitle={t('Error loading instance types')}
                  emptyTitle={t('No instance types available')}
                />
              </OsacForm>
              {alert && selectionDiffers ? (
                <Alert variant={alert.variant} isInline title={alert.text} />
              ) : null}
              {submitError ? (
                <Alert variant="danger" isInline title={t('Failed to update the instance type')}>
                  {getErrorMessage(submitError)}
                </Alert>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button variant="link" onClick={onClose} isDisabled={isSubmitting}>
                {t('Cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={submitForm}
                isDisabled={saveDisabled}
                isLoading={isSubmitting}
              >
                {t('Save')}
              </Button>
            </ModalFooter>
          </Modal>
        );
      }}
    </Formik>
  );
};

export default EditInstanceTypeFormModal;
