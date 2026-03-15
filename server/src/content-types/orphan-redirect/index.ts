export default {
  kind: 'collectionType',
  collectionName: 'orphan_redirects',
  info: {
    singularName: 'orphan-redirect',
    pluralName: 'orphan-redirects',
    displayName: 'Orphan Redirect',
  },
  options: { draftAndPublish: false },
  pluginOptions: {
    'content-manager': { visible: false },
    'content-type-builder': { visible: false },
  },
  attributes: {
    contentType: { type: 'string', required: true },
    slug: { type: 'string', required: true },
    from: { type: 'string', required: true },
    status: {
      type: 'enumeration',
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      required: true,
    },
  },
};
