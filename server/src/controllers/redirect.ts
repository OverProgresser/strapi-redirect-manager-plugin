import type { Core } from '@strapi/strapi';

const redirectController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getSettings(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    ctx.body = await redirectService.getSettings();
  },

  async saveSettings(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    const { enabledContentTypes } = ctx.request.body;
    ctx.body = await redirectService.saveSettings({ enabledContentTypes });
  },

  async getContentTypes(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    ctx.body = await redirectService.getContentTypes();
  },

  async getRedirect(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    const { contentType, oldSlug } = ctx.query as { contentType: string; oldSlug: string };
    ctx.body = await redirectService.resolveRedirect(contentType, oldSlug);
  },

  async getAllRedirect(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    ctx.body = await redirectService.getAllRedirects();
  },

  async createRedirect(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    ctx.body = await redirectService.createRedirect(ctx.request.body.data);
  },

  async findContentBySlug(ctx: any) {
    const redirectService = strapi.plugin('redirect-manager').service('redirect');
    const { contentType, slug } = ctx.params as { contentType: string; slug: string };
    ctx.body = await redirectService.findContentBySlug(contentType, slug);
  },
});

export default redirectController;
