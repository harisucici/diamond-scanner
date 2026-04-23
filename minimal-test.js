// 简单测试Node.js是否可以运行
const http = require('http');

// 测试后端API是否可访问
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('响应数据:', data);
    console.log('✅ 后端API正常');
    
    // 测试API端点
    testEndpoint('/api/test');
    testEndpoint('/api/diamonds');
  });
});

req.on('error', (e) => {
  console.error(`❌ 请求错误: ${e.message}`);
});

req.end();

function testEndpoint(path) {
  const req2 = http.request({
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`✅ ${path}: 状态码 ${res.statusCode}`);
    });
  });
  
  req2.on('error', (e) => {
    console.error(`❌ ${path}: ${e.message}`);
  });
  
  req2.end();
}