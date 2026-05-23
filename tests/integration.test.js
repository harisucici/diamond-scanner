/**
 * 集成测试 - Diamond Scanner API
 * 测试范围: API端点测试、数据一致性、性能测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('集成测试: API端点', () => {
  const api = {
    base: (path) => `${BASE_URL}/api/${path.replace(/^\//, '')}`,
  };

  describe('健康检查', () => {
    it('GET /api/health - 返回服务状态', async () => {
      const res = await fetch(api.base('health'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });
  });

  describe('钻石管理', () => {
    it('GET /api/diamonds - 获取所有钻石', async () => {
      const res = await fetch(api.base('diamonds'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('POST /api/diamonds - 创建钻石', async () => {
      const res = await fetch(api.base('diamonds'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carat: 1.5, color: 'D', clarity: 'IF', price: 20000 })
      });
      expect([200, 201]).toContain(res.status);
    });

    it('DELETE /api/diamonds/:id - 删除钻石', async () => {
      // 先创建再删除
      const createRes = await fetch(api.base('diamonds'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carat: 1.0, color: 'F', clarity: 'VVS1', price: 15000 })
      });
      const created = await createRes.json();
      
      if (created.id) {
        const deleteRes = await fetch(api.base(`diamonds/${created.id}`), {
          method: 'DELETE'
        });
        expect(deleteRes.status).toBe(200);
      }
    });
  });

  describe('项链数据', () => {
    it('GET /api/necklaces - 获取项链列表', async () => {
      const res = await fetch(api.base('necklaces'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/necklaces/months - 获取月份列表', async () => {
      const res = await fetch(api.base('necklaces/months'));
      expect(res.status).toBe(200);
    });

    it('GET /api/necklaces/brands - 获取品牌列表', async () => {
      const res = await fetch(api.base('necklaces/brands'));
      expect(res.status).toBe(200);
    });

    it('GET /api/necklaces/websites - 获取网站列表', async () => {
      const res = await fetch(api.base('necklaces/websites'));
      expect(res.status).toBe(200);
    });
  });

  describe('Instagram数据', () => {
    it('GET /api/instagram - 获取Instagram帖子', async () => {
      const res = await fetch(api.base('instagram'));
      expect(res.status).toBe(200);
    });

    it('GET /api/instagram/months - 获取月份列表', async () => {
      const res = await fetch(api.base('instagram/months'));
      expect(res.status).toBe(200);
    });

    it('GET /api/instagram/hashtags - 获取话题标签列表', async () => {
      const res = await fetch(api.base('instagram/hashtags'));
      expect(res.status).toBe(200);
    });
  });

  describe('Saks数据', () => {
    it('GET /api/saks - 获取Saks产品', async () => {
      const res = await fetch(api.base('saks'));
      expect(res.status).toBe(200);
    });

    it('GET /api/saks/months - 获取月份列表', async () => {
      const res = await fetch(api.base('saks/months'));
      expect(res.status).toBe(200);
    });
  });

  describe('Fashionphile数据', () => {
    it('GET /api/fashionphile - 获取Fashionphile产品', async () => {
      const res = await fetch(api.base('fashionphile'));
      expect(res.status).toBe(200);
    });

    it('GET /api/fashionphile/months - 获取月份列表', async () => {
      const res = await fetch(api.base('fashionphile/months'));
      expect(res.status).toBe(200);
    });

    it('GET /api/fashionphile/brands - 获取品牌列表', async () => {
      const res = await fetch(api.base('fashionphile/brands'));
      expect(res.status).toBe(200);
    });
  });

  describe('eBay数据', () => {
    it('GET /api/ebay - 获取eBay产品', async () => {
      const res = await fetch(api.base('ebay'));
      expect(res.status).toBe(200);
    });

    it('GET /api/ebay/months - 获取月份列表', async () => {
      const res = await fetch(api.base('ebay/months'));
      expect(res.status).toBe(200);
    });

    it('GET /api/ebay/categories - 获取分类列表', async () => {
      const res = await fetch(api.base('ebay/categories'));
      expect(res.status).toBe(200);
    });
  });

  describe('Amazon宝石数据', () => {
    it('GET /api/amazon-gemstones - 获取Amazon宝石产品', async () => {
      const res = await fetch(api.base('amazon-gemstones'));
      expect(res.status).toBe(200);
    });

    it('GET /api/amazon-gemstones/months - 获取月份列表', async () => {
      const res = await fetch(api.base('amazon-gemstones/months'));
      expect(res.status).toBe(200);
    });

    it('GET /api/amazon-gemstones/categories - 获取分类列表', async () => {
      const res = await fetch(api.base('amazon-gemstones/categories'));
      expect(res.status).toBe(200);
    });
  });

  describe('宝石数据API', () => {
    it('GET /api/gemstone/categories - 获取宝石分类', async () => {
      const res = await fetch(api.base('gemstone/categories'));
      expect(res.status).toBe(200);
    });

    it('GET /api/gemstone/products - 获取宝石产品', async () => {
      const res = await fetch(api.base('gemstone/products'));
      expect(res.status).toBe(200);
    });

    it('GET /api/gemstone/reports - 获取宝石报告', async () => {
      const res = await fetch(api.base('gemstone/reports'));
      expect(res.status).toBe(200);
    });
  });

  describe('产品搜索', () => {
    it('GET /api/products/search - 搜索产品', async () => {
      const res = await fetch(api.base('products/search?q=diamond'));
      expect(res.status).toBe(200);
    });
  });

  describe('数据源状态', () => {
    it('GET /api/sources/status - 获取数据源状态', async () => {
      const res = await fetch(api.base('sources/status'));
      expect(res.status).toBe(200);
    });
  });
});

describe('集成测试: 数据一致性', () => {
  it('所有钻石记录应该有有效的颜色值', async () => {
    const validColors = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
    const res = await fetch(`${BASE_URL}/api/diamonds`);
    const diamonds = await res.json();
    
    diamonds.forEach(d => {
      if (d.color) {
        expect(validColors).toContain(d.color);
      }
    });
  });

  it('所有钻石记录应该有有效的净度值', async () => {
    const validClarities = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'];
    const res = await fetch(`${BASE_URL}/api/diamonds`);
    const diamonds = await res.json();
    
    diamonds.forEach(d => {
      if (d.clarity) {
        expect(validClarities).toContain(d.clarity);
      }
    });
  });

  it('价格应该总是正数', async () => {
    const res = await fetch(`${BASE_URL}/api/diamonds`);
    const diamonds = await res.json();
    
    diamonds.forEach(d => {
      if (d.price !== undefined) {
        expect(d.price).toBeGreaterThan(0);
      }
    });
  });

  it('克拉数应该总是正数且小于50', async () => {
    const res = await fetch(`${BASE_URL}/api/diamonds`);
    const diamonds = await res.json();
    
    diamonds.forEach(d => {
      if (d.carat !== undefined) {
        expect(d.carat).toBeGreaterThan(0);
        expect(d.carat).toBeLessThan(50);
      }
    });
  });
});

describe('集成测试: 错误处理', () => {
  it('无效的端点应该返回404', async () => {
    const res = await fetch(`${BASE_URL}/api/invalid-endpoint`);
    expect(res.status).toBe(404);
  });

  it('无效的JSON应该返回400', async () => {
    const res = await fetch(`${BASE_URL}/api/diamonds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });
    expect([400, 500]).toContain(res.status);
  });
});

describe('集成测试: 性能基准', () => {
  const measureResponseTime = async (url) => {
    const start = Date.now();
    await fetch(url);
    return Date.now() - start;
  };

  it('健康检查应该在200ms内响应', async () => {
    const time = await measureResponseTime(`${BASE_URL}/api/health`);
    expect(time).toBeLessThan(200);
  });

  it('钻石列表应该在500ms内响应', async () => {
    const time = await measureResponseTime(`${BASE_URL}/api/diamonds`);
    expect(time).toBeLessThan(500);
  });

  it('项链列表应该在1秒内响应', async () => {
    const time = await measureResponseTime(`${BASE_URL}/api/necklaces`);
    expect(time).toBeLessThan(1000);
  });
});
