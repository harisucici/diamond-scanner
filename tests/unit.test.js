/**
 * 单元测试 - Diamond Scanner API
 * 测试范围: LanceDB连接、向量化搜索功能、API端点、数据一致性
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fetch from 'node-fetch';

// 测试配置
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API = {
  health: `${BASE_URL}/api/health`,
  diamonds: `${BASE_URL}/api/diamonds`,
  necklaces: `${BASE_URL}/api/necklaces`,
  gemstone: {
    categories: `${BASE_URL}/api/gemstone/categories`,
    products: `${BASE_URL}/api/gemstone/products`,
    reports: `${BASE_URL}/api/gemstone/reports`,
  }
};

describe('API健康检查', () => {
  it('应该返回健康状态', async () => {
    const response = await fetch(API.health);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });
});

describe('钻石数据API (/api/diamonds)', () => {
  let testDiamondId;

  it('应该获取钻石列表', async () => {
    const response = await fetch(API.diamonds);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('应该创建新的钻石记录', async () => {
    const newDiamond = {
      carat: 1.0,
      color: 'E',
      clarity: 'VS1',
      price: 10000
    };
    const response = await fetch(API.diamonds, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDiamond)
    });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
    testDiamondId = data.id;
  });

  it('应该删除钻石记录', async () => {
    if (!testDiamondId) return;
    const response = await fetch(`${API.diamonds}/${testDiamondId}`, {
      method: 'DELETE'
    });
    expect(response.status).toBe(200);
  });
});

describe('项链数据API (/api/necklaces)', () => {
  it('应该获取项链列表', async () => {
    const response = await fetch(API.necklaces);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('应该获取可用的月份列表', async () => {
    const response = await fetch(`${API.necklaces}/months`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('应该获取品牌列表', async () => {
    const response = await fetch(`${API.necklaces}/brands`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('应该获取网站列表', async () => {
    const response = await fetch(`${API.necklaces}/websites`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('宝石数据API (/api/gemstone)', () => {
  it('应该获取宝石分类列表', async () => {
    const response = await fetch(API.gemstone.categories);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('应该获取宝石产品列表', async () => {
    const response = await fetch(API.gemstone.products);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.products).toBeDefined();
    expect(Array.isArray(data.products)).toBe(true);
  });

  it('应该获取宝石报告', async () => {
    const response = await fetch(API.gemstone.reports);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});

describe('数据一致性测试', () => {
  it('钻石价格应该为正数', async () => {
    const response = await fetch(API.diamonds);
    const diamonds = await response.json();
    
    diamonds.forEach(diamond => {
      expect(diamond.price).toBeGreaterThan(0);
    });
  });

  it('钻石克拉数应该为正数', async () => {
    const response = await fetch(API.diamonds);
    const diamonds = await response.json();
    
    diamonds.forEach(diamond => {
      expect(diamond.carat).toBeGreaterThan(0);
    });
  });

  it('宝石产品应该有必填字段', async () => {
    const response = await fetch(API.gemstone.products);
    const data = await response.json();
    
    if (data.products.length > 0) {
      const product = data.products[0];
      expect(product.title || product.keyword).toBeDefined();
      expect(product.price).toBeDefined();
    }
  });
});

describe('向量化搜索功能测试 (LanceDB)', () => {
  it('应该支持产品搜索', async () => {
    const searchUrl = `${BASE_URL}/api/products/search?q=diamond`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});

describe('API响应时间测试', () => {
  it('健康检查响应时间应该小于500ms', async () => {
    const start = Date.now();
    await fetch(API.health);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  it('钻石列表响应时间应该小于1秒', async () => {
    const start = Date.now();
    await fetch(API.diamonds);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});
