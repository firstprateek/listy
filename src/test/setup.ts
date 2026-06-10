import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no layout engine; give the virtualizer real-looking geometry.
// Viewport size is read from offsetWidth/offsetHeight, row measurement from
// getBoundingClientRect — stub both.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return this.classList.contains('scroller') ? 600 : 56
  },
})
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return 375
  },
})
Element.prototype.getBoundingClientRect = function () {
  const height = this.classList?.contains('scroller') ? 600 : 56
  return {
    width: 375,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: 375,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect
}

// jsdom implements neither element scrolling nor ResizeObserver.
Element.prototype.scrollTo = function (options?: ScrollToOptions | number) {
  this.scrollTop = typeof options === 'number' ? options : (options?.top ?? 0)
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
