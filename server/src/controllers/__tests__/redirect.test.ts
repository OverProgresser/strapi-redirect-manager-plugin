import redirectController from '../redirect';

// ---------------------------------------------------------------------------
// Mock setup — mirrors the exact API shape used by controllers/redirect.ts
//
// The controller does:
//   strapi.plugin('redirect-manager').service('redirect') → service
//   service.findAll(), service.findOne(), service.create(), etc.
//   ctx.badRequest(), ctx.notFound(), ctx.internalServerError()
// ---------------------------------------------------------------------------

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findActive: jest.fn(),
  findByFrom: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  toggleActive: jest.fn(),
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  getContentTypes: jest.fn(),
};

const mockStrapi = {
  plugin: jest.fn().mockReturnValue({
    service: jest.fn().mockReturnValue(mockService),
  }),
  contentTypes: {} as Record<string, unknown>,
} as unknown as Parameters<typeof redirectController>[0]['strapi'];

const controller = redirectController({ strapi: mockStrapi });

// ---------------------------------------------------------------------------
// Helper — creates a minimal Koa-like context
// ---------------------------------------------------------------------------

interface MockContext {
  params: Record<string, string>;
  request: { body: Record<string, unknown> };
  body: unknown;
  status: number;
  badRequest: jest.Mock;
  notFound: jest.Mock;
  internalServerError: jest.Mock;
}

