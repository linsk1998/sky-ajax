export class MockXHR {
	static instances: MockXHR[] = [];
	static last: MockXHR | null = null;

	method = '';
	url = '';
	async = true;
	headers: Record<string, string> = {};
	sentBody: any = null;
	aborted = false;

	timeout = 0;
	responseType: XMLHttpRequestResponseType = '';
	withCredentials = false;

	readyState = 0;
	status = 0;
	statusText = '';
	responseText = '';
	response: any = null;
	responseXML: Document | null = null;
	responseHeaders: Record<string, string> = {};

	onreadystatechange: ((ev: Event) => any) | null = null;
	ontimeout: ((ev: ProgressEvent) => any) | null = null;
	onerror: ((ev: ProgressEvent) => any) | null = null;

	constructor() {
		MockXHR.instances.push(this);
		MockXHR.last = this;
	}

	open(method: string, url: string, async = true) {
		this.method = method;
		this.url = url;
		this.async = async;
	}

	setRequestHeader(name: string, value: string) {
		this.headers[name] = value;
	}

	send(body?: any) {
		this.sentBody = body;
	}

	abort() {
		this.aborted = true;
	}

	getResponseHeader(name: string): string | null {
		for(const key in this.responseHeaders) {
			if(key.toLowerCase() === name.toLowerCase()) {
				return this.responseHeaders[key];
			}
		}
		return null;
	}

	respond(status: number, responseText: string) {
		this.status = status;
		this.statusText = status >= 200 && status < 300 ? 'OK' : 'Error';
		this.responseText = responseText;
		this.response = responseText;
		this.readyState = 4;
		if(this.onreadystatechange) this.onreadystatechange.call(this, new Event('readystatechange'));
	}

	respondJSON(status: number, data: any) {
		this.responseHeaders['Content-Type'] = 'application/json';
		this.respond(status, JSON.stringify(data));
	}

	triggerError() {
		if(this.onerror) this.onerror.call(this, new ProgressEvent('error'));
	}

	triggerTimeout() {
		if(this.ontimeout) this.ontimeout.call(this, new ProgressEvent('timeout'));
	}

	static reset() {
		MockXHR.instances = [];
		MockXHR.last = null;
	}
}

export function setupMockXHR() {
	beforeEach(() => {
		MockXHR.reset();
		vi.stubGlobal('XMLHttpRequest', MockXHR);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});
}
export function flushPromises() {
	return new Promise(resolve => setTimeout(resolve, 0));
}
