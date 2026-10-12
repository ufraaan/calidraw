import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const KEEP_LINE = /@vitest-environment|@ts-expect-error|@ts-ignore|@ts-nocheck|eslint-|prettier-|@jsx|\/ <reference/

function shouldKeepLineComment(body) {
  return KEEP_LINE.test(body)
}

function strip(code) {
  let out = ''
  let i = 0
  const n = code.length

  const peek = (k = 0) => code[i + k]
  const startsWith = (s) => code.slice(i, i + s.length) === s

  while (i < n) {
    const c = code[i]
    const next = peek(1)

    if (c === '"' || c === "'") {
      const q = c
      out += c
      i++
      while (i < n) {
        out += code[i]
        if (code[i] === '\\') {
          i++
          if (i < n) out += code[i]
          i++
          continue
        }
        if (code[i] === q) {
          i++
          break
        }
        i++
      }
      continue
    }

    if (c === '`') {
      out += c
      i++
      while (i < n) {
        if (code[i] === '\\') {
          out += code[i]
          i++
          if (i < n) out += code[i]
          i++
          continue
        }
        if (code[i] === '`') {
          out += '`'
          i++
          break
        }
        if (code[i] === '$' && peek(1) === '{') {
          out += '${'
          i += 2
          let depth = 1
          while (i < n && depth > 0) {
            if (code[i] === '"' || code[i] === "'") {
              const q = code[i]
              out += q
              i++
              while (i < n) {
                out += code[i]
                if (code[i] === '\\') {
                  i++
                  if (i < n) out += code[i]
                } else if (code[i] === q) {
                  i++
                  break
                }
                i++
              }
              continue
            }
            if (code[i] === '`') {
              const inner = strip('`' + code.slice(i + 1))
              const end = inner.indexOf('NOPE')
              void end
            }
            if (code[i] === '{') depth++
            if (code[i] === '}') {
              depth--
              if (depth === 0) {
                out += '}'
                i++
                break
              }
            }
            if (code[i] === '/' && peek(1) === '/') {
              const start = i
              while (i < n && code[i] !== '\n') i++
              const body = code.slice(start, i)
              if (shouldKeepLineComment(body)) out += body
              continue
            }
            if (code[i] === '/' && peek(1) === '*') {
              i += 2
              while (i < n && !(code[i] === '*' && peek(1) === '/')) i++
              i += 2
              continue
            }
            out += code[i]
            i++
          }
          continue
        }
        out += code[i]
        i++
      }
      continue
    }

    if (c === '/' && next === '/') {
      const start = i
      while (i < n && code[i] !== '\n') i++
      const body = code.slice(start, i)
      if (shouldKeepLineComment(body)) out += body
      continue
    }

    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(code[i] === '*' && peek(1) === '/')) i++
      i += 2
      continue
    }

    if (c === '{' && startsWith('{/*')) {
      i += 2
      while (i < n && !(code[i] === '*' && peek(1) === '/' && peek(2) === '}')) i++
      i += 3
      continue
    }

    out += c
    i++
  }

  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx|css)$/.test(ent.name) && ent.name !== 'routeTree.gen.ts') acc.push(p)
  }
  return acc
}

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8')
  const next = strip(src)
  if (next !== src) fs.writeFileSync(file, next)
}

const extras = ['index.html', 'vite.config.ts']
for (const rel of extras) {
  const file = path.resolve(rel)
  if (!fs.existsSync(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, strip(src))
}

console.log('stripped comments')
