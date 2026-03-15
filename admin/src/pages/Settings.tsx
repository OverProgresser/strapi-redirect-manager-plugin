import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Main,
  Toggle,
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
  urlPrefix?: string;
}

interface PluginSettings {
  enabledContentTypes: Record<string, ContentTypeSettings>;
  autoRedirectOnSlugChange: boolean;
  chainDetectionEnabled: boolean;
  orphanRedirectEnabled: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
  enabledContentTypes: {},
  autoRedirectOnSlugChange: true,
  chainDetectionEnabled: true,
  orphanRedirectEnabled: true,
};

const Settings = () => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [contentTypes, setContentTypes] = useState<ContentTypeInfo[]>([]);
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ctRes, settingsRes] = await Promise.all([
          get(`/${PLUGIN_ID}/content-types`),
          get(`/${PLUGIN_ID}/settings`),
        ]);
        setContentTypes(ctRes.data as ContentTypeInfo[]);
        const loaded = settingsRes.data as Partial<PluginSettings>;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...loaded,
          enabledContentTypes: loaded.enabledContentTypes ?? {},
        });
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

  const handleFeatureToggle = (key: keyof Omit<PluginSettings, 'enabledContentTypes'>) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggle = (uid: string) => {
    setSettings((prev) => ({
      ...prev,
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
      ...prev,
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
      await post(`/${PLUGIN_ID}/settings`, settings);
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

        {/* Feature toggles */}
        <Box paddingBottom={6}>
          <Typography variant="delta" tag="h2" paddingBottom={4}>
            Features
          </Typography>
          <Flex direction="column" gap={4} alignItems="flex-start">
            <Toggle
              checked={settings.autoRedirectOnSlugChange}
              onChange={() => handleFeatureToggle('autoRedirectOnSlugChange')}
              onLabel="On"
              offLabel="Off"
              aria-label="Auto-create redirect on slug change"
            />
            <Typography>Auto-create redirect when slug changes</Typography>

            <Toggle
              checked={settings.chainDetectionEnabled}
              onChange={() => handleFeatureToggle('chainDetectionEnabled')}
              onLabel="On"
              offLabel="Off"
              aria-label="Enable chain detection"
            />
            <Typography>Enable chain detection (blocks chains longer than 10 hops)</Typography>

            <Toggle
              checked={settings.orphanRedirectEnabled}
              onChange={() => handleFeatureToggle('orphanRedirectEnabled')}
              onLabel="On"
              offLabel="Off"
              aria-label="Enable orphan redirect tracking"
            />
            <Typography>Enable orphan redirect tracking (creates pending entries on content deletion)</Typography>
          </Flex>
        </Box>

        {/* Content type table */}
        <Typography variant="delta" tag="h2" paddingBottom={4}>
          Content Types
        </Typography>
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
                      onCheckedChange={() => handleToggle(ct.uid)}
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
