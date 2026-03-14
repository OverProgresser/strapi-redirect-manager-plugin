import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Main,
  Typography,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';

interface ContentTypeInfo {
  uid: string;
  displayName: string;
  attributes: string[];
}

interface ContentTypeSettings {
  enabled: boolean;
  slugField: string | null;
}

interface PluginSettings {
  enabledContentTypes: Record<string, ContentTypeSettings>;
}

const Settings = () => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [contentTypes, setContentTypes] = useState<ContentTypeInfo[]>([]);
  const [settings, setSettings] = useState<PluginSettings>({ enabledContentTypes: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ctRes, settingsRes] = await Promise.all([
          get(`/api/${PLUGIN_ID}/content-types`),
          get(`/api/${PLUGIN_ID}/settings`),
        ]);
        setContentTypes(ctRes.data as ContentTypeInfo[]);
        setSettings(settingsRes.data as PluginSettings);
      } catch {
        toggleNotification({
          type: 'danger',
          message: 'Failed to load settings',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggle = (uid: string) => {
    setSettings((prev) => ({
      enabledContentTypes: {
        ...prev.enabledContentTypes,
        [uid]: {
          ...prev.enabledContentTypes[uid],
          enabled: !prev.enabledContentTypes[uid]?.enabled,
          slugField: prev.enabledContentTypes[uid]?.slugField ?? null,
        },
      },
    }));
  };

  const handleSlugFieldChange = (uid: string, value: string) => {
    setSettings((prev) => ({
      enabledContentTypes: {
        ...prev.enabledContentTypes,
        [uid]: {
          ...prev.enabledContentTypes[uid],
          enabled: prev.enabledContentTypes[uid]?.enabled ?? false,
          slugField: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await post(`/api/${PLUGIN_ID}/settings`, settings);
      toggleNotification({
        type: 'success',
        message: 'Settings saved successfully',
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: 'Failed to save settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Main>
        <Flex justifyContent="center" padding={8}>
          <Loader>Loading settings...</Loader>
        </Flex>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={6}>
          <Typography variant="alpha" tag="h1">
            Redirect Manager Settings
          </Typography>
          <Button onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Flex>

        <Table colCount={3} rowCount={contentTypes.length}>
          <Thead>
            <Tr>
              <Th>
                <Typography variant="sigma">Content Type</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Enabled</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Slug Field</Typography>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {contentTypes.map((ct) => {
              const ctSettings = settings.enabledContentTypes?.[ct.uid] ?? {
                enabled: false,
                slugField: null,
              };

              return (
                <Tr key={ct.uid}>
                  <Td>
                    <Typography>{ct.displayName}</Typography>
                  </Td>
                  <Td>
                    <Checkbox
                      checked={ctSettings.enabled}
                      onChange={() => handleToggle(ct.uid)}
                      aria-label={`Enable redirect tracking for ${ct.displayName}`}
                    />
                  </Td>
                  <Td>
                    <SingleSelect
                      value={ctSettings.slugField ?? ''}
                      onChange={(value: string | number) =>
                        handleSlugFieldChange(ct.uid, String(value))
                      }
                      disabled={!ctSettings.enabled}
                      placeholder="Select slug field"
                    >
                      {ct.attributes.map((attr) => (
                        <SingleSelectOption key={attr} value={attr}>
                          {attr}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>
    </Main>
  );
};

export { Settings };
