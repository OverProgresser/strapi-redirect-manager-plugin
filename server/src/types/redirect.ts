export interface Redirect {
  id: number;
  from: string;
  to: string;
  type: '301' | '302';
  isActive: boolean;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRedirectInput {
  from: string;
  to: string;
  type?: '301' | '302';
  isActive?: boolean;
  comment?: string;
}

export interface UpdateRedirectInput {
  from?: string;
  to?: string;
  type?: '301' | '302';
  isActive?: boolean;
  comment?: string;
}

export interface OrphanRedirect {
  id: number;
  contentType: string;
  slug: string;
  from: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}
