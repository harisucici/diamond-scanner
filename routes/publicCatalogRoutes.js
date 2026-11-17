import { Router } from 'express'
import { createHash } from 'node:crypto'
import { PUBLIC_CATALOGS, fetchPublicCatalog } from '../services/publicCatalogs.js'

const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

// A single transaction ensures refresh failure cannot erase the previous snapshot.
export async function replaceCatalogMonth(client, table, month, items) {
  if (!Object.values(PUBLIC_CATALOGS).some(source => source.table === table)) throw new Error('Unknown table')
  if (!validMonth(month) || !items.length) throw new Error('Invalid month or empty catalog')
  const now = new Date().toISOString()
  const records = items.map(item => ({
    id: `${month}-${createHash('sha256').update(item.url).digest('hex').slice(0, 24)}`,
    month, rank: item.rank, productName: item.productName, brand: item.brand,
    price: item.price, currency: item.currency, condition: item.condition || '',
    imageUrl: item.imageUrl, url: item.url, created_at: now
  }))
  const statements = [{ sql: `DELETE FROM ${table} WHERE month = ?`, args: [month] }]
  for (const record of records) {
    const columns = Object.keys(record)
    statements.push({ sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, args: Object.values(record) })
  }
  await client.batch(statements, 'write')
  return records
}

export function createPublicCatalogRouter(sourceId, { getClient, fetchCatalog = fetchPublicCatalog }) {
  const router = Router()
  const source = PUBLIC_CATALOGS[sourceId]
  router.get('/months', async (req, res) => {
    try {
      const result = await getClient().execute(`SELECT DISTINCT month FROM ${source.table} ORDER BY month DESC`)
      res.json(result.rows.map(row => row.month))
    } catch (error) { res.status(500).json({ error: error.message }) }
  })
  router.get('/', async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    if (!validMonth(month)) return res.status(400).json({ error: '月份格式应为 YYYY-MM' })
    const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 500))
    try {
      const result = await getClient().execute({ sql: `SELECT * FROM ${source.table} WHERE month = ? ORDER BY rank LIMIT ?`, args: [month, limit] })
      res.json(result.rows)
    } catch (error) { res.status(500).json({ error: error.message }) }
  })
  let refreshing = false
  router.post('/refresh/:month', async (req, res) => {
    const { month } = req.params
    if (!validMonth(month)) return res.status(400).json({ success: false, error: '月份格式应为 YYYY-MM' })
    // Public pages contain current listings, not historical monthly data.
    if (month !== new Date().toISOString().slice(0, 7)) return res.status(400).json({ success: false, error: '只能抓取当月商品快照' })
    if (refreshing) return res.status(409).json({ success: false, error: '该来源正在刷新，请稍后重试' })
    refreshing = true
    try {
      const result = await fetchCatalog(sourceId)
      const items = await replaceCatalogMonth(getClient(), source.table, month, result.items)
      res.json({ success: true, count: items.length, month, platform: source.name, items })
    } catch (error) {
      res.status(502).json({ success: false, preserved: true, error: error.message })
    } finally { refreshing = false }
  })
  return router
}
