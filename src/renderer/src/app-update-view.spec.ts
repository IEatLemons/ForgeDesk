import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createAppUpdateViewModel } from './app-update-view.js'

describe('createAppUpdateViewModel', () => {
  it('shows the installed version when no update is active', () => {
    const view = createAppUpdateViewModel({
      status: 'idle',
      currentVersion: '1.0.2'
    })

    assert.equal(view.title, '当前版本 1.0.2')
    assert.equal(view.description, '可以手动检查 GitHub Releases 上的新版本。')
    assert.equal(view.primaryAction, 'check')
    assert.equal(view.primaryLabel, '检查更新')
  })

  it('asks the user to restart after an update is downloaded', () => {
    const view = createAppUpdateViewModel({
      status: 'downloaded',
      currentVersion: '1.0.2',
      availableVersion: '1.0.3'
    })

    assert.equal(view.title, '新版 1.0.3 已下载')
    assert.equal(view.description, '重启 ForgeDesk 后会完成安装。')
    assert.equal(view.primaryAction, 'install')
    assert.equal(view.primaryLabel, '重启安装')
  })

  it('keeps the install action disabled while checking or downloading', () => {
    const checking = createAppUpdateViewModel({
      status: 'checking',
      currentVersion: '1.0.2'
    })
    const downloading = createAppUpdateViewModel({
      status: 'downloading',
      currentVersion: '1.0.2',
      availableVersion: '1.0.3',
      percent: 42
    })

    assert.equal(checking.primaryAction, 'busy')
    assert.equal(checking.primaryLabel, '正在检查')
    assert.equal(downloading.primaryAction, 'busy')
    assert.equal(downloading.primaryLabel, '下载中 42%')
  })
})
