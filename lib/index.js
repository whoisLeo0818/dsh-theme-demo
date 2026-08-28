// dsh-theme-demo, node half.
//
// Required Notice: Copyright (c) 2025 whoisLeo0818
// Licensed under PolyForm Noncommercial 1.0.0 — demonstration only, not for
// commercial use. See LICENSE.
//
// Serves this package's own asset directory over one prefix route so the browser
// half can reference the background image by URL.
//
// The dynamic prototype had to base64-encode the image through a private RPC,
// because a page cannot fetch file:// URLs and the image lived in the user's
// workspace. A packaged plugin owns its assets, so the bytes travel as an
// ordinary cacheable HTTP response instead of a multi-megabyte data URL rebuilt
// on every activation.
//
// The shipped frontend-static plugin holds the single webserver fallback seat
// and only serves files under the frontend dist root, so a plugin asset needs
// its own named route rather than a place in that tree.

import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Stable Cordis plugin name. */
export const name = 'theme-demo'

/** The asset route needs the HTTP carrier. */
export const inject = ['webServer']

/** Absolute path of the asset directory shipped inside this package. */
const ASSET_ROOT = resolve(fileURLToPath(new URL('../assets/', import.meta.url)))

/**
 * Route prefix the browser half builds its URLs from.
 *
 * This string is duplicated in lib/client.js, which cannot import from the node
 * half. The two must stay identical: a mismatch produces no error, just a
 * silently missing background.
 */
const ROUTE = '/dsh-theme-demo/assets'

// Only the image types this theme ships. An unknown extension is refused rather
// than sent as octet-stream: the browser would not render it anyway, and a
// narrow allowlist keeps the route from turning into a general file server.
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const MISS_CODES = new Set(['ENOENT', 'EISDIR', 'ENOTDIR'])

/**
 * Claim the asset route.
 * @param ctx - plugin context carrying the webServer service.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }

      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      const relative = decodeURIComponent(pathname.slice(ROUTE.length))
      const target = resolve(normalize(join(ASSET_ROOT, relative)))

      // Containment is checked on the resolved path, so no amount of ".." or
      // encoding in the request can reach outside the asset directory.
      if (target !== ASSET_ROOT && !target.startsWith(ASSET_ROOT + sep)) {
        res.writeHead(403)
        res.end()
        return
      }

      const type = MIME[extname(target).toLowerCase()]
      if (type === undefined) {
        res.writeHead(404)
        res.end()
        return
      }

      let body
      try {
        body = await readFile(target)
      } catch (error) {
        // A genuine I/O fault must not be reported as a missing file.
        if (!MISS_CODES.has(error.code)) throw error
        res.writeHead(404)
        res.end()
        return
      }

      // The asset is immutable for the lifetime of an installed version, so it
      // is safe to let the browser keep it instead of refetching megabytes on
      // every page load.
      res.writeHead(200, {
        'content-type': type,
        'cache-control': 'public, max-age=604800, immutable',
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), 'theme-demo: asset route')
}