function createMockCtx(overrides: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
} = {}): MockContext {
  return {
    params: overrides.params ?? {},
    request: { body: overrides.body ?? {} },
    body: undefined,
    status: 200,
    badRequest: jest.fn(),
    notFound: jest.fn(),
    internalServerError: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('redirectController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // find
  // -------------------------------------------------------------------------

  describe('find', () => {
    it('should call service.findAll and set ctx.body with data wrapper', async () => {
      const redirects = [
        { id: 1, from: '/a', to: '/b', type: '301', isActive: true },
      ];
      mockService.findAll.mockResolvedValue(redirects);
      const ctx = createMockCtx();

      await controller.find(ctx as unknown as Parameters<typeof controller.find>[0]);

      expect(mockService.findAll).toHaveBeenCalledTimes(1);
      expect(ctx.body).toEqual({ data: redirects });
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('should return redirect wrapped in data object', async () => {
      const redirect = { id: 5, from: '/a', to: '/b', type: '301', isActive: true };
      mockService.findOne.mockResolvedValue(redirect);
      const ctx = createMockCtx({ params: { id: '5' } });

      await controller.findOne(ctx as unknown as Parameters<typeof controller.findOne>[0]);

      expect(mockService.findOne).toHaveBeenCalledWith(5);
      expect(ctx.body).toEqual({ data: redirect });
    });

    it('should return badRequest for non-numeric id', async () => {
      const ctx = createMockCtx({ params: { id: 'abc' } });

      await controller.findOne(ctx as unknown as Parameters<typeof controller.findOne>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith('Invalid id parameter.');
      expect(mockService.findOne).not.toHaveBeenCalled();
    });

    it('should return notFound when redirect does not exist', async () => {
      mockService.findOne.mockResolvedValue(null);
      const ctx = createMockCtx({ params: { id: '999' } });

      await controller.findOne(ctx as unknown as Parameters<typeof controller.findOne>[0]);

      expect(ctx.notFound).toHaveBeenCalledWith('Redirect with id 999 not found.');
    });
  });

  // -------------------------------------------------------------------------
  // create — validation
  // -------------------------------------------------------------------------

  describe('create', () => {
    describe('validation', () => {
      it('should reject when from is missing', async () => {
        const ctx = createMockCtx({
          body: { to: '/destination', type: '301' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' is required and must be a non-empty string.",
        );
        expect(mockService.create).not.toHaveBeenCalled();
      });

      it('should reject when from is empty string', async () => {
        const ctx = createMockCtx({
          body: { from: '', to: '/destination' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' is required and must be a non-empty string.",
        );
      });

      it('should reject when from is whitespace only', async () => {
        const ctx = createMockCtx({
          body: { from: '   ', to: '/destination' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' is required and must be a non-empty string.",
        );
      });

      it('should reject when from does not start with /', async () => {
        const ctx = createMockCtx({
          body: { from: 'no-slash', to: '/destination' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' must start with '/'.",
        );
      });

      it('should reject protocol-relative from URL (starts with //)', async () => {
        const ctx = createMockCtx({
          body: { from: '//evil.com/path', to: '/destination' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' must not be a protocol-relative URL.",
        );
      });

      it('should reject when to is missing', async () => {
        const ctx = createMockCtx({
          body: { from: '/source' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'to' is required and must be a non-empty string.",
        );
      });

      it('should reject when to does not start with /', async () => {
        const ctx = createMockCtx({
          body: { from: '/source', to: 'http://external.com' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        // DECISION: validateSlugPath checks startsWith('//') first, then startsWith('/')
        // 'http://external.com' does not start with '//' and does not start with '/'
        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'to' must start with '/'.",
        );
      });

      it('should reject protocol-relative to URL (starts with //)', async () => {
        const ctx = createMockCtx({
          body: { from: '/source', to: '//evil.com/path' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'to' must not be a protocol-relative URL.",
        );
      });

      it('should reject invalid redirect type', async () => {
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b', type: '303' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'type' must be one of: 301, 302.",
        );
      });

      it('should reject non-string from (number)', async () => {
        const ctx = createMockCtx({
          body: { from: 123, to: '/destination' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' is required and must be a non-empty string.",
        );
      });
    });

    describe('success', () => {
      it('should create redirect with default type 301 when type is not provided', async () => {
        const created = {
          id: 1,
          from: '/old',
          to: '/new',
          type: '301',
          isActive: true,
        };
        mockService.create.mockResolvedValue(created);
        const ctx = createMockCtx({
          body: { from: '/old', to: '/new' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith({
          from: '/old',
          to: '/new',
          type: '301',
          isActive: true,
          comment: undefined,
        });
        expect(ctx.status).toBe(201);
        expect(ctx.body).toEqual({ data: created });
      });

      it('should create redirect with explicit type 302', async () => {
        mockService.create.mockResolvedValue({
          id: 2,
          from: '/temp-old',
          to: '/temp-new',
          type: '302',
          isActive: true,
        });
        const ctx = createMockCtx({
          body: { from: '/temp-old', to: '/temp-new', type: '302' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ type: '302' }),
        );
      });

      it('should pass isActive: false when explicitly provided', async () => {
        mockService.create.mockResolvedValue({
          id: 3,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: false,
        });
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b', isActive: false },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: false }),
        );
      });

      it('should default isActive to true when not provided', async () => {
        mockService.create.mockResolvedValue({
          id: 4,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: true,
        });
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: true }),
        );
      });

      it('should pass comment when it is a string', async () => {
        mockService.create.mockResolvedValue({
          id: 5,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: true,
          comment: 'migration note',
        });
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b', comment: 'migration note' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ comment: 'migration note' }),
        );
      });

      it('should set comment to undefined when non-string comment is provided', async () => {
        // The controller only passes comment if typeof === 'string'
        mockService.create.mockResolvedValue({
          id: 6,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: true,
        });
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b', comment: 12345 },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ comment: undefined }),
        );
      });
    });

    describe('error handling', () => {
      it('should return badRequest when service.create throws (conflict)', async () => {
        mockService.create.mockRejectedValue(
          new Error("A redirect from '/old' already exists."),
        );
        const ctx = createMockCtx({
          body: { from: '/old', to: '/new' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "A redirect from '/old' already exists.",
        );
      });

      it('should use generic message for non-Error exceptions', async () => {
        mockService.create.mockRejectedValue('random string error');
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith('Failed to create redirect.');
      });

      it('should NOT expose error.stack in response', async () => {
        const error = new Error('internal failure');
        error.stack = 'Error: internal failure\n    at /app/server/src/services/redirect.ts:42';
        mockService.create.mockRejectedValue(error);
        const ctx = createMockCtx({
          body: { from: '/a', to: '/b' },
        });

        await controller.create(ctx as unknown as Parameters<typeof controller.create>[0]);

        // The message should be the error.message, not the stack
        expect(ctx.badRequest).toHaveBeenCalledWith('internal failure');
        // Verify stack is not in the response
        const callArg = ctx.badRequest.mock.calls[0][0] as string;
        expect(callArg).not.toContain('/app/server');
        expect(callArg).not.toContain('.ts:');
      });
    });
  });

  // -------------------------------------------------------------------------
  // update — validation
  // -------------------------------------------------------------------------

  describe('update', () => {
    describe('validation', () => {
      it('should reject non-numeric id', async () => {
        const ctx = createMockCtx({ params: { id: 'abc' } });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith('Invalid id parameter.');
        expect(mockService.update).not.toHaveBeenCalled();
      });

      it('should reject when from does not start with /', async () => {
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { from: 'no-slash' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith("'from' must start with '/'.");
      });

      it('should reject protocol-relative from URL on update', async () => {
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { from: '//evil.com' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'from' must not be a protocol-relative URL.",
        );
      });

      it('should reject when to does not start with / on update', async () => {
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { to: 'no-slash' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith("'to' must start with '/'.");
      });

      it('should reject invalid type on update', async () => {
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { type: '307' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "'type' must be one of: 301, 302.",
        );
      });

      it('should reject non-string comment on update', async () => {
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { comment: 42 },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith('comment must be a string');
        expect(mockService.update).not.toHaveBeenCalled();
      });
    });

    describe('success', () => {
      it('should pass only provided fields to service.update', async () => {
        const updated = {
          id: 1,
          from: '/old',
          to: '/updated-dest',
          type: '301',
          isActive: true,
        };
        mockService.update.mockResolvedValue(updated);
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { to: '/updated-dest' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(mockService.update).toHaveBeenCalledWith(1, {
          to: '/updated-dest',
        });
        expect(ctx.body).toEqual({ data: updated });
      });

      it('should convert isActive to boolean', async () => {
        mockService.update.mockResolvedValue({
          id: 1,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: false,
        });
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { isActive: 0 },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(mockService.update).toHaveBeenCalledWith(1, {
          isActive: false,
        });
      });

      it('should accept valid comment string on update', async () => {
        mockService.update.mockResolvedValue({
          id: 1,
          from: '/a',
          to: '/b',
          type: '301',
          isActive: true,
          comment: 'updated note',
        });
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { comment: 'updated note' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(mockService.update).toHaveBeenCalledWith(1, {
          comment: 'updated note',
        });
      });

      it('should update multiple fields at once', async () => {
        mockService.update.mockResolvedValue({
          id: 1,
          from: '/new-from',
          to: '/new-to',
          type: '302',
          isActive: false,
          comment: 'full update',
        });
        const ctx = createMockCtx({
          params: { id: '1' },
          body: {
            from: '/new-from',
            to: '/new-to',
            type: '302',
            isActive: false,
            comment: 'full update',
          },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(mockService.update).toHaveBeenCalledWith(1, {
          from: '/new-from',
          to: '/new-to',
          type: '302',
          isActive: false,
          comment: 'full update',
        });
      });
    });

    describe('error handling', () => {
      it('should return notFound when error message includes "not found"', async () => {
        mockService.update.mockRejectedValue(
          new Error('Redirect with id 999 not found.'),
        );
        const ctx = createMockCtx({
          params: { id: '999' },
          body: { to: '/new' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.notFound).toHaveBeenCalledWith(
          'Redirect with id 999 not found.',
        );
      });

      it('should return badRequest for conflict errors', async () => {
        mockService.update.mockRejectedValue(
          new Error("A redirect from '/taken' already exists."),
        );
        const ctx = createMockCtx({
          params: { id: '1' },
          body: { from: '/taken' },
        });

        await controller.update(ctx as unknown as Parameters<typeof controller.update>[0]);

        expect(ctx.badRequest).toHaveBeenCalledWith(
          "A redirect from '/taken' already exists.",
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('should reject non-numeric id', async () => {
      const ctx = createMockCtx({ params: { id: 'xyz' } });

      await controller.delete(ctx as unknown as Parameters<typeof controller.delete>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith('Invalid id parameter.');
    });

    it('should return notFound when redirect does not exist', async () => {
      mockService.findOne.mockResolvedValue(null);
      const ctx = createMockCtx({ params: { id: '999' } });

      await controller.delete(ctx as unknown as Parameters<typeof controller.delete>[0]);

      expect(mockService.findOne).toHaveBeenCalledWith(999);
      expect(ctx.notFound).toHaveBeenCalledWith(
        'Redirect with id 999 not found.',
      );
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('should call service.delete with correct id and return 204', async () => {
      mockService.findOne.mockResolvedValue({
        id: 5,
        from: '/a',
        to: '/b',
        type: '301',
        isActive: true,
      });
      mockService.delete.mockResolvedValue(undefined);
      const ctx = createMockCtx({ params: { id: '5' } });

      await controller.delete(ctx as unknown as Parameters<typeof controller.delete>[0]);

      expect(mockService.delete).toHaveBeenCalledWith(5);
      expect(ctx.status).toBe(204);
      expect(ctx.body).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // toggleActive
  // -------------------------------------------------------------------------

  describe('toggleActive', () => {
    it('should reject non-numeric id', async () => {
      const ctx = createMockCtx({ params: { id: 'bad' } });

      await controller.toggleActive(ctx as unknown as Parameters<typeof controller.toggleActive>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith('Invalid id parameter.');
    });

    it('should call service.toggleActive and return result', async () => {
      const toggled = {
        id: 3,
        from: '/a',
        to: '/b',
        type: '301',
        isActive: false,
      };
      mockService.toggleActive.mockResolvedValue(toggled);
      const ctx = createMockCtx({ params: { id: '3' } });

      await controller.toggleActive(ctx as unknown as Parameters<typeof controller.toggleActive>[0]);

      expect(mockService.toggleActive).toHaveBeenCalledWith(3);
      expect(ctx.body).toEqual({ data: toggled });
    });

    it('should return notFound when error message includes "not found"', async () => {
      mockService.toggleActive.mockRejectedValue(
        new Error('Redirect with id 999 not found.'),
      );
      const ctx = createMockCtx({ params: { id: '999' } });

      await controller.toggleActive(ctx as unknown as Parameters<typeof controller.toggleActive>[0]);

      expect(ctx.notFound).toHaveBeenCalledWith(
        'Redirect with id 999 not found.',
      );
    });

    it('should return internalServerError for unexpected errors', async () => {
      mockService.toggleActive.mockRejectedValue(
        new Error('Database connection lost'),
      );
      const ctx = createMockCtx({ params: { id: '1' } });

      await controller.toggleActive(ctx as unknown as Parameters<typeof controller.toggleActive>[0]);

      expect(ctx.internalServerError).toHaveBeenCalledWith(
        'Database connection lost',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getSettings
  // -------------------------------------------------------------------------

  describe('getSettings', () => {
    it('should call service.getSettings and set ctx.body', async () => {
      const settings = {
        enabledContentTypes: {},
        autoRedirectOnSlugChange: true,
        showChainWarning: true,
        showOrphanNotification: true,
      };
      mockService.getSettings.mockResolvedValue(settings);
      const ctx = createMockCtx();

      await controller.getSettings(ctx as unknown as Parameters<typeof controller.getSettings>[0]);

      expect(mockService.getSettings).toHaveBeenCalledTimes(1);
      expect(ctx.body).toEqual(settings);
    });
  });

  // -------------------------------------------------------------------------
  // saveSettings — validation
  // -------------------------------------------------------------------------

  describe('saveSettings', () => {
    it('should reject content type UID that does not start with api::', async () => {
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'plugin::bad.type': { enabled: true, slugField: 'slug' },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "Invalid content type UID 'plugin::bad.type': must start with 'api::'.",
      );
    });

    it('should reject content type UID that does not exist in strapi.contentTypes', async () => {
      // mockStrapi.contentTypes is empty by default
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::nonexistent.nonexistent': { enabled: true, slugField: 'slug' },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "Content type 'api::nonexistent.nonexistent' does not exist.",
      );
    });

    it('should reject non-string slugField', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: { slug: { type: 'uid' } },
        },
      };
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: 123 },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "'slugField' for 'api::page.page' must be a string.",
      );
    });

    it('should reject slugField that is not a string/uid attribute', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: {
            content: { type: 'richtext' },
            slug: { type: 'uid' },
          },
        },
      };
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: 'content' },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "'content' is not a valid string/uid attribute of 'api::page.page'.",
      );
    });

    it('should reject urlPrefix with protocol', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: { slug: { type: 'uid' } },
        },
      };
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': {
              enabled: true,
              slugField: 'slug',
              urlPrefix: 'http://example.com/blog',
            },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "'urlPrefix' for 'api::page.page' must not include the protocol (http:// or https://).",
      );
    });

    it('should reject urlPrefix that does not start with /', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: { slug: { type: 'uid' } },
        },
      };
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': {
              enabled: true,
              slugField: 'slug',
              urlPrefix: 'blog',
            },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        "'urlPrefix' for 'api::page.page' must start with '/'.",
      );
    });

    it('should save valid settings with default boolean values', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: { slug: { type: 'uid' } },
        },
      };
      const savedSettings = {
        enabledContentTypes: {
          'api::page.page': { enabled: true, slugField: 'slug' },
        },
        autoRedirectOnSlugChange: true,
        showChainWarning: true,
        showOrphanNotification: true,
      };
      mockService.saveSettings.mockResolvedValue(savedSettings);
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: 'slug' },
          },
          // booleans not provided — should default to true (via !== false check)
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(mockService.saveSettings).toHaveBeenCalledWith({
        enabledContentTypes: {
          'api::page.page': { enabled: true, slugField: 'slug' },
        },
        autoRedirectOnSlugChange: true,
        showChainWarning: true,
        showOrphanNotification: true,
      });
      expect(ctx.body).toEqual(savedSettings);
    });

    it('should pass false for boolean settings when explicitly set to false', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {};
      mockService.saveSettings.mockResolvedValue({
        enabledContentTypes: {},
        autoRedirectOnSlugChange: false,
        showChainWarning: false,
        showOrphanNotification: false,
      });
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {},
          autoRedirectOnSlugChange: false,
          showChainWarning: false,
          showOrphanNotification: false,
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(mockService.saveSettings).toHaveBeenCalledWith({
        enabledContentTypes: {},
        autoRedirectOnSlugChange: false,
        showChainWarning: false,
        showOrphanNotification: false,
      });
    });

    it('should accept null slugField without error', async () => {
      (mockStrapi as unknown as { contentTypes: Record<string, unknown> }).contentTypes = {
        'api::page.page': {
          uid: 'api::page.page',
          attributes: { slug: { type: 'uid' } },
        },
      };
      mockService.saveSettings.mockResolvedValue({});
      const ctx = createMockCtx({
        body: {
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: null },
          },
        },
      });

      await controller.saveSettings(ctx as unknown as Parameters<typeof controller.saveSettings>[0]);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(mockService.saveSettings).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getContentTypes
  // -------------------------------------------------------------------------

  describe('getContentTypes', () => {
    it('should call service.getContentTypes and set ctx.body', async () => {
      const contentTypes = [
        { uid: 'api::page.page', displayName: 'Page', attributes: ['slug'] },
      ];
      mockService.getContentTypes.mockResolvedValue(contentTypes);
      const ctx = createMockCtx();

      await controller.getContentTypes(ctx as unknown as Parameters<typeof controller.getContentTypes>[0]);

      expect(mockService.getContentTypes).toHaveBeenCalledTimes(1);
      expect(ctx.body).toEqual(contentTypes);
    });
  });
});
