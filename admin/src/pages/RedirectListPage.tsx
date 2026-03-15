import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  IconButton,
  Main,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Toggle,
  Tr,
  Typography,
  Loader,
  Badge,
} from '@strapi/design-system';
import { Pencil, Trash, Plus } from '@strapi/icons';
import { useNavigate } from 'react-router-dom';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';

interface Redirect {
  id: number;
  from: string;
  to: string;
  type: '301' | '302';
  isActive: boolean;
  comment?: string;
}

interface FormValues {
  from: string;
  to: string;
  type: '301' | '302';
  isActive: boolean;
  comment: string;
}

const EMPTY_FORM: FormValues = {
  from: '',
  to: '',
  type: '301',
  isActive: true,
  comment: '',
};

function validateForm(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.from.trim()) {
    errors['from'] = "'From' is required.";
  } else if (!values.from.startsWith('/')) {
    errors['from'] = "'From' must start with '/'.";
  }

  if (!values.to.trim()) {
    errors['to'] = "'To' is required.";
  } else if (!values.to.startsWith('/')) {
    errors['to'] = "'To' must start with '/'.";
  }

  return errors;
}

const RedirectListPage = () => {
  const { get, post, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchRedirects = async () => {
    try {
      const res = await get(`/${PLUGIN_ID}/redirects`);
      setRedirects((res.data as { data: Redirect[] }).data);
    } catch {
      toggleNotification({
        type: 'danger',
        message: 'Failed to load redirects',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRedirects();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormValues(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (redirect: Redirect) => {
    setEditingId(redirect.id);
    setFormValues({
      from: redirect.from,
      to: redirect.to,
      type: redirect.type,
      isActive: redirect.isActive,
      comment: redirect.comment ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormChange = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    const errors = validateForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        from: formValues.from,
        to: formValues.to,
        type: formValues.type,
        isActive: formValues.isActive,
        comment: formValues.comment || undefined,
      };

      if (editingId !== null) {
        await put(`/${PLUGIN_ID}/redirects/${editingId}`, payload);
        toggleNotification({ type: 'success', message: 'Redirect updated' });
      } else {
        await post(`/${PLUGIN_ID}/redirects`, payload);
        toggleNotification({ type: 'success', message: 'Redirect created' });
      }

      setModalOpen(false);
      await fetchRedirects();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save redirect';
      toggleNotification({ type: 'danger', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (redirect: Redirect) => {
    try {
      await put(`/${PLUGIN_ID}/redirects/${redirect.id}/toggle`, {});
      await fetchRedirects();
    } catch {
      toggleNotification({ type: 'danger', message: 'Failed to toggle redirect' });
    }
  };

  const openDeleteDialog = (id: number) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletingId === null) return;
    try {
      await del(`/${PLUGIN_ID}/redirects/${deletingId}`);
      toggleNotification({ type: 'success', message: 'Redirect deleted' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      await fetchRedirects();
    } catch {
      toggleNotification({ type: 'danger', message: 'Failed to delete redirect' });
    }
  };

  if (isLoading) {
    return (
      <Main>
        <Flex justifyContent="center" padding={8}>
          <Loader>Loading redirects...</Loader>
        </Flex>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={6}>
          <Typography variant="alpha" tag="h1">
            Redirects
          </Typography>
          <Flex gap={2}>
            <Button variant="secondary" onClick={() => navigate('orphans')}>
              Orphan Redirects
            </Button>
            <Button startIcon={<Plus />} onClick={openCreateModal}>
              New Redirect
            </Button>
          </Flex>
        </Flex>

        {redirects.length === 0 ? (
          <Box padding={6} background="neutral100" borderRadius="4px">
            <Typography textColor="neutral600">
              No redirects yet. Click "New Redirect" to add one.
            </Typography>
          </Box>
        ) : (
          <Table colCount={6} rowCount={redirects.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">FROM</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">TO</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">TYPE</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">STATUS</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">ACTIVE</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">ACTIONS</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {redirects.map((redirect) => (
                <Tr key={redirect.id}>
                  <Td>
                    <Typography>{redirect.from}</Typography>
                  </Td>
                  <Td>
                    <Typography>{redirect.to}</Typography>
                  </Td>
                  <Td>
                    <Badge>{redirect.type}</Badge>
                  </Td>
                  <Td>
                    <Badge active={redirect.isActive}>
                      {redirect.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <Toggle
                      checked={redirect.isActive}
                      onChange={() => handleToggleActive(redirect)}
                      onLabel="On"
                      offLabel="Off"
                      aria-label={`Toggle active for ${redirect.from}`}
                    />
                  </Td>
                  <Td>
                    <Flex gap={2}>
                      <IconButton
                        label="Edit"
                        onClick={() => openEditModal(redirect)}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        onClick={() => openDeleteDialog(redirect.id)}
                      >
                        <Trash />
                      </IconButton>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Add/Edit Modal */}
      <Modal.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Content>
          <Modal.Header closeLabel="Close">
            <Modal.Title>
              {editingId !== null ? 'Edit Redirect' : 'New Redirect'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Flex direction="column" gap={4}>
              <Field.Root
                name="from"
                error={formErrors['from']}
                required
              >
                <Field.Label>From (source path)</Field.Label>
                <TextInput
                  placeholder="/old-path"
                  value={formValues.from}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFormChange('from', e.target.value)
                  }
                />
                <Field.Error />
              </Field.Root>

              <Field.Root
                name="to"
                error={formErrors['to']}
                required
              >
                <Field.Label>To (destination path)</Field.Label>
                <TextInput
                  placeholder="/new-path"
                  value={formValues.to}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFormChange('to', e.target.value)
                  }
                />
                <Field.Error />
              </Field.Root>

              <Field.Root name="type">
                <Field.Label>Redirect Type</Field.Label>
                <SingleSelect
                  value={formValues.type}
                  onChange={(value: string | number) =>
                    handleFormChange('type', String(value) as '301' | '302')
                  }
                >
                  <SingleSelectOption value="301">301 — Permanent</SingleSelectOption>
                  <SingleSelectOption value="302">302 — Temporary</SingleSelectOption>
                </SingleSelect>
              </Field.Root>

              <Field.Root name="isActive">
                <Field.Label>Active</Field.Label>
                <Toggle
                  checked={formValues.isActive}
                  onChange={() => handleFormChange('isActive', !formValues.isActive)}
                  onLabel="On"
                  offLabel="Off"
                  aria-label="Redirect active"
                />
              </Field.Root>

              <Field.Root name="comment">
                <Field.Label>Comment (optional)</Field.Label>
                <TextInput
                  placeholder="Reason for this redirect..."
                  value={formValues.comment}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleFormChange('comment', e.target.value)
                  }
                />
              </Field.Root>
            </Flex>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close>
              <Button variant="tertiary">Cancel</Button>
            </Modal.Close>
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {editingId !== null ? 'Save Changes' : 'Create'}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>Delete Redirect</Dialog.Header>
          <Dialog.Body>
            Are you sure you want to delete this redirect? This action cannot be undone.
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Main>
  );
};

export { RedirectListPage };
