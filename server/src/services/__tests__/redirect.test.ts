import redirectService from '../redirect';

// ---------------------------------------------------------------------------
// Mock setup — mirrors the exact API shape used by services/redirect.ts
// ---------------------------------------------------------------------------

const mockQuery = {
  findOne: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
};

const mockStoreData = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockStrapi = {
  db: {
    query: jest.fn().mockReturnValue(mockQuery),
  },
  store: jest.fn().mockReturnValue(mockStoreData),
  contentTypes: {
    'api::page.page': {
      uid: 'api::page.page',
      info: { displayName: 'Page' },
      attributes: {
        title: { type: 'string' },
        slug: { type: 'uid' },
        content: { type: 'richtext' },
      },
    },
    'api::post.post': {
      uid: 'api::post.post',
      info: { displayName: 'Post' },
      attributes: {
        title: { type: 'string' },
        description: { type: 'text' },
      },
    },
    'plugin::users-permissions.user': {
      uid: 'plugin::users-permissions.user',
      info: { displayName: 'User' },
      attributes: {
        email: { type: 'string' },
      },
    },
  },
} as unknown as Parameters<typeof redirectService>[0]['strapi'];

const service = redirectService({ strapi: mockStrapi });

const UID = 'plugin::redirect-manager.redirect';

