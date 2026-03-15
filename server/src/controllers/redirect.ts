import type { Core } from '@strapi/strapi';
import type { PluginSettings } from '../services/redirect';

type KoaContext = Parameters<Core.Controller[string]>[0];

const VALID_TYPES = ['301', '302'] as const;

function validateSlugPath(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `'${fieldName}' is required and must be a non-empty string.`;
  }
  if (value.startsWith('//')) {
    return `'${fieldName}' must not be a protocol-relative URL.`;
  }
  if (!value.startsWith('/')) {
    return `'${fieldName}' must start with '/'.`;
  }
  return null;
}

const redirectController = ({ strapi }: { strapi: Core.Strapi }) => {
  const service = () => strapi.plugin('redirect-manager').service('redirect');

  return {
    async find(ctx: KoaContext) {
      const redirects = await service().findAll();
      ctx.body = { data: redirects };
    },

    async findOne(ctx: KoaContext) {
      const id = Number(ctx.params['id']);
      if (Number.isNaN(id)) {
        return ctx.badRequest('Invalid id parameter.');
      }

      const redirect = await service().findOne(id);
      if (!redirect) {
        return ctx.notFound(`Redirect with id ${id} not found.`);
      }

      ctx.body = { data: redirect };
    },

    async create(ctx: KoaContext) {
      const body = ctx.request.body as Record<string, unknown>;

      const fromError = validateSlugPath(body['from'], 'from');
      if (fromError) return ctx.badRequest(fromError);

      const toError = validateSlugPath(body['to'], 'to');
      if (toError) return ctx.badRequest(toError);

      const type = body['type'] ?? '301';
      if (!VALID_TYPES.includes(type as '301' | '302')) {
        return ctx.badRequest(`'type' must be one of: ${VALID_TYPES.join(', ')}.`);
      }

      try {
        const redirect = await service().create({
          from: body['from'] as string,
          to: body['to'] as string,
          type: type as '301' | '302',
          isActive: body['isActive'] !== undefined ? Boolean(body['isActive']) : true,
          comment: typeof body['comment'] === 'string' ? body['comment'] : undefined,
        });
        ctx.status = 201;
        ctx.body = { data: redirect };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create redirect.';
        return ctx.badRequest(message);
      }
    },

    async update(ctx: KoaContext) {
      const id = Number(ctx.params['id']);
      if (Number.isNaN(id)) {
        return ctx.badRequest('Invalid id parameter.');
      }

      const body = ctx.request.body as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};

      if (body['from'] !== undefined) {
        const fromError = validateSlugPath(body['from'], 'from');
        if (fromError) return ctx.badRequest(fromError);
        updateData['from'] = body['from'];
      }

      if (body['to'] !== undefined) {
        const toError = validateSlugPath(body['to'], 'to');
        if (toError) return ctx.badRequest(toError);
        updateData['to'] = body['to'];
      }

      if (body['type'] !== undefined) {
        if (!VALID_TYPES.includes(body['type'] as '301' | '302')) {
          return ctx.badRequest(`'type' must be one of: ${VALID_TYPES.join(', ')}.`);
        }
        updateData['type'] = body['type'];
      }

      if (body['isActive'] !== undefined) {
        updateData['isActive'] = Boolean(body['isActive']);
      }

      if (body['comment'] !== undefined) {
        if (typeof body['comment'] !== 'string') {
          return ctx.badRequest('comment must be a string');
        }
        updateData['comment'] = body['comment'];
      }

      try {
        const redirect = await service().update(id, updateData);
        ctx.body = { data: redirect };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update redirect.';
        if (message.includes('not found')) {
          return ctx.notFound(message);
        }
        return ctx.badRequest(message);
      }
    },

    async delete(ctx: KoaContext) {
      const id = Number(ctx.params['id']);
      if (Number.isNaN(id)) {
        return ctx.badRequest('Invalid id parameter.');
      }

      const existing = await service().findOne(id);
      if (!existing) {
        return ctx.notFound(`Redirect with id ${id} not found.`);
      }

      await service().delete(id);
      ctx.status = 204;
      ctx.body = null;
    },

    async toggleActive(ctx: KoaContext) {
      const id = Number(ctx.params['id']);
      if (Number.isNaN(id)) {
        return ctx.badRequest('Invalid id parameter.');
      }

      try {
        const redirect = await service().toggleActive(id);
        ctx.body = { data: redirect };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle redirect.';
        if (message.includes('not found')) {
          return ctx.notFound(message);
        }
        return ctx.internalServerError(message);
      }
    },

    // ---------------------------------------------------------------------------
    // Settings handlers (preserved from existing controller)
    // ---------------------------------------------------------------------------

    async getSettings(ctx: KoaContext) {
      ctx.body = await service().getSettings();
    },

    async saveSettings(ctx: KoaContext) {
      const body = ctx.request.body as Record<string, unknown>;
      const {
        enabledContentTypes,
        autoRedirectOnSlugChange,
        showChainWarning,
        showOrphanNotification,
      } = body;

      // Validate enabledContentTypes entries
      const rawEct = (enabledContentTypes ?? {}) as Record<string, unknown>;
      for (const [uid, ctSettings] of Object.entries(rawEct)) {
        if (!uid.startsWith('api::')) {
          return ctx.badRequest(`Invalid content type UID '${uid}': must start with 'api::'.`);
        }
        const ct = strapi.contentTypes[uid];
        if (!ct) {
          return ctx.badRequest(`Content type '${uid}' does not exist.`);
        }
        const settings = ctSettings as Record<string, unknown>;
        const slugField = settings['slugField'];
        if (slugField !== null && slugField !== undefined && slugField !== '') {
          if (typeof slugField !== 'string') {
            return ctx.badRequest(`'slugField' for '${uid}' must be a string.`);
          }
          const attr = (ct.attributes as Record<string, { type?: string }>)[slugField];
          if (!attr || (attr.type !== 'string' && attr.type !== 'uid')) {
            return ctx.badRequest(
              `'${slugField}' is not a valid string/uid attribute of '${uid}'.`,
            );
          }
        }
        const urlPrefix = settings['urlPrefix'];
        if (urlPrefix !== undefined && urlPrefix !== null && urlPrefix !== '') {
          if (typeof urlPrefix !== 'string') {
            return ctx.badRequest(`'urlPrefix' for '${uid}' must be a string.`);
          }
          if (urlPrefix.startsWith('http://') || urlPrefix.startsWith('https://')) {
            return ctx.badRequest(
              `'urlPrefix' for '${uid}' must not include the protocol (http:// or https://).`,
            );
          }
          if (!urlPrefix.startsWith('/')) {
            return ctx.badRequest(`'urlPrefix' for '${uid}' must start with '/'.`);
          }
        }
      }

      const saveData: PluginSettings = {
        enabledContentTypes: rawEct as PluginSettings['enabledContentTypes'],
        autoRedirectOnSlugChange: autoRedirectOnSlugChange !== false,
        showChainWarning: showChainWarning !== false,
        showOrphanNotification: showOrphanNotification !== false,
      };
      ctx.body = await service().saveSettings(saveData);
    },

    async getContentTypes(ctx: KoaContext) {
      ctx.body = await service().getContentTypes();
    },
  };
};

export default redirectController;
