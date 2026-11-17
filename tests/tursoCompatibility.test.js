import { afterAll, expect, it, vi } from 'vitest'
import { getClient, initTables, insertData, queryData, deleteData, TABLES } from '../db/turso.js'

vi.stubEnv('TURSO_DATABASE_URL', 'file::memory:')
vi.stubEnv('TURSO_AUTH_TOKEN', 'local-test')
afterAll(() => { getClient().close(); vi.unstubAllEnvs() })

it('supports upstream social storage without allowing unfiltered product deletion', async () => {
  await initTables()
  await insertData(TABLES.SOCIAL_TIKTOK, { id: '1', author: 'user', url: 'https://www.tiktok.com/@user/video/1', platform: 'tiktok', addedAt: '2026-11-17' })
  expect(await queryData(TABLES.SOCIAL_TIKTOK)).toHaveLength(1)
  await deleteData(TABLES.SOCIAL_TIKTOK)
  expect(await queryData(TABLES.SOCIAL_TIKTOK)).toHaveLength(0)
  await insertData(TABLES.SOCIAL_SUMMARY, { id: 'summary', content: 'Saved summary', updated_at: '2026-11-17' })
  expect((await queryData(TABLES.SOCIAL_SUMMARY))[0].content).toBe('Saved summary')
  await expect(deleteData(TABLES.ALLU_PRODUCTS)).rejects.toThrow('需要指定条件')
})
