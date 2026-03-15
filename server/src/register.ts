import type { Core } from '@strapi/strapi';
import middlewares from './middlewares';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('[redirect-manager] Registered.');

  // Register the redirect middleware globally so it runs on every request
  strapi.server.use(middlewares.redirectMiddleware({ strapi }));
};

export default register;
