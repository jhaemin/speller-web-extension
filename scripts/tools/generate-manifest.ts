import { logger } from '@/logger'
import { manifest } from '@/manifest'
import type { Manifest } from 'webextension-polyfill'
import { biome } from './biome'

export async function generateManifest() {
  const chromeManifest = {
    ...manifest,
    minimum_chrome_version: '107',
    author: {
      email: 'io@jhaemin.com',
    },
  }

  const firefoxManifest = {
    ...manifest,
    browser_specific_settings: {
      gecko: {
        // TODO: Add Firefox-specific settings
        id: '',
        strict_min_version: '107',
        update_url: '',
      },
    },
  }

  const chromeManifestFormatted = biome.formatContent(
    JSON.stringify(chromeManifest),
    { filePath: 'manifest.json' }
  )
  const firefoxManifestFormatted = biome.formatContent(
    JSON.stringify(firefoxManifest),
    { filePath: 'manifest.json' }
  )

  await Promise.all([
    Bun.write('./dist/chrome/manifest.json', chromeManifestFormatted.content),
    Bun.write('./dist/firefox/manifest.json', firefoxManifestFormatted.content),
  ])

  logger.success('Generated manifest.json for Chrome and Firefox')
}
