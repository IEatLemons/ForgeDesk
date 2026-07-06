import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectCloseGuardActivities,
  createCloseGuardPrompt,
  formatCloseGuardActivityList,
  type CloseGuardActivity
} from './app-close-guard.js'

describe('app close guard', () => {
  it('collects running build, release, and terminal activities', () => {
    const activities = collectCloseGuardActivities({
      quickBuildTask: {
        id: 'build-1',
        command: 'pnpm package:mac:legacy',
        cwd: '/Users/stone/ForgeDesk',
        phase: '执行构建命令',
        status: 'running'
      },
      releasePublishTasks: [
        {
          id: 'release-1',
          repositoryName: 'ForgeDesk',
          tagName: 'v1.0.9',
          phase: '上传到 GitHub Releases',
          status: 'running'
        },
        {
          id: 'release-2',
          repositoryName: 'ForgeDesk',
          tagName: 'v1.0.8',
          phase: '发布完成',
          status: 'succeeded'
        }
      ],
      terminalSessions: [
        {
          id: 'term-1',
          cwd: '/Users/stone/ForgeDesk',
          exited: false,
          title: 'ForgeDesk CLI'
        },
        {
          id: 'term-2',
          cwd: '/tmp',
          exited: true,
          title: 'done'
        }
      ]
    })

    assert.deepEqual(
      activities.map((activity) => activity.kind),
      ['quick-build', 'release-publish', 'terminal']
    )
    assert.match(activities[0].detail, /pnpm package:mac:legacy/)
    assert.match(activities[1].title, /v1\.0\.9/)
    assert.match(activities[2].title, /ForgeDesk CLI/)
  })

  it('creates different prompts for hiding a window and quitting the app', () => {
    const activities: CloseGuardActivity[] = [
      {
        id: 'build-1',
        kind: 'quick-build',
        title: '快速构建',
        detail: 'pnpm package:mac:legacy'
      }
    ]

    const closePrompt = createCloseGuardPrompt('close-window', activities)
    const quitPrompt = createCloseGuardPrompt('quit-app', activities)

    assert.equal(closePrompt?.buttons[1], '关闭窗口')
    assert.match(closePrompt?.detail ?? '', /继续在后台运行/)
    assert.equal(quitPrompt?.buttons[1], '退出并终止')
    assert.match(quitPrompt?.detail ?? '', /终止 ForgeDesk 启动的构建/)
  })

  it('limits long activity lists in dialog detail', () => {
    const activities: CloseGuardActivity[] = Array.from({ length: 8 }, (_, index) => ({
      id: `activity-${index}`,
      kind: 'terminal',
      title: `终端 ${index + 1}`,
      detail: '/Users/stone/ForgeDesk'
    }))

    const list = formatCloseGuardActivityList(activities, 3)

    assert.match(list, /终端 1/)
    assert.doesNotMatch(list, /终端 4/)
    assert.match(list, /另外 5 项活动仍在运行/)
  })
})
