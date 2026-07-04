import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createDockerDashboardSummary,
  filterDockerContainers,
  filterDockerImages,
  getDockerContainerStatusMeta,
  getDockerContainerTableLayout,
  getDockerWatchStatusMeta,
  getDockerImageDefaultNoteResourceKey,
  getDockerImageNoteTargetOptions
} from './docker-view.js'
import type { DockerContainerSummary, DockerImageSummary, DockerSnapshot } from './data.js'

const image: DockerImageSummary = {
  id: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  shortId: '111111111111',
  repository: 'merchant-api',
  tag: 'latest',
  digest: 'sha256:digest-a',
  size: '128MB',
  createdAt: '2026-07-03 10:00:00 +0800 HKT',
  createdSince: '2 hours ago',
  reference: 'merchant-api:latest',
  tagResourceKey: 'image-tag:merchant-api:latest',
  imageIdResourceKey: 'image-id:sha256:1111111111111111111111111111111111111111111111111111111111111111',
  noteResourceKey: 'image-tag:merchant-api:latest',
  displayName: 'Merchant API image',
  note: {
    resourceType: 'image',
    resourceKey: 'image-tag:merchant-api:latest',
    displayName: 'Merchant API image',
    notes: 'latest local build',
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z'
  }
}

const untaggedImage: DockerImageSummary = {
  ...image,
  id: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
  shortId: '222222222222',
  repository: '',
  tag: '',
  digest: '',
  reference: '<untagged>',
  tagResourceKey: '',
  imageIdResourceKey: 'image-id:sha256:2222222222222222222222222222222222222222222222222222222222222222',
  noteResourceKey: 'image-id:sha256:2222222222222222222222222222222222222222222222222222222222222222',
  displayName: '<untagged>',
  note: null
}

const container: DockerContainerSummary = {
  id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  shortId: 'abcdef123456',
  name: 'merchant-api-1',
  image: 'merchant-api:latest',
  state: 'running',
  status: 'Up 4 minutes',
  ports: '0.0.0.0:3000->3000/tcp',
  createdAt: '2026-07-03 10:00:00 +0800 HKT',
  runningFor: '4 minutes ago',
  noteResourceKey: 'container:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  displayName: 'API dev runtime',
  note: {
    resourceType: 'container',
    resourceKey: 'container:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    displayName: 'API dev runtime',
    notes: 'started from docker run',
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z'
  }
}

const exitedContainer: DockerContainerSummary = {
  ...container,
  id: 'bbbbbb1234567890bbbbbb1234567890bbbbbb1234567890bbbbbb1234567890',
  shortId: 'bbbbbb123456',
  name: 'worker-old',
  image: 'worker:dev',
  state: 'exited',
  status: 'Exited (0) 2 hours ago',
  noteResourceKey: 'container:bbbbbb1234567890bbbbbb1234567890bbbbbb1234567890bbbbbb1234567890',
  displayName: 'worker-old',
  note: null
}

const snapshot: DockerSnapshot = {
  images: [image, untaggedImage],
  containers: [container, exitedContainer],
  notes: [image.note, container.note].filter(Boolean) as DockerSnapshot['notes'],
  checkedAt: '2026-07-03T01:00:00.000Z'
}

describe('docker view model', () => {
  it('summarizes Docker images, containers and running containers', () => {
    assert.deepEqual(createDockerDashboardSummary(snapshot), {
      imageCount: 2,
      containerCount: 2,
      runningContainerCount: 1,
      notedResourceCount: 2
    })
  })

  it('filters Docker containers by note, name, image and id', () => {
    assert.deepEqual(filterDockerContainers(snapshot.containers, 'run').map((item) => item.id), [container.id])
    assert.deepEqual(filterDockerContainers(snapshot.containers, 'worker').map((item) => item.id), [exitedContainer.id])
    assert.deepEqual(filterDockerContainers(snapshot.containers, 'merchant-api:latest').map((item) => item.id), [container.id])
    assert.deepEqual(filterDockerContainers(snapshot.containers, 'abcdef123456').map((item) => item.id), [container.id])
  })

  it('filters Docker containers to running rows when requested', () => {
    assert.deepEqual(filterDockerContainers(snapshot.containers, '', { onlyRunning: true }).map((item) => item.id), [container.id])
    assert.deepEqual(filterDockerContainers(snapshot.containers, 'worker', { onlyRunning: true }), [])
  })

  it('keeps the compact Docker container table within the main content width', () => {
    const layout = getDockerContainerTableLayout()

    assert.equal(layout.minWidth <= 1120, true)
    assert.deepEqual(
      layout.columns.map((column) => column.key),
      ['container', 'state', 'image', 'runtime', 'noteActions']
    )
  })

  it('filters Docker images by note, reference, digest and id', () => {
    assert.deepEqual(filterDockerImages(snapshot.images, 'local build').map((item) => item.id), [image.id])
    assert.deepEqual(filterDockerImages(snapshot.images, 'merchant-api:latest').map((item) => item.id), [image.id])
    assert.deepEqual(filterDockerImages(snapshot.images, 'digest-a').map((item) => item.id), [image.id])
    assert.deepEqual(filterDockerImages(snapshot.images, '222222222222').map((item) => item.id), [untaggedImage.id])
  })

  it('builds image note target options from tag and image id', () => {
    assert.deepEqual(getDockerImageNoteTargetOptions(image), [
      { label: '按仓库:标签 merchant-api:latest', value: 'image-tag:merchant-api:latest' },
      { label: '按 Image ID 111111111111', value: 'image-id:sha256:1111111111111111111111111111111111111111111111111111111111111111' }
    ])
    assert.deepEqual(getDockerImageNoteTargetOptions(untaggedImage), [
      { label: '按 Image ID 222222222222', value: 'image-id:sha256:2222222222222222222222222222222222222222222222222222222222222222' }
    ])
  })

  it('defaults image note editing to tag when a tag exists', () => {
    assert.equal(getDockerImageDefaultNoteResourceKey({ ...image, noteResourceKey: image.imageIdResourceKey }), image.tagResourceKey)
    assert.equal(getDockerImageDefaultNoteResourceKey(untaggedImage), untaggedImage.imageIdResourceKey)
  })

  it('maps Docker container state to stable badge metadata', () => {
    assert.deepEqual(getDockerContainerStatusMeta('running', 'Up 4 minutes'), {
      label: 'running',
      color: 'green',
      badgeStatus: 'success'
    })
    assert.deepEqual(getDockerContainerStatusMeta('exited', 'Exited (0) 2 hours ago'), {
      label: 'exited',
      color: 'default',
      badgeStatus: 'default'
    })
    assert.deepEqual(getDockerContainerStatusMeta('', 'Created 1 minute ago'), {
      label: 'Created 1 minute ago',
      color: 'blue',
      badgeStatus: 'processing'
    })
  })

  it('shows Docker availability errors before optimistic watcher state', () => {
    assert.deepEqual(getDockerWatchStatusMeta({ watching: true, watchError: '', errorMessage: 'Command failed' }), {
      label: 'Docker 异常',
      color: 'red'
    })
    assert.deepEqual(getDockerWatchStatusMeta({ watching: true, watchError: '', errorMessage: '' }), {
      label: '监听中',
      color: 'green'
    })
    assert.deepEqual(getDockerWatchStatusMeta({ watching: false, watchError: 'daemon unavailable', errorMessage: '' }), {
      label: '监听异常',
      color: 'red'
    })
  })
})
