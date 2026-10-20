import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { parseQuickBuildEvent } from '../shared/quick-build.js'
import type { QuickBuildTask } from '../shared/quick-build.js'

export class QuickBuildOutputReader {
  private remainder = ''
  private dropping = false
  push(chunk: string): NonNullable<ReturnType<typeof parseQuickBuildEvent>>[] {
    const lines = (this.remainder + chunk).split('\n')
    this.remainder = lines.pop() ?? ''
    const events: NonNullable<ReturnType<typeof parseQuickBuildEvent>>[] = []
    for (const line of lines) {
      if (!this.dropping) { const event = parseQuickBuildEvent(line.trimEnd()); if (event) events.push(event) }
      this.dropping = false
    }
    if (this.remainder.length > 16384) { this.remainder = ''; this.dropping = true }
    return events
  }
}

export function validateQuickBuildArtifact(task: Pick<QuickBuildTask, 'cwd' | 'artifactPath' | 'architecture'>): string {
  if (!task.artifactPath || !isAbsolute(task.artifactPath)) throw new Error('本次构建未提供成功产物，不能打开旧应用')
  const sourceRoot = realpathSync(task.cwd), artifact = realpathSync(task.artifactPath)
  const child = relative(join(sourceRoot, 'dist', 'quick-build'), artifact)
  if (artifact !== task.artifactPath || !child || child.startsWith('..') || isAbsolute(child) || !artifact.endsWith('.app')) throw new Error('构建产物不属于此源码目录')
  const manifest = JSON.parse(readFileSync(join(artifact, 'Contents', 'Resources', 'quick-build.json'), 'utf8'))
  if (manifest.formatVersion !== 1 || manifest.localOnly !== true || manifest.sourceRoot !== sourceRoot || manifest.architecture !== task.architecture || !existsSync(join(artifact, 'Contents', 'MacOS', 'ForgeDesk'))) throw new Error('构建产物记录不匹配，请重新构建')
  return artifact
}
