import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Loader,
  Main,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { useNavigate } from 'react-router-dom';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';

interface OrphanRedirect {
  id: number;
  contentType: string;
  slug: string;
  from: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

const OrphanRedirectPage = () => {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const [orphans, setOrphans] = useState<OrphanRedirect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveTo, setResolveTo] = useState('');
  const [resolveError, setResolveError] = useState('');

  // Dismiss dialog state
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const fetchOrphans = async () => {
    try {
      const res = await get(`/${PLUGIN_ID}/orphan-redirects`);
      setOrphans((res.data as { data: OrphanRedirect[] }).data);
    } catch {
      toggleNotification({ type: 'danger', message: 'Failed to load orphan redirects' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrphans();
  }, []);

  const openResolveDialog = (id: number) => {
    setResolvingId(id);
    setResolveTo('');
    setResolveError('');
    setResolveDialogOpen(true);
  };

  const openDismissDialog = (id: number) => {
    setDismissingId(id);
    setDismissDialogOpen(true);
  };

  const handleResolveConfirm = async () => {
    if (resolvingId === null) return;

    if (!resolveTo.trim()) {
      setResolveError("'To' path is required.");
      return;
    }
    if (!resolveTo.startsWith('/')) {
      setResolveError("'To' path must start with '/'.");
      return;
    }

    setIsSubmitting(true);
    try {
      await put(`/${PLUGIN_ID}/orphan-redirects/${resolvingId}/resolve`, { to: resolveTo });
      toggleNotification({ type: 'success', message: 'Redirect created successfully' });
      setResolveDialogOpen(false);
      setResolvingId(null);
      await fetchOrphans();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve orphan redirect';
      setResolveError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissConfirm = async () => {
    if (dismissingId === null) return;
    setIsSubmitting(true);
    try {
      await put(`/${PLUGIN_ID}/orphan-redirects/${dismissingId}/dismiss`, {});
      toggleNotification({ type: 'success', message: 'Orphan redirect dismissed' });
      setDismissDialogOpen(false);
      setDismissingId(null);
      await fetchOrphans();
    } catch {
      toggleNotification({ type: 'danger', message: 'Failed to dismiss orphan redirect' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Main>
        <Flex justifyContent="center" padding={8}>
          <Loader>Loading orphan redirects...</Loader>
        </Flex>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={6}>
          <Typography variant="alpha" tag="h1">
            Orphan Redirects
          </Typography>
          <Button variant="tertiary" onClick={() => navigate(-1)}>
            Back to Redirects
          </Button>
        </Flex>

        <Box paddingBottom={4}>
          <Typography textColor="neutral600">
            These URLs no longer have a destination because the content was deleted.
            Resolve each one by creating a redirect, or dismiss to ignore it.
          </Typography>
        </Box>

        {orphans.length === 0 ? (
          <Box padding={6} background="neutral100" borderRadius="4px">
            <Typography textColor="neutral600">
              No pending orphan redirects. Deleted content will appear here if orphan tracking is enabled.
            </Typography>
          </Box>
        ) : (
          <Table colCount={4} rowCount={orphans.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">FROM PATH</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">CONTENT TYPE</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">SLUG</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">ACTIONS</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {orphans.map((orphan) => (
                <Tr key={orphan.id}>
                  <Td>
                    <Typography fontWeight="semiBold">{orphan.from}</Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">{orphan.contentType}</Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">{orphan.slug}</Typography>
                  </Td>
                  <Td>
                    <Flex gap={2}>
                      <Button
                        size="S"
                        onClick={() => openResolveDialog(orphan.id)}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="S"
                        variant="danger-light"
                        onClick={() => openDismissDialog(orphan.id)}
                      >
                        Dismiss
                      </Button>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Resolve dialog */}
      <Dialog.Root open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>Resolve Orphan Redirect</Dialog.Header>
          <Dialog.Body>
            <Box paddingBottom={4}>
              <Typography textColor="neutral600">
                Create a 301 redirect from the deleted content's path to a new destination.
              </Typography>
            </Box>
            <Field.Root name="resolveTo" error={resolveError} required>
              <Field.Label>Redirect to (destination path)</Field.Label>
              <TextInput
                placeholder="/new-destination"
                value={resolveTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setResolveTo(e.target.value);
                  setResolveError('');
                }}
              />
              <Field.Error />
            </Field.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button onClick={handleResolveConfirm} loading={isSubmitting}>
                Create Redirect
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>

      {/* Dismiss dialog */}
      <Dialog.Root open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>Dismiss Orphan Redirect</Dialog.Header>
          <Dialog.Body>
            Are you sure you want to dismiss this orphan redirect? No redirect will be created for this path.
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger" onClick={handleDismissConfirm} loading={isSubmitting}>
                Dismiss
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Main>
  );
};

export { OrphanRedirectPage };
