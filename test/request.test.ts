import { create } from '../src/sky-ajax';
import { flushPromises, MockXHR, setupMockXHR } from './helpers';

setupMockXHR();

describe('request 基本请求', () => {
	it('open 参数正确', async () => {
		const ajax = create({ base: 'https://api.example.com' });
		const p = ajax({ url: '/users', method: 'GET', responseType: 'json' });
		await flushPromises();
		expect(MockXHR.last!.method).toBe('GET');
		expect(MockXHR.last!.url).toBe('https://api.example.com/users');
		MockXHR.last!.respondJSON(200, { ok: true });
		await expect(p).resolves.toEqual({ ok: true });
	});

	it('send 不带 body for GET', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.sentBody).toBeNull();
	});
});

describe('request URL 构建', () => {
	it('query 字符串追加', async () => {
		const ajax = create({ base: 'https://api.example.com' });
		ajax({ url: '/users', method: 'GET', query: 'page=1&limit=10' });
		await flushPromises();
		expect(MockXHR.last!.url).toBe('https://api.example.com/users?page=1&limit=10');
	});

	it('URLSearchParams 追加', async () => {
		const ajax = create({ base: 'https://api.example.com' });
		ajax({ url: '/users', method: 'GET', query: new URLSearchParams({ page: '1' }) });
		await flushPromises();
		expect(MockXHR.last!.url).toBe('https://api.example.com/users?page=1');
	});

	it('params 序列化为 query', async () => {
		const ajax = create({ base: 'https://api.example.com' });
		ajax({ url: '/users', method: 'GET', params: { page: 1, limit: 10 } });
		await flushPromises();
		const url = new URL(MockXHR.last!.url);
		expect(url.searchParams.get('page')).toBe('1');
		expect(url.searchParams.get('limit')).toBe('10');
	});
});

describe('request 请求体', () => {
	it('data + requestType=json → JSON.stringify', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'POST', data: { name: 'test' }, requestType: 'json' });
		await flushPromises();
		expect(MockXHR.last!.sentBody).toBe(JSON.stringify({ name: 'test' }));
		expect(MockXHR.last!.headers['Content-Type']).toBe('application/json');
	});

	it('data + requestType=form → URLSearchParams', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'POST', data: { name: 'test', age: 18 }, requestType: 'form' });
		await flushPromises();
		expect(MockXHR.last!.sentBody).toBe('name=test&age=18');
		expect(MockXHR.last!.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
	});

	it('body 直接发送', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'POST', body: 'raw text', requestType: 'text' });
		await flushPromises();
		expect(MockXHR.last!.sentBody).toBe('raw text');
		expect(MockXHR.last!.headers['Content-Type']).toBe('text/plain');
	});

	it('GET 请求不发送 data', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'GET', data: { name: 'test' } });
		await flushPromises();
		expect(MockXHR.last!.sentBody).toBeNull();
	});
});

describe('request headers', () => {
	it('设置自定义 headers', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'GET', headers: { 'Authorization': 'Bearer token' } });
		await flushPromises();
		expect(MockXHR.last!.headers['Authorization']).toBe('Bearer token');
	});

	it('合并上层 headers', async () => {
		const ajax = create({ headers: { 'X-Base': '1' } });
		ajax({ url: '/api', method: 'GET', headers: { 'X-Custom': '2' } });
		await flushPromises();
		expect(MockXHR.last!.headers['X-Base']).toBe('1');
		expect(MockXHR.last!.headers['X-Custom']).toBe('2');
	});
});

describe('request 响应解析', () => {
	it('responseType=json 解析 JSON', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET', responseType: 'json' });
		await flushPromises();
		MockXHR.last!.respond(200, '{"name":"test"}');
		await expect(p).resolves.toEqual({ name: 'test' });
	});

	it('responseType=text 返回文本', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET', responseType: 'text' });
		await flushPromises();
		MockXHR.last!.respond(200, 'hello world');
		await expect(p).resolves.toBe('hello world');
	});

	it('默认返回 responseText', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respond(200, 'plain text');
		await expect(p).resolves.toBe('plain text');
	});

	it('无 responseType 时根据 Content-Type: json 自动解析', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, { name: 'test' });
		await expect(p).resolves.toEqual({ name: 'test' });
	});

	it('无 responseType 时根据 Content-Type: text/* 返回文本', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.responseHeaders['Content-Type'] = 'text/html';
		MockXHR.last!.respond(200, '<h1>hello</h1>');
		await expect(p).resolves.toBe('<h1>hello</h1>');
	});
});

describe('request 错误处理', () => {
	it('HTTP 错误状态码 reject AjaxError', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respond(404, 'Not Found');
		await expect(p).rejects.toMatchObject({ status: 404 });
	});

	it('网络错误 reject AjaxError status=0', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.triggerError();
		await expect(p).rejects.toMatchObject({ status: 0 });
	});

	it('超时 reject', async () => {
		const ajax = create({});
		const p = ajax({ url: '/api', method: 'GET', timeout: 100 });
		await flushPromises();
		MockXHR.last!.triggerTimeout();
		await expect(p).rejects.toThrow();
	});
});

describe('request withCredentials', () => {
	it('设置 withCredentials', async () => {
		const ajax = create({});
		ajax({ url: '/api', method: 'GET', withCredentials: true });
		await flushPromises();
		expect(MockXHR.last!.withCredentials).toBe(true);
	});
});

describe('get / post 方法', () => {
	it('get 发送 GET 请求', async () => {
		const ajax = create({ base: 'https://api.example.com' });
		const p = ajax.get('/users', { responseType: 'json' });
		await flushPromises();
		expect(MockXHR.last!.method).toBe('GET');
		MockXHR.last!.respondJSON(200, []);
		await expect(p).resolves.toEqual([]);
	});

	it('post 发送 POST 请求带 data', async () => {
		const ajax = create({});
		const p = ajax.post('/users', { name: 'test' }, { responseType: 'json' });
		await flushPromises();
		expect(MockXHR.last!.method).toBe('POST');
		expect(MockXHR.last!.sentBody).toBe(JSON.stringify({ name: 'test' }));
		MockXHR.last!.respondJSON(200, { id: 1 });
		await expect(p).resolves.toEqual({ id: 1 });
	});
});
