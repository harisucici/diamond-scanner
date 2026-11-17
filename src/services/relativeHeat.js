// Relative list position is a ranking reference, not measured sales/popularity.
// Normalize within each source so a larger catalog does not always rank last.
export function sortByRelativeHeat(items) {
  const sourceOf = item => item._source || item.website || item.platform || ''
  const rankOf = item => {
    const rank = Number(item.rank)
    return Number.isInteger(rank) && rank > 0 ? rank : null
  }
  const maximumRanks = new Map()
  for (const item of items) {
    const rank = rankOf(item)
    if (rank !== null) maximumRanks.set(sourceOf(item), Math.max(maximumRanks.get(sourceOf(item)) || 0, rank))
  }
  const scored = items.map(item => {
    const rank = rankOf(item)
    const maximum = maximumRanks.get(sourceOf(item))
    const score = rank === null ? null : maximum === 1 ? 100 : 100 * (maximum - rank) / (maximum - 1)
    return { ...item, _heatScore: score, _sourceRank: rank }
  })
  return scored.sort((a, b) => {
    const scoreDifference = (b._heatScore ?? -1) - (a._heatScore ?? -1)
    if (Math.abs(scoreDifference) > 1e-9) return scoreDifference
    return (a._sourceRank ?? Infinity) - (b._sourceRank ?? Infinity)
      || sourceOf(a).localeCompare(sourceOf(b), 'en')
      || String(a.url || a.id || '').localeCompare(String(b.url || b.id || ''), 'en')
  })
}
