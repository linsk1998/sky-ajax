import { create, RequestInterceptor, ResponseInterceptor } from '../src/sky-ajax';
import { flushPromises, MockXHR, setupMockXHR } from './helpers';

setupMockXHR();

describe('create 继承配置', () => {
	it('继承 base', async () => {
		const parent = create({ base: 'https://api.example.com' });
		const child = parent.create({});
		child({ url: '/users', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.url).toBe('https://api.example.com/users');
	});

	it('继承 headers 并合并', async () => {
		const parent = create({ headers: { 'X-Base': '1' } });
		const child = parent.create({ headers: { 'X-Child': '2' } });
		child({ url: '/api', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.headers['X-Base']).toBe('1');
		expect(MockXHR.last!.headers['X-Child']).toBe('2');
	});

	it('子层 base 相对于父层', async () => {
		const parent = create({ base: 'https://api.example.com/v1' });
		const child = parent.create({ base: '/v2' });
		child({ url: 'users', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.url).toBe('https://api.example.com/v2/users');
	});
});

describe('create 继承拦截器', () => {
	it('子实例继承父实例拦截器', async () => {
		const parent = create({
			interceptors: [
				new RequestInterceptor(config => {
					config.headers = { ...config.headers, 'X-Inherited': 'yes' };
					return config;
				})
			]
		});
		const child = parent.create({});
		const p = child({ url: '/api', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.headers['X-Inherited']).toBe('yes');
		MockXHR.last!.respondJSON(200, {});
		await p;
	});

	it('子实例添加拦截器不影响父实例', async () => {
		const parent = create({});
		const child = parent.create({
			interceptors: [
				new RequestInterceptor(config => {
					config.headers = { ...config.headers, 'X-ChildOnly': 'yes' };
					return config;
				})
			]
		});
		const p = parent({ url: '/api', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.headers['X-ChildOnly']).toBeUndefined();
		MockXHR.last!.respondJSON(200, {});
		await p;
	});

	it('响应拦截器也被继承', async () => {
		const parent = create({
			interceptors: [
				new ResponseInterceptor(res => ({ ...res, wrapped: true }))
			]
		});
		const child = parent.create({});
		const p = child({ url: '/api', method: 'GET', responseType: 'json' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, { data: 1 });
		await expect(p).resolves.toEqual({ data: 1, wrapped: true });
	});
});
