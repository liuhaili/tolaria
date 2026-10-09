import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const version = '32.4.1'
const installRevision = `${version}-tolaria1`
const sha256 = 'b83663313ccdecef6581476a7eaa96750bccf1bfdc3768981eb5d95e94be7820'
const destination = resolve('public/drawio')
const marker = resolve(destination, '.version')
const policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'"
const allowed = /^(index\.html|export-fonts\.css|favicon\.ico|js\/|styles\/|images\/|img\/|mxgraph\/|resources\/|shapes\/|stencils\/|templates\/|math4\/)/

function extractArchive(archive) {
  let end = archive.length - 22
  while (end >= 0 && archive.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Missing ZIP directory')
  let position = archive.readUInt32LE(end + 16)
  const count = archive.readUInt16LE(end + 10)
  for (let index = 0; index < count; index++) {
    if (archive.readUInt32LE(position) !== 0x02014b50) throw new Error('Invalid ZIP entry')
    const nameLength = archive.readUInt16LE(position + 28)
    const name = archive.subarray(position + 46, position + 46 + nameLength).toString('utf8')
    if (allowed.test(name) && !name.endsWith('/')) extractEntry(archive, position, name)
    position += 46 + nameLength + archive.readUInt16LE(position + 30) + archive.readUInt16LE(position + 32)
  }
}

function extractEntry(archive, position, name) {
  if (name.split('/').some(segment => segment === '..') || name.includes('\\')) throw new Error('Unsafe ZIP path')
  const local = archive.readUInt32LE(position + 42)
  const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28)
  const compressed = archive.subarray(start, start + archive.readUInt32LE(position + 20))
  const method = archive.readUInt16LE(position + 10)
  if (method !== 0 && method !== 8) throw new Error('Unsupported ZIP compression')
  let bytes = method === 8 ? inflateRawSync(compressed) : compressed
  if (name === 'index.html') {
    bytes = Buffer.from(bytes.toString('utf8').replace('<head>', `<!-- Modified by Tolaria: offline-only Content Security Policy. -->\n<head><meta http-equiv="Content-Security-Policy" content="${policy}">`))
  }
  const target = resolve(destination, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
}

if (!existsSync(marker) || readFileSync(marker, 'utf8') !== installRevision) {
  const archive = process.argv[2] ? readFileSync(process.argv[2]) : Buffer.from(await (await fetch(
    `https://github.com/jgraph/drawio/releases/download/v${version}/draw.war`,
  )).arrayBuffer())
  if (createHash('sha256').update(archive).digest('hex') !== sha256) throw new Error('draw.io archive checksum mismatch')
  extractArchive(archive)
  writeFileSync(resolve(destination, 'LICENSE'), readFileSync('third_party/drawio/LICENSE'))
  writeFileSync(resolve(destination, 'NOTICE'), 'draw.io 32.4.1 — Copyright JGraph Holdings Ltd and draw.io AG. Apache-2.0.\nTolaria modifies index.html to add an offline-only CSP.\nSource: https://github.com/jgraph/drawio/tree/v32.4.1\n')
  writeFileSync(marker, installRevision)
  console.log(`Installed offline draw.io ${version}`)
}
