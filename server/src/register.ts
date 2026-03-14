import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // Register plugin routes into content-api
  strapi.log.info('[redirect-manager] Registered.');
};

export default register;
