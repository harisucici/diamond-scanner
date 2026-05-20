/**
 * 语言检测工具
 * 通过 Unicode 范围和字符统计检测文本的主要语言
 */

/**
 * 检测文本的主要语言
 * @param {string} text - 待检测文本
 * @returns {string} 语言代码: 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'unknown'
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'unknown'

  const chars = text.replace(/[\s\d\p{P}]/gu, '') // 去掉空格、数字、标点
  if (chars.length === 0) return 'unknown'

  let zhCount = 0   // 中文字符 (CJK统一汉字，排除日文假名)
  let jaCount = 0   // 日文字符 (平假名 + 片假名)
  let koCount = 0   // 韩文字符
  let latinCount = 0 // 拉丁字母

  for (const ch of chars) {
    const code = ch.codePointAt(0)

    // 平假名: U+3040-U+309F
    if (code >= 0x3040 && code <= 0x309F) { jaCount++; continue }
    // 片假名: U+30A0-U+30FF
    if (code >= 0x30A0 && code <= 0x30FF) { jaCount++; continue }
    // 日文符号延展: U+31F0-U+31FF, U+FF65-U+FF9F (半角假名)
    if ((code >= 0x31F0 && code <= 0x31FF) || (code >= 0xFF65 && code <= 0xFF9F)) { jaCount++; continue }

    // 韩文字母: U+AC00-U+D7AF (韩文音节), U+1100-U+11FF (韩文字母)
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) { koCount++; continue }

    // CJK统一汉字: U+4E00-U+9FFF（中日韩共用，需结合假名判断）
    if (code >= 0x4E00 && code <= 0x9FFF) { zhCount++; continue }
    // CJK扩展A: U+3400-U+4DBF
    if (code >= 0x3400 && code <= 0x4DBF) { zhCount++; continue }

    // 拉丁字母 (基本拉丁 + 拉丁扩展)
    if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) { latinCount++; continue }
  }

  // 判断逻辑：如果存在日文假名，即使有汉字也倾向判断为日文
  if (jaCount > 0 && jaCount >= zhCount * 0.3) return 'ja'
  if (koCount > 0 && koCount >= zhCount * 0.5) return 'ko'
  if (zhCount > 0 && zhCount > latinCount) return 'zh'
  if (latinCount > 0 && latinCount > zhCount) {
    // 简单区分西欧语言（默认返回 en，可根据需要扩展）
    return 'en'
  }
  if (zhCount > 0) return 'zh'

  return 'unknown'
}

/**
 * 多语言提示文本映射
 */
export const i18n = {
  // 产品上下文提示
  productContextHeader: {
    zh: '\n\n【重要：当前库存中的相关产品】\n以下是系统通过语义搜索从所有品类中为您匹配的产品，你必须在回答中只从这些产品中选择推荐，不可编造其他产品：\n\n',
    en: '\n\n【Important: Related products in current inventory】\nHere are the products matched via semantic search across all categories. You MUST only recommend from these products and never fabricate others:\n\n',
    ja: '\n\n【重要：現在の在庫にある関連製品】\nセマンティック検索により全カテゴリからマッチングされた製品です。以下の製品からのみ推奨し、絶対に他の製品をでっち上げないでください：\n\n',
  },
  // 无产品提示
  noProductContext: {
    zh: '\n\n【注意】当前库存中没有找到完全匹配的产品，请根据用户需求提供一般性建议，并告知可以记录需求或推荐相似品类。',
    en: '\n\n【Note】No matching products found in current inventory. Please provide general advice based on the user\'s needs and inform them that their requirements can be recorded or similar categories can be recommended.',
    ja: '\n\n【注意】現在の在庫に完全に一致する製品が見つかりませんでした。ユーザーのニーズに基づいて一般的なアドバイスを提供し、要望を記録できることや類似カテゴリを推奨できることをお伝えください。',
  },
  // 回答要求
  answerRequirements: {
    zh: '\n\n【回答要求】\n1. 根据用户需求，从上述产品列表中选择最合适的进行推荐\n2. 必须说明产品的品牌、名称、价格和来源\n3. 如果有购买链接，提醒用户点击产品卡片查看详情\n4. 如果没有合适产品，诚实告知并提供替代建议',
    en: '\n\n【Answer Requirements】\n1. Select the most suitable products from the above list to recommend based on user needs\n2. Must include the product brand, name, price, and source\n3. If purchase links are available, remind the user to click the product card for details\n4. If no suitable products are found, be honest and provide alternative suggestions',
    ja: '\n\n【回答要件】\n1. ユーザーのニーズに基づいて、上記の製品リストから最適なものを推奨してください\n2. 製品のブランド、名前、価格、ソースを必ず記載してください\n3. 購入リンクがある場合は、製品カードをクリックして詳細を確認するようユーザーに促してください\n4. 適切な製品がない場合は、正直に伝え、代替案を提供してください',
  },
  // 品类识别 prompt
  categoryPrompt: {
    zh: (categories) => `你是一个珠宝品类识别助手。根据用户的问题，从以下可选品类中选择最匹配的一个品类。

【可选品类】
${categories.map(c => `- ${c.name_zh || c.name_en} (${c.name_en})`).join('\n')}

【回答要求】
- 只回答一个品类名称（英文name_en）
- 如果无法确定，回答 "unknown"
- 不要解释，不要多余文字`,
    en: (categories) => `You are a jewelry category identification assistant. Based on the user's question, select the most matching category from the following options.

【Available Categories】
${categories.map(c => `- ${c.name_en} (${c.name_zh || c.name_en})`).join('\n')}

【Answer Requirements】
- Answer with only one category name (English name_en)
- If uncertain, answer "unknown"
- No explanations, no extra text`,
    ja: (categories) => `あなたはジュエリーカテゴリ識別アシスタントです。ユーザーの質問に基づいて、以下のオプションから最も一致するカテゴリを選択してください。

【選択可能なカテゴリ】
${categories.map(c => `- ${c.name_zh || c.name_en} (${c.name_en})`).join('\n')}

【回答要件】
- カテゴリ名を1つだけ回答してください（英語のname_en）
- 不確かな場合は「unknown」と回答してください
- 説明や余分なテキストは不要です`,
  }
}

/**
 * 获取多语言文本，fallback 到英文再 fallback 到中文
 */
export function getI18nText(map, lang) {
  return map[lang] || map.en || map.zh || Object.values(map)[0] || ''
}
