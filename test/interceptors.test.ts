import { AjaxError, create, RequestInterceptor, ResponseInterceptor } from '../src/sky-ajax';
import { flushPromises, MockXHR, setupMockXHR } from './helpers';

setupMockXHR();

describe('请求拦截器', () => {
	it('先注册先执行', async () => {
		const order: string[] = [];
		const ajax = create({
			interceptors: [
				new RequestInterceptor(config => { order.push('first'); return config; }),
				new RequestInterceptor(config => { order.push('second'); return config; })
			]
		});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, {});
		await p;
		expect(order).toEqual(['first', 'second']);
	});

	it('可修改 config', async () => {
		const ajax = create({
			interceptors: [
				new RequestInterceptor(config => {
					config.headers = { ...config.headers, 'X-Intercepted': 'yes' };
					return config;
				})
			]
		});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		expect(MockXHR.last!.headers['X-Intercepted']).toBe('yes');
		MockXHR.last!.respondJSON(200, {});
		await p;
	});
});

describe('响应拦截器', () => {
	it('先注册先执行', async () => {
		const order: string[] = [];
		const ajax = create({
			interceptors: [
				new ResponseInterceptor(res => { order.push('first'); return res; }),
				new ResponseInterceptor(res => { order.push('second'); return res; })
			]
		});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, {});
		await p;
		expect(order).toEqual(['first', 'second']);
	});

	it('可修改 response', async () => {
		const ajax = create({
			interceptors: [
				new ResponseInterceptor(res => ({ ...res, intercepted: true }))
			]
		});
		const p = ajax({ url: '/api', method: 'GET', responseType: 'json' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, { data: 1 });
		await expect(p).resolves.toEqual({ data: 1, intercepted: true });
	});

	it('响应拦截器处理错误', async () => {
		const ajax = create({
			interceptors: [
				new ResponseInterceptor(res => res, err => ({ recovered: true, original: err }))
			]
		});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respond(500, 'Server Error');
		await expect(p).resolves.toEqual({ recovered: true, original: expect.any(AjaxError) });
	});
});

describe('请求+响应拦截器组合', () => {
	it('请求拦截器在响应拦截器之前执行', async () => {
		const order: string[] = [];
		const ajax = create({
			interceptors: [
				new RequestInterceptor(config => { order.push('req'); return config; }),
				new ResponseInterceptor(res => { order.push('res'); return res; })
			]
		});
		const p = ajax({ url: '/api', method: 'GET' });
		await flushPromises();
		MockXHR.last!.respondJSON(200, {});
		await p;
		expect(order).toEqual(['req', 'res']);
	});
});
