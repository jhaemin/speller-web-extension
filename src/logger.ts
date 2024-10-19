import { blue, green, red, yellow } from './chalk'

export const logger = {
  log(...data: unknown[]) {
    console.log(...data)
  },

  success(message: string) {
    console.log(`${green('✔')} ${message}`)
  },

  ask(message: string) {
    console.log(`${blue('?')} ${message}`)
  },

  warning(message: string) {
    console.log(`${yellow('!')} ${message}`)
  },

  error(message: string) {
    console.log(`${red('✖')} ${message}`)
  },
}
