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
    from: {
      type: 'string',
      required: true,
    },
    to: {
      type: 'string',
      required: true,
    },
    type: {
      type: 'enumeration',
      enum: ['301', '302'],
      required: true,
      default: '301',
    },
    isActive: {
      type: 'boolean',
      default: true,
    },
    comment: {
      type: 'text',
    },
  },
} as const;
