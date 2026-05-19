/**
 * LanceDB 初始化脚本
 * 用法: node scripts/init-lancedb.js
 */

import { getDb, initTables, getStats, TABLES } from '../db/lancedb.js'

console.log('🚀 开始初始化 LanceDB 数据库...\n')

try {
  // 初始化连接
  const db = await getDb()
  console.log('✅ LanceDB 连接成功\n')
  
  // 初始化所有表
  await initTables()
  console.log('')
  
  // 显示统计信息
  const stats = await getStats()
  console.log('📊 数据库统计:')
  for (const [table, count] of Object.entries(stats)) {
    console.log(`   ${table}: ${count} 条记录`)
  }
  
  // 显示所有表名
  const tableNames = await db.tableNames()
  console.log(`\n📋 已有表: ${tableNames.join(', ')}`)
  
  console.log('\n✅ LanceDB 初始化完成!')
  process.exit(0)
} catch (error) {
  console.error('❌ 初始化失败:', error)
  process.exit(1)
}