// Default disabled-chain-detection settings — keeps existing CRUD tests unaffected.
// Individual chain-detection tests override this per-test.
const DEFAULT_TEST_SETTINGS = {
  enabledContentTypes: {},
  autoRedirectOnSlugChange: true,
  chainDetectionEnabled: false,
  orphanRedirectEnabled: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('redirectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Disable chain detection by default so existing CRUD tests need no changes.
    mockStoreData.get.mockResolvedValue(DEFAULT_TEST_SETTINGS);
  });

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  describe('getSettings', () => {
    it('should call strapi.store with correct plugin config', async () => {
      mockStoreData.get.mockResolvedValue(null);

      await service.getSettings();

      expect(mockStrapi.store).toHaveBeenCalledWith({
        environment: '',
        type: 'plugin',
        name: 'redirect-manager',
      });
    });

    it('should return stored settings when they exist', async () => {
      const storedSettings = {
        enabledContentTypes: {
          'api::page.page': { enabled: true, slugField: 'slug' },
        },
        autoRedirectOnSlugChange: false,
        chainDetectionEnabled: false,
        orphanRedirectEnabled: false,
      };
      mockStoreData.get.mockResolvedValue(storedSettings);

      const result = await service.getSettings();

      expect(mockStoreData.get).toHaveBeenCalledWith({ key: 'settings' });
      expect(result).toEqual(storedSettings);
    });

    it('should return defaults when store returns null', async () => {
      mockStoreData.get.mockResolvedValue(null);

      const result = await service.getSettings();

      expect(result).toEqual({
        enabledContentTypes: {},
        autoRedirectOnSlugChange: true,
        chainDetectionEnabled: true,
        orphanRedirectEnabled: true,
      });
    });

    it('should return defaults when store returns undefined', async () => {
      mockStoreData.get.mockResolvedValue(undefined);

      const result = await service.getSettings();

      expect(result).toEqual({
        enabledContentTypes: {},
        autoRedirectOnSlugChange: true,
        chainDetectionEnabled: true,
        orphanRedirectEnabled: true,
      });
    });
  });

  describe('saveSettings', () => {
    it('should write settings to the store with the correct key', async () => {
      const settings = {
        enabledContentTypes: {
          'api::page.page': { enabled: true, slugField: 'slug' },
        },
        autoRedirectOnSlugChange: true,
        chainDetectionEnabled: true,
        orphanRedirectEnabled: true,
      };

      const result = await service.saveSettings(settings);

      expect(mockStrapi.store).toHaveBeenCalledWith({
        environment: '',
        type: 'plugin',
        name: 'redirect-manager',
      });
      expect(mockStoreData.set).toHaveBeenCalledWith({
        key: 'settings',
        value: settings,
      });
      expect(result).toEqual(settings);
    });
  });

  // -------------------------------------------------------------------------
  // getContentTypes
  // -------------------------------------------------------------------------

  describe('getContentTypes', () => {
    it('should return only api:: content types with string/uid attributes', async () => {
      const result = await service.getContentTypes();

      // Should include api::page.page and api::post.post, but NOT plugin::users-permissions.user
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            uid: 'api::page.page',
            displayName: 'Page',
            attributes: ['title', 'slug'],
          },
          {
            uid: 'api::post.post',
            displayName: 'Post',
            attributes: ['title'],
          },
        ]),
      );
    });

    it('should exclude non-string/uid attributes (richtext, text)', async () => {
      const result = await service.getContentTypes();

      const page = result.find(
        (ct) => (ct as { uid: string }).uid === 'api::page.page',
      ) as { attributes: string[] };
      // 'content' is richtext — should NOT appear
      expect(page.attributes).not.toContain('content');
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('should query all redirects ordered by createdAt desc', async () => {
      const mockRedirects = [
        { id: 2, from: '/b', to: '/c', type: '301', isActive: true },
        { id: 1, from: '/a', to: '/b', type: '302', isActive: false },
      ];
      mockQuery.findMany.mockResolvedValue(mockRedirects);

      const result = await service.findAll();

      expect(mockStrapi.db.query).toHaveBeenCalledWith(UID);
      expect(mockQuery.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockRedirects);
    });

    it('should return empty array when no redirects exist', async () => {
      mockQuery.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — findActive
  // -------------------------------------------------------------------------

  describe('findActive', () => {
    it('should query only active redirects', async () => {
      const mockRedirects = [
        { id: 1, from: '/a', to: '/b', type: '301', isActive: true },
      ];
      mockQuery.findMany.mockResolvedValue(mockRedirects);

      const result = await service.findActive();

      expect(mockStrapi.db.query).toHaveBeenCalledWith(UID);
      expect(mockQuery.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockRedirects);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — findByFrom
  // -------------------------------------------------------------------------

  describe('findByFrom', () => {
    it('should query by exact from match and isActive: true', async () => {
      const mockRedirect = {
        id: 1,
        from: '/old',
        to: '/new',
        type: '301',
        isActive: true,
      };
      mockQuery.findOne.mockResolvedValue(mockRedirect);

      const result = await service.findByFrom('/old');

      expect(mockStrapi.db.query).toHaveBeenCalledWith(UID);
      expect(mockQuery.findOne).toHaveBeenCalledWith({
        where: { from: '/old', isActive: true },
      });
      expect(result).toEqual(mockRedirect);
    });

    it('should return null when no active redirect matches', async () => {
      mockQuery.findOne.mockResolvedValue(null);

      const result = await service.findByFrom('/nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when findOne returns undefined', async () => {
      mockQuery.findOne.mockResolvedValue(undefined);

      const result = await service.findByFrom('/nonexistent');

      // Implementation uses ?? null, so undefined becomes null
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — findOne
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('should query by id', async () => {
      const mockRedirect = {
        id: 5,
        from: '/old',
        to: '/new',
        type: '301',
        isActive: true,
      };
      mockQuery.findOne.mockResolvedValue(mockRedirect);

      const result = await service.findOne(5);

      expect(mockQuery.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(result).toEqual(mockRedirect);
    });

    it('should return null when record does not exist', async () => {
      mockQuery.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('should create a redirect when no conflict exists', async () => {
      // Conflict check returns null (no existing redirect from /old-path)
      mockQuery.findOne.mockResolvedValue(null);
      const created = {
        id: 1,
        from: '/old-path',
        to: '/new-path',
        type: '301',
        isActive: true,
      };
      mockQuery.create.mockResolvedValue(created);

      const input = {
        from: '/old-path',
        to: '/new-path',
        type: '301' as const,
        isActive: true,
      };
      const result = await service.create(input);

      // Conflict check
      expect(mockQuery.findOne).toHaveBeenCalledWith({
        where: { from: '/old-path' },
      });
      // Actual creation
      expect(mockQuery.create).toHaveBeenCalledWith({
        data: input,
      });
      expect(result).toEqual(created);
    });

    it('should throw Error when a redirect with same from already exists', async () => {
      mockQuery.findOne.mockResolvedValue({
        id: 1,
        from: '/existing',
        to: '/somewhere',
      });

      await expect(
        service.create({ from: '/existing', to: '/new', type: '301' }),
      ).rejects.toThrow("A redirect from '/existing' already exists.");
    });

    it('should NOT call db.create when conflict is detected', async () => {
      mockQuery.findOne.mockResolvedValue({
        id: 1,
        from: '/existing',
        to: '/somewhere',
      });

      await expect(
        service.create({ from: '/existing', to: '/new', type: '301' }),
      ).rejects.toThrow();

      expect(mockQuery.create).not.toHaveBeenCalled();
    });

    it('should pass optional fields (comment, isActive) to db.create', async () => {
      mockQuery.findOne.mockResolvedValue(null);
      mockQuery.create.mockResolvedValue({
        id: 2,
        from: '/a',
        to: '/b',
        type: '302',
        isActive: false,
        comment: 'test note',
      });

      await service.create({
        from: '/a',
        to: '/b',
        type: '302',
        isActive: false,
        comment: 'test note',
      });

      expect(mockQuery.create).toHaveBeenCalledWith({
        data: {
          from: '/a',
          to: '/b',
          type: '302',
          isActive: false,
          comment: 'test note',
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('should update without conflict check when from is not provided', async () => {
      const updated = {
        id: 1,
        from: '/old',
        to: '/updated-dest',
        type: '301',
        isActive: true,
      };
      mockQuery.update.mockResolvedValue(updated);

      const result = await service.update(1, { to: '/updated-dest' });

      // With chainDetectionEnabled: false (global beforeEach), findOne is NOT called
      expect(mockQuery.findOne).not.toHaveBeenCalled();
      expect(mockQuery.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { to: '/updated-dest' },
      });
      expect(result).toEqual(updated);
    });

    it('should allow update when from changes but no conflict exists', async () => {
      // Conflict check returns null (no existing redirect with that from)
      mockQuery.findOne.mockResolvedValue(null);
      const updated = {
        id: 1,
        from: '/new-from',
        to: '/dest',
        type: '301',
        isActive: true,
      };
      mockQuery.update.mockResolvedValue(updated);

      const result = await service.update(1, { from: '/new-from' });

      expect(mockQuery.findOne).toHaveBeenCalledWith({
        where: { from: '/new-from' },
      });
      expect(mockQuery.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { from: '/new-from' },
      });
      expect(result).toEqual(updated);
    });

    it('should allow update when from matches the same record (self-match)', async () => {
      // Conflict check returns the same record being updated (id matches)
      mockQuery.findOne.mockResolvedValue({
        id: 1,
        from: '/same-from',
      });
      mockQuery.update.mockResolvedValue({
        id: 1,
        from: '/same-from',
        to: '/new-dest',
        type: '301',
        isActive: true,
      });

      const result = await service.update(1, {
        from: '/same-from',
        to: '/new-dest',
      });

      // Should proceed — the conflict is with itself
      expect(mockQuery.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { from: '/same-from', to: '/new-dest' },
      });
      expect(result.id).toBe(1);
    });

    it('should throw Error when from conflicts with a different record', async () => {
      // Conflict check returns a DIFFERENT record
      mockQuery.findOne.mockResolvedValue({
        id: 99,
        from: '/taken-path',
      });

      await expect(
        service.update(1, { from: '/taken-path' }),
      ).rejects.toThrow("A redirect from '/taken-path' already exists.");

      expect(mockQuery.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('should call db.delete with the correct id', async () => {
      mockQuery.delete.mockResolvedValue(undefined);

      await service.delete(42);

      expect(mockStrapi.db.query).toHaveBeenCalledWith(UID);
      expect(mockQuery.delete).toHaveBeenCalledWith({
        where: { id: 42 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // CRUD — toggleActive
  // -------------------------------------------------------------------------

  describe('toggleActive', () => {
    it('should flip isActive from true to false', async () => {
      mockQuery.findOne.mockResolvedValue({
        id: 1,
        from: '/a',
        to: '/b',
        type: '301',
        isActive: true,
      });
      mockQuery.update.mockResolvedValue({
        id: 1,
        from: '/a',
        to: '/b',
        type: '301',
        isActive: false,
      });

      const result = await service.toggleActive(1);

      expect(mockQuery.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockQuery.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should flip isActive from false to true', async () => {
      mockQuery.findOne.mockResolvedValue({
        id: 2,
        from: '/x',
        to: '/y',
        type: '302',
        isActive: false,
      });
      mockQuery.update.mockResolvedValue({
        id: 2,
        from: '/x',
        to: '/y',
        type: '302',
        isActive: true,
      });

      const result = await service.toggleActive(2);

      expect(mockQuery.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('should throw Error when redirect does not exist', async () => {
      mockQuery.findOne.mockResolvedValue(null);

      await expect(service.toggleActive(999)).rejects.toThrow(
        'Redirect with id 999 not found.',
      );

      expect(mockQuery.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Chain detection (Faza 6)
  // -------------------------------------------------------------------------

  describe('chain detection', () => {
    const chainEnabledSettings = {
      ...DEFAULT_TEST_SETTINGS,
      chainDetectionEnabled: true,
    };

    beforeEach(() => {
      mockStoreData.get.mockResolvedValue(chainEnabledSettings);
    });

    describe('create', () => {
      it('should allow create when to path has no existing chain', async () => {
        // Conflict check: no existing redirect from /a
        // Chain check: /b has no outgoing redirect
        mockQuery.findOne
          .mockResolvedValueOnce(null)  // conflict check
          .mockResolvedValueOnce(null); // chain check: /b has no redirect
        const created = { id: 1, from: '/a', to: '/b', type: '301', isActive: true };
        mockQuery.create.mockResolvedValue(created);

        await expect(
          service.create({ from: '/a', to: '/b', type: '301' }),
        ).resolves.toEqual(created);

        expect(mockQuery.create).toHaveBeenCalledWith({
          data: { from: '/a', to: '/b', type: '301' },
        });
      });

      it('should throw when chain exceeds 10 hops (11th hop)', async () => {
        // 10 existing redirects: /1→/2→/3→...→/10→/11
        // Creating /new→/1 would make an 11-hop chain
        mockQuery.findOne
          .mockResolvedValueOnce(null)                              // conflict check
          .mockResolvedValueOnce({ from: '/1', to: '/2' })         // chain depth 1
          .mockResolvedValueOnce({ from: '/2', to: '/3' })         // chain depth 2
          .mockResolvedValueOnce({ from: '/3', to: '/4' })         // chain depth 3
          .mockResolvedValueOnce({ from: '/4', to: '/5' })         // chain depth 4
          .mockResolvedValueOnce({ from: '/5', to: '/6' })         // chain depth 5
          .mockResolvedValueOnce({ from: '/6', to: '/7' })         // chain depth 6
          .mockResolvedValueOnce({ from: '/7', to: '/8' })         // chain depth 7
          .mockResolvedValueOnce({ from: '/8', to: '/9' })         // chain depth 8
          .mockResolvedValueOnce({ from: '/9', to: '/10' })        // chain depth 9
          .mockResolvedValueOnce({ from: '/10', to: '/11' });      // chain depth 10 → /11

        await expect(
          service.create({ from: '/new', to: '/1', type: '301' }),
        ).rejects.toThrow('Redirect chain exceeds maximum depth of 10 hops.');

        expect(mockQuery.create).not.toHaveBeenCalled();
      });

      it('should allow a chain of exactly 10 hops', async () => {
        // 9 existing redirects: /1→...→/9→/10. Creating /new→/1 = 10 hops total.
        mockQuery.findOne
          .mockResolvedValueOnce(null)                         // conflict check
          .mockResolvedValueOnce({ from: '/1', to: '/2' })    // depth 1
          .mockResolvedValueOnce({ from: '/2', to: '/3' })    // depth 2
          .mockResolvedValueOnce({ from: '/3', to: '/4' })    // depth 3
          .mockResolvedValueOnce({ from: '/4', to: '/5' })    // depth 4
          .mockResolvedValueOnce({ from: '/5', to: '/6' })    // depth 5
          .mockResolvedValueOnce({ from: '/6', to: '/7' })    // depth 6
          .mockResolvedValueOnce({ from: '/7', to: '/8' })    // depth 7
          .mockResolvedValueOnce({ from: '/8', to: '/9' })    // depth 8
          .mockResolvedValueOnce({ from: '/9', to: '/10' })   // depth 9
          .mockResolvedValueOnce(null);                        // depth 10: /10 has no redirect → valid
        const created = { id: 1, from: '/new', to: '/1', type: '301', isActive: true };
        mockQuery.create.mockResolvedValue(created);

        await expect(
          service.create({ from: '/new', to: '/1', type: '301' }),
        ).resolves.toEqual(created);

        expect(mockQuery.create).toHaveBeenCalledWith({
          data: { from: '/new', to: '/1', type: '301' },
        });
      });

      it('should throw when chain contains a cycle (A→B exists, creating B→A)', async () => {
        // Existing: /b → /a
        // Creating: /a → /b  (would form cycle /a→/b→/a)
        mockQuery.findOne
          .mockResolvedValueOnce(null)                         // conflict check: no redirect from /a
          .mockResolvedValueOnce({ from: '/b', to: '/a' });   // chain depth 1: /b → /a (cycle!)

        await expect(
          service.create({ from: '/a', to: '/b', type: '301' }),
        ).rejects.toThrow('Redirect chain contains a cycle.');

        expect(mockQuery.create).not.toHaveBeenCalled();
      });

      it('should skip chain check when chainDetectionEnabled is false', async () => {
        mockStoreData.get.mockResolvedValue({ ...chainEnabledSettings, chainDetectionEnabled: false });

        // Only conflict check findOne — no chain check
        mockQuery.findOne.mockResolvedValueOnce(null);
        const created = { id: 1, from: '/a', to: '/b', type: '301', isActive: true };
        mockQuery.create.mockResolvedValue(created);

        await expect(
          service.create({ from: '/a', to: '/b', type: '301' }),
        ).resolves.toEqual(created);

        // Only one findOne call (conflict check), chain check was skipped
        expect(mockQuery.findOne).toHaveBeenCalledTimes(1);
        expect(mockQuery.findOne).toHaveBeenCalledWith({ where: { from: '/a' } });
        expect(mockQuery.create).toHaveBeenCalledWith({
          data: { from: '/a', to: '/b', type: '301' },
        });
      });
    });

    describe('update', () => {
      it('should detect cycle when updating to creates a cycle', async () => {
        // Existing redirect being updated: id=1, currently /a → /old-dest
        // Trying to update to: /b
        // Existing redirect: /b → /a (would create cycle)
        mockQuery.findOne
          .mockResolvedValueOnce({ id: 1, from: '/a', to: '/old-dest' }) // lookup existing for fromPath
          .mockResolvedValueOnce({ from: '/b', to: '/a' });               // chain check: /b → /a (cycle!)

        await expect(
          service.update(1, { to: '/b' }),
        ).rejects.toThrow('Redirect chain contains a cycle.');

        expect(mockQuery.update).not.toHaveBeenCalled();
      });

      it('should skip chain check for update when chainDetectionEnabled is false', async () => {
        mockStoreData.get.mockResolvedValue({ ...chainEnabledSettings, chainDetectionEnabled: false });

        const updated = { id: 1, from: '/a', to: '/b', type: '301', isActive: true };
        mockQuery.update.mockResolvedValue(updated);

        const result = await service.update(1, { to: '/b' });

        // No findOne calls (chain detection and conflict check both skipped)
        expect(mockQuery.findOne).not.toHaveBeenCalled();
        expect(mockQuery.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { to: '/b' },
        });
        expect(result).toEqual(updated);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Orphan redirect methods
  // -------------------------------------------------------------------------

  describe('Orphan redirects', () => {
    const ORPHAN_UID = 'plugin::redirect-manager.orphan-redirect';

    beforeEach(() => {
      jest.clearAllMocks();
      mockStoreData.get.mockResolvedValue(DEFAULT_TEST_SETTINGS);
    });

    describe('findAllOrphans', () => {
      it('should return pending orphans ordered by createdAt desc', async () => {
        const orphans = [
          { id: 2, from: '/newer', status: 'pending', contentType: 'api::page.page', slug: 'newer', createdAt: '2026-02-01' },
          { id: 1, from: '/older', status: 'pending', contentType: 'api::page.page', slug: 'older', createdAt: '2026-01-01' },
        ];
        mockQuery.findMany.mockResolvedValue(orphans);

        const result = await service.findAllOrphans();

        expect(mockStrapi.db.query).toHaveBeenCalledWith(ORPHAN_UID);
        expect(mockQuery.findMany).toHaveBeenCalledWith({
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
        });
        expect(result).toEqual(orphans);
      });
    });

    describe('resolveOrphan', () => {
      it('should create a redirect and mark orphan as resolved', async () => {
        const orphan = { id: 5, from: '/old-page', status: 'pending', contentType: 'api::page.page', slug: 'old-page' };
        mockQuery.findOne.mockResolvedValueOnce(orphan); // orphan lookup
        mockQuery.findOne.mockResolvedValueOnce(null);   // conflict check (no existing redirect)
        mockQuery.create.mockResolvedValue({ id: 10, from: '/old-page', to: '/new-page', type: '301' });
        mockQuery.update.mockResolvedValue({ id: 5, status: 'resolved' });

        await service.resolveOrphan(5, '/new-page');

        // Should have looked up the orphan
        expect(mockQuery.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
        // Should have created a redirect
        expect(mockQuery.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ from: '/old-page', to: '/new-page', type: '301' }),
        });
        // Should have marked orphan as resolved
        expect(mockQuery.update).toHaveBeenCalledWith({
          where: { id: 5 },
          data: { status: 'resolved' },
        });
      });

      it('should throw when orphan not found', async () => {
        mockQuery.findOne.mockResolvedValue(null);

        await expect(service.resolveOrphan(999, '/some-path')).rejects.toThrow(
          'Orphan redirect with id 999 not found.',
        );

        expect(mockQuery.create).not.toHaveBeenCalled();
        expect(mockQuery.update).not.toHaveBeenCalled();
      });

      it('should throw if a redirect from the same from already exists (conflict)', async () => {
        const orphan = { id: 3, from: '/conflict-path', status: 'pending' };
        const existingRedirect = { id: 99, from: '/conflict-path', to: '/somewhere' };
        mockQuery.findOne.mockResolvedValueOnce(orphan);      // orphan lookup
        mockQuery.findOne.mockResolvedValueOnce(existingRedirect); // conflict check

        await expect(service.resolveOrphan(3, '/new-dest')).rejects.toThrow(
          "A redirect from '/conflict-path' already exists.",
        );
      });
    });

    describe('dismissOrphan', () => {
      it('should mark orphan as dismissed', async () => {
        const orphan = { id: 7, from: '/to-dismiss', status: 'pending' };
        mockQuery.findOne.mockResolvedValue(orphan);
        mockQuery.update.mockResolvedValue({ id: 7, status: 'dismissed' });

        await service.dismissOrphan(7);

        expect(mockQuery.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
        expect(mockQuery.update).toHaveBeenCalledWith({
          where: { id: 7 },
          data: { status: 'dismissed' },
        });
      });

      it('should throw when orphan not found', async () => {
        mockQuery.findOne.mockResolvedValue(null);

        await expect(service.dismissOrphan(404)).rejects.toThrow(
          'Orphan redirect with id 404 not found.',
        );

        expect(mockQuery.update).not.toHaveBeenCalled();
      });
    });
  });
});
