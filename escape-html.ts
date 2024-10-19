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
