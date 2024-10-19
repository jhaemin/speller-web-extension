/**
 * A util function to run a function at document end
 */
export function runAtDocumentEnd(func: () => void) {
  if (typeof document === 'undefined') {
    console.warn(
      'runAtDocumentEnd: You are trying to run a function at document end in a wrong environment.'
    )
    return
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      func()
    })
  } else {
    func()
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function sugar(strings: TemplateStringsArray, ...values: any[]) {
  let str = ''
  strings.forEach((string, i) => {
    str += string + (values[i] || '')
  })
  return str
}

export const css = sugar
export const html = sugar

export function escapeHtml(html: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }

  return html.replace(/[&<>"']/g, (m) => map[m])
}
