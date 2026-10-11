import * as qs from "sky-qs";

const CONTENT_TYPES: Record<string, string> = {
	form: 'application/x-www-form-urlencoded',
	json: 'application/json',
	xml: 'application/xml',
	text: 'text/plain',
	arraybuffer: 'application/octet-stream'
};

type RequestType = 'form' | 'json' | 'xml' | 'text';

interface AjaxOptionsCommon {
	/** 基础路径。相对于 document.baseURI */
	base?: string;
	/** 请求地址，相对于 base */
	url: string;
	/** 请求方法 */
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	/** 请求头，与上层合并 */
	headers?: Record<string, string>;
	/** 超时时间（毫秒），覆盖上层 */
	timeout?: number;
	/** AbortSignal，用于取消请求, 覆盖上层 */
	signal?: AbortSignal;
	/** 跨域请求是否携带凭证 */
	withCredentials?: boolean;
	/** 自定义响应解析函数，覆盖上层 */
	responseParser?: (xhr: XMLHttpRequest, responseType: XMLHttpRequestResponseType) => any;
	/** 响应类型，覆盖上层 */
	responseType?: XMLHttpRequestResponseType;
	/** 自定义 params 序列化函数，覆盖上层 */
	paramsSerializer?: (params: Record<string, any>) => string;
	/** 自定义 data 序列化函数，覆盖上层 */
	dataSerializer?: (data: Record<string, any>, requestType: 'form' | 'json') => XMLHttpRequestBodyInit;
}

type QueryParamsMixin =
	| {
		/** 查询字符串，精确发送，完全覆盖上层。支持 string、URLSearchParams，不支持 object */
		query: string | URLSearchParams;
		params?: never;
	}
	| {
		/** 业务参数对象，与上层合并，自动转为 query string。传了 query 或 body 后无效 */
		params: Record<string, any>;
		query?: never;
	}
	| { query?: never; params?: never; };

type DataBodyMixin =
	| {
		/** 业务数据对象，与上层合并，根据 requestType 转为 JSON 或 form 格式。传了 query 或 body 后无效 */
		data: Record<string, any>;
		body?: never;
		/** 请求类型，决定 Content-Type 和 data 序列化方式。默认 json，可传 form */
		requestType?: 'form' | 'json';
		contentType?: never;
	}
	| {
		/** 请求体，精确发送，完全覆盖。支持 string、URLSearchParams、Blob、FormData、ArrayBuffer 等，不支持 object */
		body: string;
		data?: never;
		/** 请求类型，决定 Content-Type。默认 json，可传 form、xml、text */
		requestType?: RequestType;
		contentType?: never;
	}
	| {
		/** 请求体，精确发送，完全覆盖。支持 string、URLSearchParams、Blob、FormData、ArrayBuffer 等，不支持 object */
		body: FormData;
		data?: never;
		requestType?: never;
		contentType?: never;
	}
	| {
		/** 请求体，精确发送，完全覆盖。支持 string、URLSearchParams、Blob、FormData、ArrayBuffer 等，不支持 object */
		body: Exclude<XMLHttpRequestBodyInit, string | FormData>;
		data?: never;
		requestType?: never;
		contentType?: string;
	}
	| { data?: never; body?: never; requestType?: RequestType; contentType?: string; };

export type AjaxOptions = AjaxOptionsCommon & QueryParamsMixin & DataBodyMixin;

export interface ContextOptions extends Omit<Partial<AjaxOptionsCommon>, 'url'> {
	/** 基础路径。首层相对于 document.baseURI，以后每层相对于上层 base 路径覆盖 */
	base?: string;
	/** 公共参数对象，与下层合并，自动转为 query string */
	params?: Record<string, any>;
	/** 请求类型，data 序列化方式。默认 json，可传 form */
	requestType?: 'form' | 'json';
	/** 拦截器，与上层合并 */
	interceptors?: Interceptor<any>[];
}

export type InterceptorHandler<T> = (value: T) => T | Promise<T>;
export type InterceptorErrorHandler = (error: any) => any | Promise<any>;

const enum PHASE {
	REQUEST = 0,
	RESPONSE = 1
}

export interface Interceptor<T> {
	fulfilled?: InterceptorHandler<T>;
	rejected?: InterceptorErrorHandler;
	phase: PHASE;
}

