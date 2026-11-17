import { afterEach, describe, expect, it } from 'vitest'
import express from 'express'
import { createClient } from '@libsql/client'
import { parseCatalog, fetchPublicCatalog } from '../services/publicCatalogs.js'
import { createPublicCatalogRouter, replaceCatalogMonth } from '../routes/publicCatalogRoutes.js'

const item = { rank: 1, productName: 'Real necklace', brand: 'Mejuri', price: 4500, currency: 'TWD', url: 'https://mejuri.com/tw/en/products/necklace', imageUrl: '' }
const month = new Date().toISOString().slice(0, 7)
const clients = []
const servers = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
  clients.splice(0).forEach(client => client.close())
})
async function database() {
  const client = createClient({ url: 'file::memory:' })
  clients.push(client)
  await client.execute(`CREATE TABLE mejuri_products (id TEXT PRIMARY KEY, month TEXT, rank INTEGER, productName TEXT NOT NULL, brand TEXT, price REAL CHECK(price > 0), currency TEXT, condition TEXT, imageUrl TEXT, url TEXT, created_at TEXT)`)
  return client
}
async function serve(client, fetchCatalog) {
  const app = express()
  app.use('/api/mejuri', createPublicCatalogRouter('mejuri', { getClient: () => client, fetchCatalog }))
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}/api/mejuri`
}

describe('Free public catalogs', () => {
  it('extracts ALLU fields, decodes names and deduplicates links', () => {
    const card = `<a href="/jp/ja/market/items/123/"><img src="https://image.nanboya.com/test.jpg"><p class="p-productsSimilar__info__ttl">ヴァンクリーフ&amp;アーペル ネックレス</p><p class="p-productsSimilar__info__price">¥729,000</p></a>`
    const result = parseCatalog('allu', card + card)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ productName: 'ヴァンクリーフ&アーペル ネックレス', price: 729000, currency: 'JPY', brand: 'Van Cleef & Arpels', rank: 1 })
    expect(result[0].url).toBe('https://allu-official.com/jp/ja/market/items/123/')
  })
  it('reads Mejuri TWD and ignores cards without a real price', () => {
    const html = `<div data-testid="product-card"><a aria-label="Necklace" href="/tw/en/products/necklace"></a><span data-testid="sale-price">NT$4,500</span></div><div data-testid="product-card"><a aria-label="Broken" href="/tw/en/products/broken"></a></div>`
    expect(parseCatalog('mejuri', html)).toEqual([expect.objectContaining({ productName: 'Necklace', currency: 'TWD', price: 4500 })])
  })
  it('rejects blocked, empty and wrong-region responses', async () => {
    await expect(fetchPublicCatalog('mejuri', { fetchImpl: async () => new Response('blocked', { status: 429 }) })).rejects.toThrow('HTTP 429')
    await expect(fetchPublicCatalog('mejuri', { fetchImpl: async () => new Response('<title>Challenge</title>') })).rejects.toThrow('未解析到商品')
    await expect(fetchPublicCatalog('mejuri', { fetchImpl: async () => ({ ok: true, url: 'https://mejuri.com/us/en/collections/necklaces' }) })).rejects.toThrow('地区跳转')
  })
  it('rolls back deletion when insertion fails, and refuses empty replacements', async () => {
    const client = await database()
    await replaceCatalogMonth(client, 'mejuri_products', month, [item])
    await expect(replaceCatalogMonth(client, 'mejuri_products', month, [{ ...item, price: -1 }])).rejects.toThrow()
    await expect(replaceCatalogMonth(client, 'mejuri_products', month, [])).rejects.toThrow()
    expect((await client.execute('SELECT price FROM mejuri_products')).rows[0].price).toBe(4500)
  })
  it('refreshes, lists and reads months; failed refresh preserves the snapshot', async () => {
    const client = await database()
    let fail = false
    const base = await serve(client, async () => { if (fail) throw new Error('HTTP 429'); return { items: [item] } })
    const refresh = await fetch(`${base}/refresh/${month}`, { method: 'POST' })
    expect(refresh.status).toBe(200)
    expect((await refresh.json()).count).toBe(1)
    expect(await (await fetch(`${base}/months`)).json()).toEqual([month])
    fail = true
    const blocked = await fetch(`${base}/refresh/${month}`, { method: 'POST' })
    expect(blocked.status).toBe(502)
    expect((await blocked.json()).preserved).toBe(true)
    expect(await (await fetch(`${base}?month=${month}`)).json()).toEqual([expect.objectContaining({ productName: item.productName, price: 4500 })])
    expect((await fetch(`${base}?month=bad`)).status).toBe(400)
  })
})
