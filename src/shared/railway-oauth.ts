export const railwayOAuthRedirectUri = 'http://127.0.0.1:43827/oauth/railway/callback'
export const railwayOAuthScopes = 'openid email profile offline_access project:member'

export type RailwayOAuthLoginInput = {
  projectId?: string
  connectionId?: string
  name: string
  clientId: string
}

export type RailwayOAuthSummary = {
  clientId: string
  accountName: string
  accountEmail: string
  scopes: string[]
  status: 'connected' | 'needs-login'
  persistent: boolean
}