export class RequestInterceptor implements Interceptor<AjaxOptions> {
	declare fulfilled?: InterceptorHandler<AjaxOptions>;
	declare rejected?: InterceptorErrorHandler;
	declare phase: PHASE;
	/** 回调运行基于promise.then，因此需要按需要返回处理后的参数 */
	constructor(fulfilled?: InterceptorHandler<AjaxOptions>, rejected?: InterceptorErrorHandler) {
		this.fulfilled = fulfilled;
		this.rejected = rejected;
		this.phase = PHASE.REQUEST;
	}
}
export class ResponseInterceptor implements Interceptor<any> {
	declare fulfilled?: InterceptorHandler<any>;
	declare rejected?: InterceptorErrorHandler;
	declare phase: PHASE;
	/** 回调运行基于promise.then，因此需要按需要返回处理后的结果 */
	constructor(fulfilled?: InterceptorHandler<any>, rejected?: InterceptorErrorHandler) {
		this.fulfilled = fulfilled;
		this.rejected = rejected;
		this.phase = PHASE.RESPONSE;
	}
}

export interface Ajax {
	(options: AjaxOptions): Promise<any>;
	get(url: string, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>): Promise<any>;
	post(url: string, data: Record<string, any>, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>): Promise<any>;
	create: (options: ContextOptions) => Ajax;
}

function defaultDataSerializer(data: Record<string, any>, requestType: 'form' | 'json'): XMLHttpRequestBodyInit {
	switch(requestType) {
		case 'form':
			return qs.stringify(data);
		default:
			return JSON.stringify(data);
	}
}
function inferResponseType(xhr: XMLHttpRequest): XMLHttpRequestResponseType {
	const contentType = (xhr.getResponseHeader('Content-Type') || '').toLowerCase();
	if(contentType.includes('json')) return 'json';
	if(contentType.includes('xml')) return 'document';
	if(contentType.startsWith('text/')) return 'text';
	return '';
}
function defaultResponseParser(xhr: XMLHttpRequest, responseType: XMLHttpRequestResponseType): any {
	switch(responseType) {
		case 'json': return JSON.parse(xhr.responseText);
		case 'text': return xhr.responseText;
		case 'document':
			const root = xhr.responseXML?.documentElement;
			if(!root || root.localName === 'parsererror') {
				throw new SyntaxError("Failed to parse response as XML");
			}
			return root;
		default: return xhr.response;
	}
}

export class AjaxError extends TypeError {
	/** 响应状态码 */
	declare status?: number;
	/** 请求选项 */
	declare options?: AjaxOptions;
	constructor(message: string, options?: Partial<AjaxError>) {
		super(message);
		this.name = 'AjaxError';
		this.message = message;
		if(options) {
			Object.assign(this, options);
		}
	}
}

const toString = Object.prototype.toString;

function isBlob(value: any): value is Blob {
	return toString.call(value) === "[object Blob]";
}
function isFormData(value: any): value is FormData {
	return toString.call(value) === "[object FormData]";
}

