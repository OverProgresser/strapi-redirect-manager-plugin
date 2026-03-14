import type { Core } from '@strapi/strapi';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('[redirect-manager] Bootstrapped.');
};

export default bootstrap;
