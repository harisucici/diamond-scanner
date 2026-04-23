const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 把有问题的正则替换成 RegExp 构造函数
const oldPattern1 = /href="(\/\/item\.rakuten\.co\.jp\/\d+\/)"[^>]*>[\s\S]*?class="[^"]*title[^"]*"[^>]*>([^<]+)<[\s\S]*?class="[^"]*price[^"]*"[^>]*>(\d[,\d]*)\/g/g;
const newPattern1 = "new RegExp('href=\"(//item\\\\.rakuten\\\\.co\\\\.jp/\\\\d+/)\"[^>]*>[\\\\s\\\\S]*?class=\"[^\"]*title[^\"]*\"[^>]*>([^<]+)<[\\\\s\\\\S]*?class=\"[^\"]*price[^\"]*\"[^>]*>(\\\\d[,\\\\d]*)\"', 'g')";

content = content.replace(oldPattern1, newPattern1);

fs.writeFileSync('server.js', content);
console.log('Done');