export function create(options: ContextOptions): Ajax {
	const { base, method, headers, params, requestType, paramsSerializer, dataSerializer, responseParser, interceptors } = options;
	const context: ContextOptions = {
		...options,
		base: base ? new URL(base, document.baseURI).href : document.baseURI.replace(/#.*$/, "").replace(/\/[^/]+$/, ""),
		method: method || "GET",
		headers: headers || {},
		params: params || {},
		requestType: requestType || 'json',
		paramsSerializer: paramsSerializer || qs.stringify,
		dataSerializer: dataSerializer || defaultDataSerializer,
		responseParser: responseParser || defaultResponseParser,
		interceptors: interceptors || []
	};
	const _create = function(options: ContextOptions): Ajax {
		const ajax = create({
			...context,
			...options,
			base: options.base ? new URL(options.base, context.base + '/').href : context.base,
			headers: options.headers ? { ...context.headers, ...options.headers } : context.headers,
			params: options.params ? { ...context.params, ...options.params } : context.params,
			interceptors: options.interceptors ? [...context.interceptors, ...options.interceptors] : context.interceptors
		});
		return ajax;
	};
	const request = function(options: AjaxOptions): Promise<any> {
		return new Promise((resolve, reject) => {
			let {
				method,
				base,
				headers,
				query,
				params,
				paramsSerializer,
				body,
				data,
				dataSerializer,
				requestType,
				contentType,
				responseType,
				responseParser,
				signal,
				timeout,
				withCredentials
			} = options;
			let url = new URL(options.url, base + "/");
			if(query) {
				const search = typeof query === "string" ? query : query.toString();
				if(search) {
					url = new URL(url.search ? url.search + "&" + search : "?" + search, url);
				}
			} else if(params) {
				const search = paramsSerializer(params);
				if(search) {
					url = new URL(url.search ? url.search + "&" + search : "?" + search, url);
				}
			}
			const xhr = new XMLHttpRequest();
			xhr.open(method, url.href, true);
			if(signal) {
				signal.throwIfAborted();
				let onAbort = () => {
					reject(signal.reason);
					xhr.onreadystatechange = null;
					xhr.abort();
				};
				signal.addEventListener('abort', onAbort);
				let _resolve = resolve;
				resolve = function(r) {
					signal.removeEventListener('abort', onAbort);
					_resolve(r);
				};
				let _reject = reject;
				reject = function(e) {
					signal.removeEventListener('abort', onAbort);
					_reject(e);
				};
			}
			if(timeout != null) {
				if('timeout' in xhr) {
					xhr.timeout = timeout;
					xhr.ontimeout = function() {
						reject(new DOMException('timeout of ' + timeout + 'ms exceeded', "TimeoutError"));
					};
				} else {
					let timer = setTimeout(() => {
						reject(new DOMException('timeout of ' + timeout + 'ms exceeded', "TimeoutError"));
						xhr.onreadystatechange = null;
						xhr.onerror = null;
						xhr.abort();
					}, timeout);
					let _resolve = resolve;
					resolve = function(r) {
						clearTimeout(timer);
						_resolve(r);
					};
					let _reject = reject;
					reject = function(e) {
						clearTimeout(timer);
						_reject(e);
					};
				}
			}
			if(withCredentials != null) {
				xhr.withCredentials = withCredentials;
			}
			if(responseType) {
				switch(responseType) {
					case 'json':
						break;
					default:
						xhr.responseType = responseType;
				}
			}
			let sendBody: XMLHttpRequestBodyInit | null = null;
			if(method !== "GET") {
				if(body != null) {
					sendBody = body;
					if(!isFormData(body)) {
						if(contentType) {
							xhr.setRequestHeader('Content-Type', contentType);
						} else if(typeof body === "string") {
							xhr.setRequestHeader('Content-Type', CONTENT_TYPES[requestType]);
						} else if(body instanceof URLSearchParams) {
							xhr.setRequestHeader('Content-Type', CONTENT_TYPES.form);
						} else if(isBlob(body)) {
							xhr.setRequestHeader('Content-Type', body.type || CONTENT_TYPES.arraybuffer);
						} else {
							xhr.setRequestHeader('Content-Type', CONTENT_TYPES.arraybuffer);
						}
					}
				} else if(data) {
					sendBody = dataSerializer(data, requestType as 'form' | 'json');
					xhr.setRequestHeader('Content-Type', CONTENT_TYPES[requestType]);
				}
			}
			for(const key in headers) {
				xhr.setRequestHeader(key, headers[key]);
			}
			xhr.onreadystatechange = function() {
				if(xhr.readyState === 4) {
					if(xhr.status >= 200 && xhr.status < 300) {
						try {
							resolve(responseParser(xhr, responseType || inferResponseType(xhr)));
						} catch(e) {
							reject(e);
						}
					} else {
						reject(new AjaxError(xhr.statusText || "Failed to fetch", { status: xhr.status, options }));
					}
				}
			};
			xhr.onerror = function(e) {
				reject(new AjaxError("Failed to fetch", { status: 0, cause: e, options }));
			};
			try {
				xhr.send(sendBody);
			} catch(e) {
				reject(new AjaxError("Failed to fetch", { status: 0, cause: e, options }));
			}
		});
	};
	const withInterceptors = function(options: AjaxOptions): Promise<any> {
		let { interceptors, ...rest } = context;
		let merged = {
			...rest,
			...options,
			base: options.base ? new URL(options.base, document.baseURI).href : context.base,
			headers: options.headers ? { ...context.headers, ...options.headers } : context.headers,
			params: options.params ? { ...context.params, ...options.params } : context.params,
		};
		let promise: Promise<any> = Promise.resolve(merged);
		for(const interceptor of interceptors) {
			if(interceptor.phase === PHASE.REQUEST) {
				promise = promise.then(interceptor.fulfilled, interceptor.rejected);
			}
		}
		promise = promise.then(request);
		for(const interceptor of interceptors) {
			if(interceptor.phase === PHASE.RESPONSE) {
				promise = promise.then(interceptor.fulfilled, interceptor.rejected);
			}
		}
		return promise;
	};
	const get = function(url: string, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>) {
		return withInterceptors({ ...options, url, method: 'GET' } as AjaxOptions);
	};
	const post = function(url: string, data: Record<string, any>, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>) {
		return withInterceptors({ ...options, url, data, method: 'POST' } as AjaxOptions);
	};
	return Object.assign(withInterceptors, { create: _create, get, post });
}


export default create({});
