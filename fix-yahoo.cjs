const fs = require('fs');

// 读取文件
let content = fs.readFileSync('server.js', 'utf8');

// 找到函数并替换
const oldFunc = `const fetchYahooAuctionData = async (keyword = 'アクセサリー') => {
  try {
    const url = \`https://auctions.yahoo.co.jp/search/search?p=\${encodeURIComponent(keyword)}&n=30&s=jun\`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // Yahoo!Auction商品匹配
    const patterns = [
      new RegExp('href="(//auctions\\\\.yahoo\\\\.co\\\\.jp/item/[^"]+)"[^>]*>[\\\\s\\\\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\\\\s\\\\S]*?class="[^"]*price[^"]*"[^>]*>(\\\\d[,\\\\d]*)', 'g'),
      /data-auction-id="([^"]+)"[^>]*>[\\\\s\\\\S]*?class="[^"]*Product[^"]*"[^>]*>([^<]+)<[\\\\s\\\\S]*?(\\\\d[,\\\\d]*)\\\\s*円/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const url = match[1] || ''
        const productName = match[2].trim()
        const price = parseInt(match[3].replace(/\\\\D/g, ''))
        if (!items.find(i => i.productName === productName) && price > 0) {
          items.push({ 
            rank: rank++, 
            productName, 
            brand: 'OTHER', 
            price, 
            category: 'accessories', 
            url: url ? \`https:\${url}\` : '' 
          })
        }
      }
    }
    
    console.log(\`Yahoo!拍賣爬取: 获取\${items.length}条数据\`)
    return { items, html }
  } catch (error) {
    console.error('Yahoo!拍賣爬取失败:', error.message)
    return { items: [], html: '' }
  }
}`;

const newFunc = `const fetchYahooAuctionData = async (keyword = 'アクセサリー') => {
  try {
    const url = \`https://auctions.yahoo.co.jp/search/search?p=\${encodeURIComponent(keyword)}&n=30&s=jun\`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      }
    })
    
    const html = await response.text()
    const items = []
    let rank = 1
    
    // 从HTML中提取商品数据 - 基于实际HTML结构调整
    const patterns = [
      /href="(\\/item\\/[^\"]+)"[^>]*>[\\\\s\\\\S]*?<span[^>]*class="Product__price[^\"]*"[^>]*>(\\\\d[,\\\\d]*)/g,
      /href="(https?:\\\\/\\\\/auctions\\\\.yahoo\\\\.co\\\\.jp\\\\/item\\\\/[^#\"]+)"[^>]*>[\\\\s\\\\S]*?>(\\\\d[,\\\\d]*)\\\\s*円/g,
      /class="Product__titleLink"[^>]*href="([^\"]+)"[^>]*>([^<]+)<[\\\\s\\\\S]*?class="Product__price"[^>]*>(\\\\d[,\\\\d]*)/g,
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null && rank <= 30) {
        const productUrl = match[1] || ''
        const productName = (match[2] || '').trim()
        const price = parseInt((match[3] || match[2] || '0').replace(/\\\\D/g, ''))
        
        if (productName && price > 0) {
          if (!items.find(i => i.productName === productName)) {
            items.push({ 
              rank: rank++, 
              productName, 
              brand: 'OTHER', 
              price, 
              category: 'accessories', 
              url: productUrl.startsWith('http') ? productUrl : 'https://auctions.yahoo.co.jp' + productUrl
            })
          }
        }
      }
    }
    
    console.log(\`Yahoo!拍賣爬取: 获取\${items.length}条数据\`)
    return { items, html }
  } catch (error) {
    console.error('Yahoo!拍賣爬取失败:', error.message)
    return { items: [], html: '' }
  }
}`;

content = content.replace(oldFunc, newFunc);

fs.writeFileSync('server.js', content);
console.log('Done');
