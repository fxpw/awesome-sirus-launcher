import { createWriteStream } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { ZipFile } from 'yazl'

export async function zipDirectory(sourceDir: string, archivePath: string): Promise<void> {
  const sourceStat = await stat(sourceDir)
  if (!sourceStat.isDirectory()) {
    throw new Error('Источник backup должен быть папкой')
  }

  await mkdir(dirname(archivePath), { recursive: true })

  const zip = new ZipFile()
  const output = createWriteStream(archivePath)
  const done = new Promise<void>((resolvePromise, reject) => {
    output.on('close', () => resolvePromise())
    output.on('error', reject)
    zip.outputStream.on('error', reject)
  })

  zip.outputStream.pipe(output)
  await addDirectoryToZip(zip, sourceDir, sourceDir)
  zip.end()
  await done
}

async function addDirectoryToZip(zip: ZipFile, rootDir: string, currentDir: string): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name)
    const relativePath = toZipPath(relative(rootDir, absolutePath))

    if (!relativePath || relativePath.startsWith('../')) {
      throw new Error('Небезопасный путь внутри backup')
    }

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, rootDir, absolutePath)
      continue
    }

    if (entry.isFile()) {
      zip.addFile(absolutePath, relativePath)
    }
  }
}

function toZipPath(path: string): string {
  return path.split(sep).join('/')
}
