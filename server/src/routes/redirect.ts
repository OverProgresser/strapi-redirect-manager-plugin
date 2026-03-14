export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/settings',
      handler: 'redirect.getSettings',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/settings',
      handler: 'redirect.saveSettings',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/content-types',
      handler: 'redirect.getContentTypes',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/redirect',
      handler: 'redirect.getRedirect',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/redirect/all',
      handler: 'redirect.getAllRedirect',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/redirect',
      handler: 'redirect.createRedirect',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/content/:contentType/:slug',
      handler: 'redirect.findContentBySlug',
      config: { auth: false },
    },
  ],
};
