import type { Core } from '@strapi/strapi';

type KoaContext = Parameters<Core.Controller[string]>[0];

const VALID_TYPES = ['301', '302'] as const;

function validateSlugPath(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `'${fieldName}' is required and must be a non-empty string.`;
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
      const { enabledContentTypes } = body;
      ctx.body = await service().saveSettings({ enabledContentTypes } as Parameters<ReturnType<typeof service>['saveSettings']>[0]);
    },

    async getContentTypes(ctx: KoaContext) {
      ctx.body = await service().getContentTypes();
    },
  };
};

export default redirectController;
