import type { Core } from '@strapi/strapi';

import type { Redirect, OrphanRedirect, CreateRedirectInput, UpdateRedirectInput } from '../types/redirect';
import { invalidateCache } from '../middlewares/redirect';

const UID = 'plugin::redirect-manager.redirect' as const;
const ORPHAN_UID = 'plugin::redirect-manager.orphan-redirect' as const;

const PLUGIN_STORE_KEY = 'settings';
const MAX_CHAIN_DEPTH = 10;

export interface ContentTypeSettings {
  enabled: boolean;
  slugField: string | null;
  urlPrefix?: string;
}

export interface PluginSettings {
  enabledContentTypes: Record<string, ContentTypeSettings>;
  autoRedirectOnSlugChange: boolean;
  chainDetectionEnabled: boolean;
  orphanRedirectEnabled: boolean;
}

const redirectService = ({ strapi }: { strapi: Core.Strapi }) => {
  const defaults: PluginSettings = {
    enabledContentTypes: {},
    autoRedirectOnSlugChange: true,
    chainDetectionEnabled: true,
    orphanRedirectEnabled: true,
  };

  async function getStoreSettings(): Promise<PluginSettings> {
    const store = strapi.store({
      environment: '',
      type: 'plugin',
      name: 'redirect-manager',
    });
    const settings = await store.get({ key: PLUGIN_STORE_KEY });
    return (settings as PluginSettings) ?? defaults;
  }

  async function checkChainDepth(
    to: string,
    visited: Set<string>,
    depth: number,
  ): Promise<void> {
    if (!to) return;

    if (depth > MAX_CHAIN_DEPTH) {
      throw new Error(`Redirect chain exceeds maximum depth of ${MAX_CHAIN_DEPTH} hops.`);
    }
    if (visited.has(to)) {
      throw new Error('Redirect chain contains a cycle.');
    }
    visited.add(to);

    const next = await strapi.db.query(UID).findOne({
      where: { from: to, isActive: true },
    });

    if (next) {
      await checkChainDepth((next as Redirect).to, visited, depth + 1);
    }
  }

  const svc = {
    // ---------------------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------------------

    async getSettings(): Promise<PluginSettings> {
      return getStoreSettings();
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
    // Redirect CRUD
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
      // Conflict check first — reject early if from already exists
      const existing = await strapi.db.query(UID).findOne({
        where: { from: data.from },
      });

      if (existing) {
        throw new Error(`A redirect from '${data.from}' already exists.`);
      }

      // Chain detection — check after conflict so simple errors surface first
      const settings = await getStoreSettings();
      if (settings.chainDetectionEnabled) {
        await checkChainDepth(data.to, new Set([data.from]), 1);
      }

      const result = await strapi.db.query(UID).create({ data });
      invalidateCache();
      return result as Redirect;
    },

    async update(id: number, data: UpdateRedirectInput): Promise<Redirect> {
      // Conflict check for 'from' changes
      if (data.from !== undefined) {
        const conflict = await strapi.db.query(UID).findOne({
          where: { from: data.from },
        });
        if (conflict && (conflict as Redirect).id !== id) {
          throw new Error(`A redirect from '${data.from}' already exists.`);
        }
      }

      // Chain detection for 'to' changes
      if (data.to !== undefined) {
        const settings = await getStoreSettings();
        if (settings.chainDetectionEnabled) {
          let fromPath: string;
          if (data.from !== undefined) {
            fromPath = data.from;
          } else {
            const existingRecord = await strapi.db.query(UID).findOne({ where: { id } });
            fromPath = existingRecord ? (existingRecord as Redirect).from : '';
          }
          await checkChainDepth(data.to, new Set([fromPath]), 1);
        }
      }

      const result = await strapi.db.query(UID).update({
        where: { id },
        data,
      });
      invalidateCache();
      return result as Redirect;
    },

    async delete(id: number): Promise<void> {
      await strapi.db.query(UID).delete({ where: { id } });
      invalidateCache();
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
      invalidateCache();
      return result as Redirect;
    },

    // ---------------------------------------------------------------------------
    // Orphan redirects
    // ---------------------------------------------------------------------------

    async findAllOrphans(): Promise<OrphanRedirect[]> {
      const results = await strapi.db.query(ORPHAN_UID).findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
      return results as OrphanRedirect[];
    },

    async resolveOrphan(id: number, to: string): Promise<void> {
      const orphan = await strapi.db.query(ORPHAN_UID).findOne({ where: { id } });
      if (!orphan) throw new Error(`Orphan redirect with id ${id} not found.`);

      const orphanRecord = orphan as OrphanRedirect;

      // Create the actual redirect (runs through conflict + chain detection)
      await svc.create({ from: orphanRecord.from, to, type: 'permanent' });

      // Chain flattening: rewrite any redirect whose `to` points to the
      // orphan's old path so it goes directly to the new destination.
      const chainingRedirects = await strapi.db.query(UID).findMany({
        where: { to: orphanRecord.from, isActive: true },
      });
      for (const r of chainingRedirects) {
        const redirect = r as Redirect;
        await strapi.db.query(UID).update({
          where: { id: redirect.id },
          data: { to },
        });
      }
      if (chainingRedirects.length > 0) {
        invalidateCache();
      }

      // Mark orphan as resolved
      await strapi.db.query(ORPHAN_UID).update({
        where: { id },
        data: { status: 'resolved' },
      });
    },

    async dismissOrphan(id: number): Promise<void> {
      const orphan = await strapi.db.query(ORPHAN_UID).findOne({ where: { id } });
      if (!orphan) throw new Error(`Orphan redirect with id ${id} not found.`);

      await strapi.db.query(ORPHAN_UID).update({
        where: { id },
        data: { status: 'dismissed' },
      });
    },
  };

  return svc;
};

export default redirectService;
