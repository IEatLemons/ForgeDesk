// Only display metadata crosses IPC. Credentials stay in the main process.
export type CockpitAccountMetadata = {
  sourceId: string
  fingerprint: string
  teamName: string
  note: string
  tags: string[]
  planType: string
  subscriptionExpiresAt: string
  quota?: {
    hourlyRemaining: number | null
    weeklyRemaining: number | null
    hourlyResetAt: string
    weeklyResetAt: string
    resetCredits: number | null
    resetCreditsExpireAt: string
    checkedAt: string
  }
}

export type CockpitImportAccountPreview = {
  id: string
  name: string
  email: string
  planType: string
  teamName: string
  subscriptionExpiresAt: string
  current: boolean
  duplicate: boolean
  importable: boolean
  error: string
}

export type CockpitImportPreview = {
  sourcePath: string
  accounts: CockpitImportAccountPreview[]
  api: { port: number; keyConfigured: boolean } | null
  warnings: string[]
}

export type CockpitImportInput = {
  sourcePath: string
  accountIds: string[]
  importApiSettings?: boolean
}

export type CockpitImportResult = {
  imported: number
  skipped: number
  errors: string[]
  apiSettingsImported: boolean
}
