import bootstrap from '../bootstrap';

// ---------------------------------------------------------------------------
// Mock setup — mirrors the exact API shape used by bootstrap.ts
//
// bootstrap.ts does:
//   strapi.plugin('redirect-manager').service('redirect') → redirectService
//   strapi.db.lifecycles.subscribe({ beforeUpdate, afterUpdate })
//   strapi.db.query(uid).findOne(...)       — for fetching old slug
//   strapi.db.query(UID).deleteMany(...)    — for cycle prevention
//   redirectService.getSettings()
//   redirectService.create(...)
// ---------------------------------------------------------------------------

type LifecycleEvent = {
  model: { uid: string; options?: { draftAndPublish?: boolean } };
  params: { where?: { id?: number }; data?: Record<string, unknown> };
  state: Record<string, unknown>;
  result?: Record<string, unknown>;
};

type LifecycleSubscriber = {
  beforeUpdate: (event: LifecycleEvent) => Promise<void>;
  afterUpdate: (event: LifecycleEvent) => Promise<void>;
  afterDelete: (event: LifecycleEvent) => Promise<void>;
};

const mockRedirectQuery = {
  findOne: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
};

const mockContentQuery = {
  findOne: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
};

const mockOrphanQuery = {
  findOne: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockRedirectService = {
  getSettings: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findActive: jest.fn(),
  findByFrom: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  toggleActive: jest.fn(),
  getContentTypes: jest.fn(),
  saveSettings: jest.fn(),
  findAllOrphans: jest.fn(),
  resolveOrphan: jest.fn(),
  dismissOrphan: jest.fn(),
};

let subscribedHandler: LifecycleSubscriber;

const mockStrapi = {
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  db: {
    query: jest.fn((uid: string) => {
      if (uid === 'plugin::redirect-manager.redirect') {
        return mockRedirectQuery;
      }
      if (uid === 'plugin::redirect-manager.orphan-redirect') {
        return mockOrphanQuery;
      }
      // For content-type queries (api::page.page etc.)
      return mockContentQuery;
    }),
    lifecycles: {
      subscribe: jest.fn((handler: LifecycleSubscriber) => {
        subscribedHandler = handler;
      }),
    },
  },
  plugin: jest.fn().mockReturnValue({
    service: jest.fn().mockReturnValue(mockRedirectService),
  }),
} as unknown as Parameters<typeof bootstrap>[0]['strapi'];

// ---------------------------------------------------------------------------
// Helper — default settings for enabled content type
// ---------------------------------------------------------------------------

function makeSettings(overrides: {
  autoRedirectOnSlugChange?: boolean;
  orphanRedirectEnabled?: boolean;
  enabledContentTypes?: Record<string, { enabled: boolean; slugField: string | null; urlPrefix?: string }>;
} = {}) {
  return {
    autoRedirectOnSlugChange: overrides.autoRedirectOnSlugChange ?? true,
    chainDetectionEnabled: true,
    orphanRedirectEnabled: overrides.orphanRedirectEnabled ?? true,
    enabledContentTypes: overrides.enabledContentTypes ?? {
      'api::page.page': { enabled: true, slugField: 'slug' },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log bootstrap message', async () => {
    await bootstrap({ strapi: mockStrapi });

    expect(mockStrapi.log.info).toHaveBeenCalledWith(
      '[redirect-manager] Bootstrapped.',
    );
  });

  it('should subscribe to db lifecycles', async () => {
    await bootstrap({ strapi: mockStrapi });

    expect(mockStrapi.db.lifecycles.subscribe).toHaveBeenCalledTimes(1);
    expect(subscribedHandler).toBeDefined();
    expect(typeof subscribedHandler.beforeUpdate).toBe('function');
    expect(typeof subscribedHandler.afterUpdate).toBe('function');
  });

  // -------------------------------------------------------------------------
  // beforeUpdate lifecycle
  // -------------------------------------------------------------------------

  describe('beforeUpdate lifecycle', () => {
    beforeEach(async () => {
      await bootstrap({ strapi: mockStrapi });
      jest.clearAllMocks();
    });

    it('should return early for non-api:: UIDs without fetching settings', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'plugin::users-permissions.user' },
        params: { where: { id: 1 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockRedirectService.getSettings).not.toHaveBeenCalled();
      // state should remain empty — no oldSlug set
      expect(event.state).toEqual({});
    });

    it('should return early when autoRedirectOnSlugChange is false', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({ autoRedirectOnSlugChange: false }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockRedirectService.getSettings).toHaveBeenCalledTimes(1);
      // No DB query should be made
      expect(mockContentQuery.findOne).not.toHaveBeenCalled();
    });

    it('should return early when content type is not in enabledContentTypes', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::article.article': { enabled: true, slugField: 'slug' },
          },
        }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockContentQuery.findOne).not.toHaveBeenCalled();
    });

    it('should return early when content type is disabled', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': { enabled: false, slugField: 'slug' },
          },
        }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockContentQuery.findOne).not.toHaveBeenCalled();
    });

    it('should return early when slugField is null', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: null },
          },
        }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockContentQuery.findOne).not.toHaveBeenCalled();
    });

    it('should return early when event.params.where.id is missing', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(mockContentQuery.findOne).not.toHaveBeenCalled();
    });

    it('should store oldSlug in event.state when all conditions met', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockContentQuery.findOne.mockResolvedValue({ slug: 'current-slug' });

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 10 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      // Should query the content type (not the redirect type)
      expect(mockStrapi.db.query).toHaveBeenCalledWith('api::page.page');
      expect(mockContentQuery.findOne).toHaveBeenCalledWith({
        where: { id: 10 },
        select: ['slug'],
      });
      expect(event.state).toEqual({ oldSlug: 'current-slug' });
    });

    it('should store null as oldSlug when existing record has no slug value', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockContentQuery.findOne.mockResolvedValue({ title: 'No slug field' });

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 5 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      // slug field is undefined on the result, so ?? null kicks in
      expect(event.state).toEqual({ oldSlug: null });
    });

    it('should store null as oldSlug when findOne returns null (record not found)', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockContentQuery.findOne.mockResolvedValue(null);

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 999 }, data: {} },
        state: {},
      };

      await subscribedHandler.beforeUpdate(event);

      expect(event.state).toEqual({ oldSlug: null });
    });
  });

  // -------------------------------------------------------------------------
  // afterUpdate lifecycle
  // -------------------------------------------------------------------------

  describe('afterUpdate lifecycle', () => {
    beforeEach(async () => {
      await bootstrap({ strapi: mockStrapi });
      jest.clearAllMocks();
    });

    it('should return early for non-api:: UIDs', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'admin::user' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old' },
        result: { slug: 'new' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.getSettings).not.toHaveBeenCalled();
    });

    it('should return early when event.state is undefined', async () => {
      const event = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: undefined as unknown as Record<string, unknown>,
        result: { slug: 'new' },
      };

      await subscribedHandler.afterUpdate(event as LifecycleEvent);

      // The ?. operator on event.state?.oldSlug prevents crash
      expect(mockRedirectService.getSettings).not.toHaveBeenCalled();
      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should return early when oldSlug is not set in state', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: {},
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.getSettings).not.toHaveBeenCalled();
      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should return early when oldSlug is null', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: null },
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      // typeof null !== 'string', so early return
      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should return early when oldSlug is empty string', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: '' },
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      // typeof '' is 'string' but !'' is true, so early return
      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should return early when autoRedirectOnSlugChange is false', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({ autoRedirectOnSlugChange: false }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should return early when content type is not enabled', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {},
        }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should NOT create redirect for draft content (draftAndPublish guard)', async () => {
      // BUSINESS CRITICAL: draft entries must NOT generate redirects
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: {
          uid: 'api::page.page',
          options: { draftAndPublish: true },
        },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: {
          slug: 'new-slug',
          publishedAt: null, // draft — not yet published
        },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
      expect(mockRedirectQuery.deleteMany).not.toHaveBeenCalled();
    });

    it('should NOT create redirect when slug has not changed', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'same-slug' },
        result: { slug: 'same-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
      expect(mockRedirectQuery.deleteMany).not.toHaveBeenCalled();
    });

    it('should NOT create redirect when newSlug is not a string', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: undefined },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should NOT create redirect when newSlug is empty string', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: '' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).not.toHaveBeenCalled();
    });

    it('should delete reverse redirect and create new redirect when slug changes (published)', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockResolvedValue({
        id: 1,
        from: '/old-slug',
        to: '/new-slug',
        type: '301',
      });

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: 'new-slug' },
      };

      await subscribedHandler.afterUpdate(event);

      // Cycle prevention: delete reverse redirect
      expect(mockRedirectQuery.deleteMany).toHaveBeenCalledWith({
        where: { from: '/new-slug', to: '/old-slug' },
      });
      // Create new redirect
      expect(mockRedirectService.create).toHaveBeenCalledWith({
        from: '/old-slug',
        to: '/new-slug',
        type: '301',
      });
    });

    it('should create redirect for published content (draftAndPublish: true, publishedAt set)', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockResolvedValue({});

      const event: LifecycleEvent = {
        model: {
          uid: 'api::page.page',
          options: { draftAndPublish: true },
        },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old' },
        result: {
          slug: 'new',
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).toHaveBeenCalledWith({
        from: '/old',
        to: '/new',
        type: '301',
      });
    });

    it('should create redirect for content without draftAndPublish option', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockResolvedValue({});

      const event: LifecycleEvent = {
        model: {
          uid: 'api::page.page',
          // no options.draftAndPublish — means no draft system
        },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old' },
        result: { slug: 'new' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectService.create).toHaveBeenCalledWith({
        from: '/old',
        to: '/new',
        type: '301',
      });
    });

    it('should apply urlPrefix to from and to paths', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': {
              enabled: true,
              slugField: 'slug',
              urlPrefix: '/blog',
            },
          },
        }),
      );
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockResolvedValue({});

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-post' },
        result: { slug: 'new-post' },
      };

      await subscribedHandler.afterUpdate(event);

      expect(mockRedirectQuery.deleteMany).toHaveBeenCalledWith({
        where: { from: '/blog/new-post', to: '/blog/old-post' },
      });
      expect(mockRedirectService.create).toHaveBeenCalledWith({
        from: '/blog/old-post',
        to: '/blog/new-post',
        type: '301',
      });
    });

    it('should normalize double slashes when urlPrefix is empty string', async () => {
      // urlPrefix '' + '/' + 'slug' = '/slug' (replace '//' → '/')
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': {
              enabled: true,
              slugField: 'slug',
              urlPrefix: '',
            },
          },
        }),
      );
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockResolvedValue({});

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old' },
        result: { slug: 'new' },
      };

      await subscribedHandler.afterUpdate(event);

      // DECISION: Implementation uses `'${urlPrefix}/${slug}'.replace('//', '/')`
      // Empty urlPrefix '' + '/' + 'old' = '/old' — the replace is a no-op here
      expect(mockRedirectService.create).toHaveBeenCalledWith({
        from: '/old',
        to: '/new',
        type: '301',
      });
    });

    it('should log warning and NOT throw when create fails (race condition)', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockRedirectQuery.deleteMany.mockResolvedValue({ count: 0 });
      mockRedirectService.create.mockRejectedValue(
        new Error("A redirect from '/old-slug' already exists."),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: { where: { id: 1 }, data: {} },
        state: { oldSlug: 'old-slug' },
        result: { slug: 'new-slug' },
      };

      // Should NOT throw — error is caught and logged
      await expect(
        subscribedHandler.afterUpdate(event),
      ).resolves.toBeUndefined();

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('[redirect-manager] Could not create auto-redirect'),
      );
      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("A redirect from '/old-slug' already exists."),
      );
    });
  });

  // -------------------------------------------------------------------------
  // afterDelete lifecycle
  // -------------------------------------------------------------------------

  describe('afterDelete lifecycle', () => {
    beforeEach(async () => {
      await bootstrap({ strapi: mockStrapi });
      jest.clearAllMocks();
    });

    it('should return early for non-api:: UIDs', async () => {
      const event: LifecycleEvent = {
        model: { uid: 'plugin::users-permissions.user' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockRedirectService.getSettings).not.toHaveBeenCalled();
      expect(mockOrphanQuery.create).not.toHaveBeenCalled();
    });

    it('should return early when orphanRedirectEnabled is false', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({ orphanRedirectEnabled: false }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockOrphanQuery.create).not.toHaveBeenCalled();
    });

    it('should return early when content type is not enabled', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({ enabledContentTypes: {} }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockOrphanQuery.create).not.toHaveBeenCalled();
    });

    it('should return early when slugField is null', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: null },
          },
        }),
      );

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockOrphanQuery.create).not.toHaveBeenCalled();
    });

    it('should return early when result has no slug value', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { title: 'No slug here' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockOrphanQuery.create).not.toHaveBeenCalled();
    });

    it('should create orphan redirect when all conditions met', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockOrphanQuery.create.mockResolvedValue({ id: 1, from: '/some-slug', status: 'pending' });

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockStrapi.db.query).toHaveBeenCalledWith('plugin::redirect-manager.orphan-redirect');
      expect(mockOrphanQuery.create).toHaveBeenCalledWith({
        data: {
          contentType: 'api::page.page',
          slug: 'some-slug',
          from: '/some-slug',
          status: 'pending',
        },
      });
    });

    it('should apply urlPrefix when building orphan from path', async () => {
      mockRedirectService.getSettings.mockResolvedValue(
        makeSettings({
          enabledContentTypes: {
            'api::page.page': { enabled: true, slugField: 'slug', urlPrefix: '/blog' },
          },
        }),
      );
      mockOrphanQuery.create.mockResolvedValue({});

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'deleted-post' },
      };

      await subscribedHandler.afterDelete(event);

      expect(mockOrphanQuery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ from: '/blog/deleted-post' }),
      });
    });

    it('should log warning and NOT throw when orphan creation fails', async () => {
      mockRedirectService.getSettings.mockResolvedValue(makeSettings());
      mockOrphanQuery.create.mockRejectedValue(new Error('DB error'));

      const event: LifecycleEvent = {
        model: { uid: 'api::page.page' },
        params: {},
        state: {},
        result: { slug: 'some-slug' },
      };

      await expect(subscribedHandler.afterDelete(event)).resolves.toBeUndefined();

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('[redirect-manager] Could not create orphan redirect'),
      );
    });
  });
});
