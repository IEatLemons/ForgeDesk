import type { DockerContainerSummary, DockerImageSummary, DockerSnapshot } from './data'

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning'

export type DockerDashboardSummary = {
  imageCount: number
  containerCount: number
  runningContainerCount: number
  notedResourceCount: number
}

export type DockerStatusMeta = {
  label: string
  color: string
  badgeStatus: BadgeStatus
}

export type DockerWatchStatusMeta = {
  label: string
  color: string
}

export type DockerImageNoteTargetOption = {
  label: string
  value: string
}

function includesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase())
}

function matchesQuery(values: string[], query: string): boolean {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return true
  }

  return values.some((value) => includesText(value, normalizedQuery))
}

export function createDockerDashboardSummary(snapshot: DockerSnapshot): DockerDashboardSummary {
  return {
    imageCount: snapshot.images.length,
    containerCount: snapshot.containers.length,
    runningContainerCount: snapshot.containers.filter((container) => container.state.toLowerCase() === 'running').length,
    notedResourceCount: snapshot.notes.length
  }
}

export function filterDockerContainers(containers: DockerContainerSummary[], query: string): DockerContainerSummary[] {
  return containers.filter((container) =>
    matchesQuery(
      [
        container.displayName,
        container.note?.notes ?? '',
        container.name,
        container.image,
        container.id,
        container.shortId,
        container.state,
        container.status,
        container.ports
      ],
      query
    )
  )
}

export function filterDockerImages(images: DockerImageSummary[], query: string): DockerImageSummary[] {
  return images.filter((image) =>
    matchesQuery(
      [
        image.displayName,
        image.note?.notes ?? '',
        image.reference,
        image.repository,
        image.tag,
        image.digest,
        image.id,
        image.shortId,
        image.size
      ],
      query
    )
  )
}

export function getDockerImageNoteTargetOptions(image: DockerImageSummary): DockerImageNoteTargetOption[] {
  const options: DockerImageNoteTargetOption[] = []

  if (image.tagResourceKey) {
    options.push({ label: `按仓库:标签 ${image.reference}`, value: image.tagResourceKey })
  }

  options.push({ label: `按 Image ID ${image.shortId}`, value: image.imageIdResourceKey })

  return options
}

export function getDockerImageDefaultNoteResourceKey(image: DockerImageSummary): string {
  return image.tagResourceKey || image.imageIdResourceKey
}

export function getDockerContainerStatusMeta(state: string, status: string): DockerStatusMeta {
  const normalizedState = state.trim().toLowerCase()
  const fallbackLabel = status.trim() || 'unknown'

  if (normalizedState === 'running') {
    return { label: 'running', color: 'green', badgeStatus: 'success' }
  }

  if (normalizedState === 'paused') {
    return { label: 'paused', color: 'gold', badgeStatus: 'warning' }
  }

  if (normalizedState === 'restarting') {
    return { label: 'restarting', color: 'blue', badgeStatus: 'processing' }
  }

  if (normalizedState === 'dead') {
    return { label: 'dead', color: 'red', badgeStatus: 'error' }
  }

  if (normalizedState === 'created' || (!normalizedState && fallbackLabel.toLowerCase().includes('created'))) {
    return { label: normalizedState || fallbackLabel, color: 'blue', badgeStatus: 'processing' }
  }

  if (normalizedState === 'exited') {
    return { label: 'exited', color: 'default', badgeStatus: 'default' }
  }

  return { label: normalizedState || fallbackLabel, color: 'default', badgeStatus: 'default' }
}

export function getDockerWatchStatusMeta({
  watching,
  watchError,
  errorMessage
}: {
  watching: boolean
  watchError: string
  errorMessage: string
}): DockerWatchStatusMeta {
  if (errorMessage.trim()) {
    return { label: 'Docker 异常', color: 'red' }
  }

  if (watching) {
    return { label: '监听中', color: 'green' }
  }

  if (watchError.trim()) {
    return { label: '监听异常', color: 'red' }
  }

  return { label: '未监听', color: 'default' }
}
