export default {
  type: 'admin',
  routes: [
    // Settings routes
    {
      method: 'GET',
      path: '/settings',
      handler: 'redirect.getSettings',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/settings',
      handler: 'redirect.saveSettings',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/content-types',
      handler: 'redirect.getContentTypes',
      config: { policies: [] },
    },
    // CRUD routes
    {
      method: 'GET',
      path: '/redirects',
      handler: 'redirect.find',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/redirects/:id',
      handler: 'redirect.findOne',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/redirects',
      handler: 'redirect.create',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/redirects/:id',
      handler: 'redirect.update',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/redirects/:id',
      handler: 'redirect.delete',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/redirects/:id/toggle',
      handler: 'redirect.toggleActive',
      config: { policies: [] },
    },
  ],
};
