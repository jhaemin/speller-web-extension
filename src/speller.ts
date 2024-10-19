import browser from 'webextension-polyfill'
import { css, escapeHtml, html, runAtDocumentEnd } from './utils'

const icon = html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="width: 18px; height: 18px; color: color(display-p3 0.19 0.5 0.32); fill: none;"
  >
    <path d="M8 3H2v15h7c1.7 0 3 1.3 3 3V7c0-2.2-1.8-4-4-4Z" />
    <path d="m16 12 2 2 4-4" />
    <path d="M22 6V3h-6c-2.2 0-4 1.8-4 4v14c0-1.7 1.3-3 3-3h7v-2.3" />
  </svg>
`

runAtDocumentEnd(() => {
  let selectionChangeTimeout: number | null = null
  let clearPrevious: () => undefined

  document.addEventListener('selectionchange', () => {
    if (selectionChangeTimeout) {
      window.clearTimeout(selectionChangeTimeout)
    }

    clearPrevious?.()

    selectionChangeTimeout = window.setTimeout(() => {
      const selection = window.getSelection()

      if (!selection) return

      if (
        document
          .getElementById('speller-result')
          ?.contains(selection.anchorNode)
      ) {
        return
      }

      const selectionOnFormInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'

      const text = (() => {
        if (selectionOnFormInput) {
          const activeElement = document.activeElement as
            | HTMLInputElement
            | HTMLTextAreaElement
          return activeElement.value.substring(
            activeElement.selectionStart ?? 0,
            activeElement.selectionEnd ?? 0
          )
        }

        return selection.toString()
      })().trim()

      if (!text) {
        return
      }

      const tooltip = document.createElement('div')
      tooltip.id = 'speller-tooltip'

      tooltip.onmousedown = (e) => {
        e.preventDefault()
        e.stopPropagation()
      }

      let isProcessing = false

      tooltip.onclick = async (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (isProcessing) return

        isProcessing = true

        tooltip.innerHTML = ''
        tooltip.appendChild(makeSpinner())

        window.top?.postMessage({ type: 'speller-check', text })

        try {
          const result = await fetch('https://speller.town', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          })

          browser.runtime.sendMessage({
            action: 'speller-result',
            text,
            result,
          })
        } catch (error) {
          console.error(error)
        } finally {
          isProcessing = false
          tooltip.innerHTML = icon
        }
      }

      tooltip.innerHTML = icon

      const position = () => {
        if (selectionOnFormInput) {
          const input = document.activeElement as
            | HTMLInputElement
            | HTMLTextAreaElement
          const { x, y, width } = getCursorXY(
            input,
            input.selectionStart ?? 0,
            input.selectionEnd ?? 0
          )

          tooltip.style.top = `${y}px`
          tooltip.style.left = `${x + width}px`
        } else {
          const rect = selection.getRangeAt(0).getBoundingClientRect()

          tooltip.style.top = `${rect.top}px`
          tooltip.style.left = `${rect.left + rect.width}px`
        }
      }

      position()

      addTooltipStyleOnce()

      document.body.appendChild(tooltip)
      tooltip.getBoundingClientRect()
      tooltip.classList.add('show')

      const onResize = () => {
        position()
      }

      const onScroll = () => {
        position()
      }

      window.addEventListener('scroll', onScroll)
      window.addEventListener('resize', onResize)

      if (
        selectionOnFormInput &&
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        document.activeElement.addEventListener('scroll', onScroll)
      }

      clearPrevious = () => {
        tooltip.remove()
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onResize)
        document.activeElement?.removeEventListener('scroll', onScroll)
      }
    }, 200)
  })

  if (window.self === window.top) {
    browser.runtime.onMessage.addListener((message) => {
      const customMessage = message as {
        action?: 'speller-result'
        text: string
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        result: any
      }

      if (customMessage?.action !== 'speller-result') {
        return undefined
      }

      const { text, result } = customMessage

      let html = ''
      let offset = 0

      for (const suggestion of result.suggestions) {
        html += escapeHtml(text.slice(offset, suggestion.start))
        html += `<span style="background-color: #FFE770;">${escapeHtml(
          suggestion.candidates[0]
        )}</span>`
        offset = suggestion.end
      }

      html += text.slice(offset)
      html = html.replace(/\n/g, '<br>')

      const resultDiv = document.createElement('div')
      const resultSpan = document.createElement('span')
      const backgroundDiv = document.createElement('div')

      backgroundDiv.onclick = closeResult

      backgroundDiv.id = 'speller-result-background'

      resultDiv.id = 'speller-result'
      resultSpan.innerHTML = html

      if (result.suggestions.length > 0) {
        resultDiv.appendChild(resultSpan)
      } else {
        // No suggestions
        const noSuggestions = document.createElement('div')
        noSuggestions.textContent = '맞춤법 오류가 없습니다.'
        noSuggestions.style.color = '#808080'
        noSuggestions.style.textAlign = 'center'
        resultDiv.appendChild(noSuggestions)
      }

      const actions = document.createElement('div')
      actions.classList.add('speller-result-actions')
      const copyButton = document.createElement('button')
      copyButton.textContent = '복사'
      copyButton.onclick = () => {
        navigator.clipboard.writeText(resultSpan.innerText)
        closeResult()
      }
      const closeButton = document.createElement('button')
      closeButton.textContent = '닫기'
      closeButton.onclick = closeResult

      actions.appendChild(copyButton)
      actions.appendChild(closeButton)

      resultDiv.appendChild(actions)

      addResultStyleOnce()

      document.body.appendChild(backgroundDiv)
      document.body.appendChild(resultDiv)

      resultDiv.getBoundingClientRect()

      backgroundDiv.classList.add('show')
      resultDiv.classList.add('show')

      window.addEventListener('keydown', onKeyDown)

      function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          closeResult()
          window.removeEventListener('keydown', onKeyDown)
        }
      }

      function closeResult() {
        const background = document.getElementById('speller-result-background')
        const result = document.getElementById('speller-result')

        if (background) {
          background.classList.remove('show')

          setTimeout(() => {
            background.remove()
          }, 200)
        }

        if (result) {
          result.classList.remove('show')

          setTimeout(() => {
            result.remove()
          }, 300)
        }
      }
    })
  }
})

const getCursorXY = (
  input: HTMLInputElement | HTMLTextAreaElement,
  selectionStart: number,
  selectionEnd: number
) => {
  const div = document.createElement('div')
  const copyStyle = getComputedStyle(input)
  for (const prop of copyStyle) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    div.style[prop as any] = copyStyle[prop as any]
  }
  div.style.width = copyStyle.width
  div.style.minWidth = copyStyle.width
  div.style.maxWidth = copyStyle.width
  div.style.height = 'auto'

  const swap = '.'
  const inputValue =
    input.tagName === 'INPUT' ? input.value.replace(/ /g, swap) : input.value
  const textContent = inputValue.substring(0, selectionStart)
  div.textContent = textContent
  if (input.tagName === 'TEXTAREA') div.style.height = 'auto'
  if (input.tagName === 'INPUT') div.style.width = 'auto'
  const selectedPartSpan = document.createElement('span')
  selectedPartSpan.textContent =
    inputValue.substring(selectionStart, selectionEnd) || '.'
  div.appendChild(selectedPartSpan)
  const restSpan = document.createElement('span')
  restSpan.textContent = inputValue.substring(selectionEnd) || '.'
  div.appendChild(restSpan)

  const inputRect = input.getBoundingClientRect()

  div.style.position = 'fixed'
  div.style.top = `${inputRect.top - input.scrollTop}px`
  div.style.left = `${inputRect.left}px`

  document.body.appendChild(div)

  const spanRect = selectedPartSpan.getBoundingClientRect()
  const spanX = spanRect.left
  const spanY = spanRect.top
  const spanWidth = spanRect.width
  const spanHeight = spanRect.height

  document.body.removeChild(div)

  return {
    x: spanX,
    y: spanY,
    width: spanWidth,
    height: spanHeight,
  }
}

function makeSpinner() {
  const spinner = document.createElement('div')
  spinner.className = 'spinner'
  spinner.innerHTML = html`
    <div class="spinner__bar1"></div>
    <div class="spinner__bar2"></div>
    <div class="spinner__bar3"></div>
    <div class="spinner__bar4"></div>
    <div class="spinner__bar5"></div>
    <div class="spinner__bar6"></div>
    <div class="spinner__bar7"></div>
    <div class="spinner__bar8"></div>
  `
  return spinner
}

function addTooltipStyleOnce() {
  if (!document.getElementById('speller-style')) {
    const style = document.createElement('style')
    style.id = 'speller-style'
    style.textContent = css`
      #speller-tooltip {
        position: fixed;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        background-color: #fff;
        color: #000;
        font-size: 14px;
        line-height: 1.4;
        margin: 0;
        padding: 0;
        width: 30px;
        height: 30px;
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2),
          0 1px 8px -1px rgba(0, 0, 0, 0.2);
        white-space: nowrap;
        transform: translate(-100%, calc(-100% - 4px));
        z-index: 9999999997;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.1s ease,
          background-color 0.1s ease;
      }

      #speller-tooltip.show {
        opacity: 1;
      }

      #speller-tooltip:hover {
        background-color: #f4fbf6;
      }

      #speller-tooltip:active {
        transform: translate(-100%, calc(-100% - 4px)) scale(0.92);
      }

      div.spinner {
        position: relative;
        width: 18px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      div.spinner div {
        width: 10%;
        height: 25%;
        background: #808080;
        position: absolute;
        left: 46%;
        top: 37%;
        opacity: 0;
        -webkit-border-radius: 50px;
        border-radius: 50px;
        -webkit-box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
        -webkit-animation: fade 1s linear infinite;
        animation: fade 1s linear infinite;
      }

      @keyframes fade {
        from {
          opacity: 1;
        }
        to {
          opacity: 0.25;
        }
      }

      div.spinner div.spinner__bar1 {
        transform: rotate(0deg) translate(0, -130%);
        animation-delay: 0s;
      }

      div.spinner div.spinner__bar2 {
        transform: rotate(45deg) translate(0, -130%);
        animation-delay: -0.875s;
      }

      div.spinner div.spinner__bar3 {
        transform: rotate(90deg) translate(0, -130%);
        animation-delay: -0.75s;
      }
      div.spinner div.spinner__bar4 {
        transform: rotate(135deg) translate(0, -130%);
        animation-delay: -0.625s;
      }
      div.spinner div.spinner__bar5 {
        transform: rotate(180deg) translate(0, -130%);
        animation-delay: -0.5s;
      }
      div.spinner div.spinner__bar6 {
        transform: rotate(225deg) translate(0, -130%);
        animation-delay: -0.375s;
      }
      div.spinner div.spinner__bar7 {
        transform: rotate(270deg) translate(0, -130%);
        animation-delay: -0.25s;
      }
      div.spinner div.spinner__bar8 {
        transform: rotate(315deg) translate(0, -130%);
        animation-delay: -0.125s;
      }
    `
    document.head.appendChild(style)
  }
}

function addResultStyleOnce() {
  if (!document.getElementById('speller-result-style')) {
    const style = document.createElement('style')
    style.id = 'speller-result-style'
    style.textContent = css`
      #speller-result-background {
        position: fixed;
        z-index: 9999999998;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.3);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      #speller-result-background.show {
        opacity: 1;
      }

      #speller-result {
        display: flex;
        flex-direction: column;
        gap: 20px;
        position: fixed;
        z-index: 9999999999;
        border-radius: 10px;
        left: 50%;
        bottom: 0;
        width: calc(100% - 80px);
        max-width: 500px;
        max-height: calc(100% - 80px);
        overflow-y: auto;
        color: #222;
        background-color: #fff;
        padding: 18px 20px;
        font-size: 15px;
        font-family: system-ui, sans-serif;
        line-height: 1.4;
        line-break: anywhere;
        transform: translateX(-50%) translateY(calc(100% + 20px));
        user-select: text;
        transition: transform 0.3s cubic-bezier(0.54, 0.25, 0.12, 0.99),
          box-shadow 0.3s cubic-bezier(0.54, 0.25, 0.12, 0.99);
      }

      #speller-result.show {
        transform: translateX(-50%) translateY(-40px);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2),
          0 8px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1);
      }

      .speller-result-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: flex-end;
      }

      .speller-result-actions button {
        background-color: #f0f0f3;
        line-height: 1;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 14px;
        user-select: none;
        border: none;
        appearance: none;
        cursor: default;
        transition: background-color 0.1s ease;
      }

      .speller-result-actions button:hover {
        background-color: #e8e8ec;
      }

      .speller-result-actions button:active {
        background-color: #d9d9e0;
      }
    `
    document.head.appendChild(style)
  }
}
