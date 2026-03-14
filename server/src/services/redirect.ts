import type { Core } from '@strapi/strapi';

import type { Redirect, CreateRedirectInput, UpdateRedirectInput } from '../types/redirect';

const UID = 'plugin::redirect-manager.redirect' as const;

const PLUGIN_STORE_KEY = 'settings';

export interface ContentTypeSettings {
  enabled: boolean;
  slugField: string | null;
}

export interface PluginSettings {
  enabledContentTypes: Record<string, ContentTypeSettings>;
}

const redirectService = ({ strapi }: { strapi: Core.Strapi }) => ({
  // ---------------------------------------------------------------------------
  // Settings (preserved from existing service)
  // ---------------------------------------------------------------------------

  async getSettings(): Promise<PluginSettings> {
    const store = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'redirect-manager',
    });
    const settings = await store.get({ key: PLUGIN_STORE_KEY });
    return (settings as PluginSettings) ?? { enabledContentTypes: {} };
  },

  async saveSettings(settings: PluginSettings): Promise<PluginSettings> {
    const store = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'redirect-manager',
    });
    await store.set({ key: PLUGIN_STORE_KEY, value: settings });
    return settings;
  },

  async getContentTypes(): Promise<Record<string, unknown>[]> {
    const contentTypes = Object.values(strapi.contentTypes).filter(
      (ct) => (ct as { uid?: string }).uid?.startsWith('api::'),
    );

    return contentTypes.map((ct) => {
      const typed = ct as { uid?: string; info?: { displayName?: string }; attributes?: Record<string, { type?: string }> };
      return {
        uid: typed.uid,
        displayName: typed.info?.displayName ?? typed.uid,
        attributes: Object.entries(typed.attributes ?? {})
          .filter(([, attr]) => attr.type === 'string' || attr.type === 'uid')
          .map(([key]) => key),
      };
    });
  },

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async findAll(): Promise<Redirect[]> {
    const results = await strapi.db.query(UID).findMany({
      orderBy: { createdAt: 'desc' },
    });
    return results as Redirect[];
  },

  async findActive(): Promise<Redirect[]> {
    const results = await strapi.db.query(UID).findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return results as Redirect[];
  },

  async findByFrom(from: string): Promise<Redirect | null> {
    const result = await strapi.db.query(UID).findOne({
      where: { from, isActive: true },
    });
    return (result as Redirect) ?? null;
  },

  async findOne(id: number): Promise<Redirect | null> {
    const result = await strapi.db.query(UID).findOne({
      where: { id },
    });
    return (result as Redirect) ?? null;
  },

  async create(data: CreateRedirectInput): Promise<Redirect> {
    const existing = await strapi.db.query(UID).findOne({
      where: { from: data.from },
    });

    if (existing) {
      throw new Error(`A redirect from '${data.from}' already exists.`);
    }

    const result = await strapi.db.query(UID).create({ data });
    return result as Redirect;
  },

  async update(id: number, data: UpdateRedirectInput): Promise<Redirect> {
    // If 'from' is being changed, verify no conflict with another record
    if (data.from !== undefined) {
      const conflict = await strapi.db.query(UID).findOne({
        where: { from: data.from },
      });
      if (conflict && (conflict as Redirect).id !== id) {
        throw new Error(`A redirect from '${data.from}' already exists.`);
      }
    }

    const result = await strapi.db.query(UID).update({
      where: { id },
      data,
    });
    return result as Redirect;
  },

  async delete(id: number): Promise<void> {
    await strapi.db.query(UID).delete({ where: { id } });
  },

  async toggleActive(id: number): Promise<Redirect> {
    const existing = await strapi.db.query(UID).findOne({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Redirect with id ${id} not found.`);
    }

    const current = existing as Redirect;
    const result = await strapi.db.query(UID).update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    return result as Redirect;
  },
});

export default redirectService;
