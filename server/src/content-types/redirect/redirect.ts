export default {
  kind: 'collectionType',
  collectionName: 'redirects',
  info: {
    singularName: 'redirect',
    pluralName: 'redirects',
    displayName: 'Redirect',
    description: 'Stores URL redirects managed by the Redirect Manager plugin',
  },
  options: {
    draftAndPublish: false,
    timestamps: true,
  },
  pluginOptions: {
    'content-manager': { visible: false },
    'content-type-builder': { visible: false },
  },
  attributes: {
    contentType: {
      type: 'string',
      required: true,
    },
    oldSlug: {
      type: 'string',
      required: true,
    },
    newSlug: {
      type: 'string',
      required: true,
    },
    redirectType: {
      type: 'string',
      required: true,
      default: '301',
    },
    comment: {
      type: 'text',
    },
  },
} as const;
