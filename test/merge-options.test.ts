import { AjaxError } from '../src/sky-ajax';

describe('AjaxError', () => {
	it('继承 TypeError', () => {
		const err = new AjaxError('test error');
		expect(err).toBeInstanceOf(TypeError);
		expect(err.name).toBe('AjaxError');
		expect(err.message).toBe('test error');
	});

	it('带 status 属性', () => {
		const err = new AjaxError('Not Found', { status: 404 });
		expect(err.status).toBe(404);
	});

	it('不带 options 时无 status', () => {
		const err = new AjaxError('error');
		expect(err.status).toBeUndefined();
	});
});
