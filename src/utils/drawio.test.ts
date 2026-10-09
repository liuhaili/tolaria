import { describe, expect, it } from 'vitest'
import { EMPTY_DIAGRAM, parseDrawioEvent, isDiagramPath, diagramFileStem } from './drawio'

describe('offline drawio bridge', () => {
  it('keeps Chinese names while rejecting unsafe filename characters', () => {
    expect(diagramFileStem('登录流程')).toBe('登录流程')
    expect(diagramFileStem('../a:b')).toBe('..-a-b')
    expect(diagramFileStem('CON')).toBe('CON-diagram')
    expect(diagramFileStem('...')).toBe('diagram')
  })
  it('recognizes only editable diagram files', () => {
    expect(isDiagramPath('C:\\notes\\flow.DRAWIO')).toBe(true)
    expect(isDiagramPath('/notes/flow.svg')).toBe(false)
    expect(isDiagramPath('/notes/flow.drawio.md')).toBe(false)
  })
  it('accepts init and valid diagram saves', () => {
    expect(parseDrawioEvent('{"event":"init"}')).toEqual({ event: 'init' })
    expect(parseDrawioEvent(JSON.stringify({ event: 'save', xml: EMPTY_DIAGRAM })))
      .toEqual({ event: 'save', xml: EMPTY_DIAGRAM })
  })
  it('rejects malformed messages, non-diagrams and external entities', () => {
    for (const message of ['broken', 'null', '{"event":"save","xml":"<html/>"}',
      '{"event":"save","xml":"<!DOCTYPE mxfile><mxfile/>"}', '{"event":"unknown"}']) {
      expect(parseDrawioEvent(message)).toBeNull()
    }
  })
})
