import { green } from '@/chalk'
import { logger } from '@/logger'
import chok from 'chokidar'
import esbuild from 'esbuild'
import { generateManifest } from './tools/generate-manifest'

const dev = Bun.argv.includes('--dev')
const prod = !dev

const buildContext = await esbuild.context({
  entryPoints: ['./src/speller.ts'],
  bundle: true,
  target: 'ES2020',
  minify: prod,
  outdir: './dist/chrome',
  // If true, `outputFiles` will be empty in `build.onEnd` callback
  write: false,
  sourcemap: dev,
  plugins: [
    {
      name: 'copy-to-firefox',
      setup(build) {
        build.onEnd(async (result) => {
          const { outputFiles } = result
          outputFiles?.map(async (file) => {
            const filename = file.path.split('/').pop()

            await Promise.all([
              Bun.write(`./dist/chrome/${filename}`, file.contents),
              Bun.write(`./dist/firefox/${filename}`, file.contents),
            ])
          })
        })
      },
    },
    {
      name: 'rebuild-notification',
      setup(build) {
        build.onEnd((result) => {
          logger.log(
            `${green('[bundled]')} ${result.errors.length} errors, ${result.warnings.length} warnings - ${new Date().toLocaleTimeString()}`
          )
        })
      },
    },
  ],
})

await generateManifest()

if (prod) {
  await buildContext.rebuild()
} else if (dev) {
  await buildContext.watch()
}
