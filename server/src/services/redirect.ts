import type { Core } from '@strapi/strapi';

const PLUGIN_STORE_KEY = 'settings';
const REDIRECT_UID = 'plugin::redirect-manager.redirect';

export interface ContentTypeSettings {
  enabled: boolean;
  slugField: string | null;
}

export interface PluginSettings {
  enabledContentTypes: Record<string, ContentTypeSettings>;
}

export interface RedirectData {
  contentType: string;
  oldSlug: string;
  newSlug: string;
  redirectType?: string;
  comment?: string;
}

const redirectService = ({ strapi }: { strapi: Core.Strapi }) => ({
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
      (ct: any) => ct.uid?.startsWith('api::'),
    );

    return contentTypes.map((ct: any) => ({
      uid: ct.uid,
      displayName: ct.info?.displayName ?? ct.uid,
      attributes: Object.entries(ct.attributes ?? {})
        .filter(([, attr]: [string, any]) => attr.type === 'string' || attr.type === 'uid')
        .map(([key]) => key),
    }));
  },

  async resolveRedirect(
    contentType: string,
    oldSlug: string,
  ): Promise<Record<string, unknown> | null> {
    const slugVariants = [
      oldSlug,
      `/${oldSlug}`,
      `${oldSlug}/`,
      `/${oldSlug}/`,
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    const visitedSlugs = new Set<string>();
    let current: Record<string, unknown> | null = null;
    let slug = oldSlug;

    while (!visitedSlugs.has(slug)) {
      visitedSlugs.add(slug);

      const variants = [slug, `/${slug}`, `${slug}/`, `/${slug}/`].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      );

      const results = await Promise.all(
        variants.map((v) =>
          strapi.db.query(REDIRECT_UID).findOne({
            where: { contentType, oldSlug: v },
          }),
        ),
      );

      const found = results.find((r) => r !== null) as Record<string, unknown> | null;
      if (!found) break;

      current = found;
      slug = found.newSlug as string;
    }

    return current;
  },

  async getAllRedirects(): Promise<Record<string, unknown>[]> {
    const results = await strapi.db.query(REDIRECT_UID).findMany({
      limit: 500,
    });

    return (results as Record<string, unknown>[]).filter((r) => {
      const segments = (r.oldSlug as string).split('/').filter(Boolean);
      return segments.length > 1;
    });
  },

  async createRedirect(data: RedirectData): Promise<Record<string, unknown>> {
    // Remove any existing reverse redirect to prevent loops
    await strapi.db.query(REDIRECT_UID).deleteMany({
      where: {
        contentType: data.contentType,
        oldSlug: data.newSlug,
        newSlug: data.oldSlug,
      },
    });

    return strapi.db.query(REDIRECT_UID).create({ data }) as Promise<Record<string, unknown>>;
  },

  async findContentBySlug(
    contentTypeUid: string,
    slug: string,
  ): Promise<Record<string, unknown> | null> {
    const settings = await this.getSettings();
    const config = settings.enabledContentTypes?.[contentTypeUid];

    if (!config?.slugField) {
      return null;
    }

    const entry = await strapi.db.query(contentTypeUid).findOne({
      where: { [config.slugField]: slug },
    });

    if (entry) return entry as Record<string, unknown>;

    // Try chain resolution
    const redirect = await this.resolveRedirect(contentTypeUid, slug);
    if (!redirect) return null;

    return strapi.db.query(contentTypeUid).findOne({
      where: { [config.slugField]: redirect.newSlug as string },
    }) as Promise<Record<string, unknown> | null>;
  },
});

export default redirectService;
