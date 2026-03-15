import type { Core } from '@strapi/strapi';

type LifecycleEvent = {
  model: { uid: string; options?: { draftAndPublish?: boolean } };
  params: { where?: { id?: number }; data?: Record<string, unknown> };
  state: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const ORPHAN_UID = 'plugin::redirect-manager.orphan-redirect' as const;

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('[redirect-manager] Bootstrapped.');

  const redirectService = strapi.plugin('redirect-manager').service('redirect');

  strapi.db.lifecycles.subscribe({
    async beforeUpdate(event: LifecycleEvent) {
      const uid = event.model.uid;
      if (!uid.startsWith('api::')) return;

      const settings = await redirectService.getSettings();
      if (!settings.autoRedirectOnSlugChange) return;

      const config = settings.enabledContentTypes[uid];
      if (!config?.enabled || !config.slugField) return;

      const id = event.params.where?.id;
      if (!id) return;

      const existing = await strapi.db.query(uid as Parameters<typeof strapi.db.query>[0]).findOne({
        where: { id },
        select: [config.slugField],
      });

      event.state = {
        oldSlug: (existing as Record<string, unknown> | null)?.[config.slugField] ?? null,
      };
    },

    async afterUpdate(event: LifecycleEvent) {
      const uid = event.model.uid;
      if (!uid.startsWith('api::')) return;

      const oldSlug = event.state?.oldSlug;
      if (typeof oldSlug !== 'string' || !oldSlug) return;

      const settings = await redirectService.getSettings();
      if (!settings.autoRedirectOnSlugChange) return;

      const config = settings.enabledContentTypes[uid];
      if (!config?.enabled || !config.slugField) return;

      // draftAndPublish guard — skip if model supports drafts and entry is not yet published
      const isDraft =
        event.model.options?.draftAndPublish === true &&
        !event.result?.['publishedAt'];
      if (isDraft) return;

      const newSlug = event.result?.[config.slugField];
      if (typeof newSlug !== 'string' || !newSlug || oldSlug === newSlug) return;

      const urlPrefix = config.urlPrefix ?? '';
      const from = `${urlPrefix}/${oldSlug}`.replace('//', '/');
      const to = `${urlPrefix}/${newSlug}`.replace('//', '/');

      // Cycle prevention: remove any reverse redirect that would create a loop
      await strapi.db.query('plugin::redirect-manager.redirect').deleteMany({
        where: { from: to, to: from },
      });

      try {
        await redirectService.create({ from, to, type: '301' });
      } catch (err) {
        // If a redirect from this path already exists, skip silently (race condition)
        strapi.log.warn(
          `[redirect-manager] Could not create auto-redirect from '${from}' to '${to}': ${(err as Error).message}`,
        );
      }
    },

    async afterDelete(event: LifecycleEvent) {
      const uid = event.model.uid;
      if (!uid.startsWith('api::')) return;

      const settings = await redirectService.getSettings();
      if (!settings.orphanRedirectEnabled) return;

      const config = settings.enabledContentTypes[uid];
      if (!config?.enabled || !config.slugField) return;

      const slug = event.result?.[config.slugField];
      if (typeof slug !== 'string' || !slug) return;

      const urlPrefix = config.urlPrefix ?? '';
      const from = `${urlPrefix}/${slug}`.replace('//', '/');

      try {
        await strapi.db.query(ORPHAN_UID).create({
          data: {
            contentType: uid,
            slug,
            from,
            status: 'pending',
          },
        });
      } catch (err) {
        strapi.log.warn(
          `[redirect-manager] Could not create orphan redirect for '${from}': ${(err as Error).message}`,
        );
      }
    },
  });
};

export default bootstrap;
