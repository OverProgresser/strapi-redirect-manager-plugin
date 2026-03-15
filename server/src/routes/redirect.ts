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
    // Redirect CRUD routes
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
    // Orphan redirect routes
    {
      method: 'GET',
      path: '/orphan-redirects',
      handler: 'redirect.getOrphans',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/orphan-redirects/:id/resolve',
      handler: 'redirect.resolveOrphan',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/orphan-redirects/:id/dismiss',
      handler: 'redirect.dismissOrphan',
      config: { policies: [] },
    },
  ],
};
