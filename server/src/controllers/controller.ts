import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx: any) {
    ctx.body = strapi
      .plugin('redirect-manager')
      .service('service')
      .getWelcomeMessage();
  },
});

export default controller;
