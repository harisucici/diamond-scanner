import { describe, expect, it } from 'vitest'
import { sortByRelativeHeat } from '../src/services/relativeHeat.js'

describe('relative heat across selected sources', () => {
  const items = [
    { id: 'a3', _source: 'A', rank: 3, price: 999999, sales: 999999 },
    { id: 'a1', _source: 'A', rank: 1 },
    { id: 'a2', _source: 'A', rank: 2 },
    { id: 'b5', _source: 'B', rank: 5 },
    { id: 'b1', _source: 'B', rank: 1 },
    { id: 'b2', _source: 'B', rank: 2 },
    { id: 'b3', _source: 'B', rank: 3 },
    { id: 'b4', _source: 'B', rank: 4 }
  ]
  it('mixes catalogs by normalized rank regardless of catalog size, price or sales', () => {
    const sorted = sortByRelativeHeat(items)
    expect(sorted.map(item => item.id)).toEqual(['a1', 'b1', 'b2', 'a2', 'b3', 'b4', 'a3', 'b5'])
    expect(sorted.map(item => item._heatScore)).toEqual([100, 100, 75, 50, 50, 25, 0, 0])
    expect(items[0].id).toBe('a3')
    expect(items[0]._heatScore).toBeUndefined()
  })
  it('keeps the remaining order and scores when a source is deselected', () => {
    const onlyB = sortByRelativeHeat(items.filter(item => item._source === 'B'))
    expect(onlyB.map(item => [item.id, item._heatScore])).toEqual(sortByRelativeHeat(items).filter(item => item._source === 'B').map(item => [item.id, item._heatScore]))
  })
  it('keeps missing or invalid ranks at the end instead of inventing popularity', () => {
    const result = sortByRelativeHeat([{ id: 'missing', _source: 'A' }, { id: 'zero', _source: 'A', rank: 0 }, { id: 'one', _source: 'A', rank: 1 }, { id: 'bad', _source: 'A', rank: 'bad' }])
    expect(result[0]).toMatchObject({ id: 'one', _heatScore: 100 })
    expect(result.slice(1).every(item => item._heatScore === null)).toBe(true)
  })
  it('uses deterministic tie breaks independent of request completion order', () => {
    expect(sortByRelativeHeat(items).map(item => item.id)).toEqual(sortByRelativeHeat([...items].reverse()).map(item => item.id))
  })
})
