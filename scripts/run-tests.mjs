import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const outDir = await mkdtemp(join(tmpdir(), 'forgedesk-tests-'))
const sourceRoots = ['src/main', 'src/renderer/src']

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(path)
    }
  }

  return files
}

try {
  const files = (await Promise.all(sourceRoots.map((item) => walk(join(root, item))))).flat()
  const specFiles = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const result = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022
      },
      fileName: file
    })
    const outputPath = join(outDir, relative(root, file).replace(/\.(ts|tsx)$/, '.js'))

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, result.outputText)

    if (file.endsWith('.spec.ts') || file.endsWith('.spec.tsx')) {
      specFiles.push(outputPath)
    }
  }

  const child = spawn(process.execPath, ['--test', ...specFiles], { stdio: 'inherit' })
  const exitCode = await new Promise((resolve) => child.on('exit', resolve))
  process.exit(exitCode ?? 1)
} finally {
  await rm(outDir, { recursive: true, force: true })
}
