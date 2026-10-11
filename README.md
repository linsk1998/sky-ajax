# sky-ajax

Ajax 工具库，提供配置继承、请求/响应拦截器、类型安全的选项参数。

## 安装

```bash
npm install sky-ajax
```

## 快速开始

```typescript
import ajax from 'sky-ajax';

// 直接使用默认实例
const data = await ajax({ url: '/api/users', method: 'GET' });

// 用 get / post 快捷方法
const users = await ajax.get('/api/users');
const user = await ajax.post('/api/users', { name: 'test' });
```

## create

`create` 是核心工厂函数，创建的实例继承上层配置。

```typescript
import { create } from 'sky-ajax';

const ajax1 = create({ base: '/system' }); // https://example.com/system
const ajax2 = ajax1.create({ base: 'user' }); // https://example.com/system/user

const res1 = await ajax2.get('list'); // https://example.com/system/user/list
const res2 = await ajax2.get('/system/dept/list'); // https://example.com/system/dept/list
```

## 配置项

### 预设选项

| 字段               | 类型                          | 继承规则 | 说明                                                        |
| ------------------ | ----------------------------- | -------- | ----------------------------------------------------------- |
| `base`             | `string`                      | 覆盖     | 基础路径，首层相对于 `document.baseURI`，以后每层相对于上层 |
| `headers`          | `Record<string, string>`      | 合并     | 公用请求头                                                  |
| `params`           | `Record<string, string>`      | 合并     | 公用请求参数                                                |
| `timeout`          | `number`                      | 覆盖     | 超时时间（毫秒）                                            |
| `signal`           | `AbortSignal`                 | 覆盖     | 取消信号                                                    |
| `withCredentials`  | `boolean`                     | 覆盖     | 跨域携带凭证                                                |
| `requestType`      | `'json' \| 'form'`            | 覆盖     | 设置对象传参按 json 还是 form 格式序列化                    |
| `paramsSerializer` | `(params) => string`          | 覆盖     | 自定义 params 序列化                                        |
| `dataSerializer`   | `(data, requestType) => body` | 覆盖     | 自定义 data 序列化                                          |
| `responseParser`   | `(xhr, responseType) => any`  | 覆盖     | 自定义响应解析                                              |

### 请求选项

| 字段              | 类型                                    | 继承规则 | 说明                                |
| ----------------- | --------------------------------------- | -------- | ----------------------------------- |
| `base`            | `string`                                | 覆盖     | 基础路径，相对于 `document.baseURI` |
| `url`             | `string`                                | —        | 请求地址，相对于 `base`             |
| `method`          | `GET \| POST \| PUT \| DELETE \| PATCH` | 覆盖     | 请求方法                            |
| `headers`         | `Record<string, string>`                | 合并     | 请求头                              |
| `timeout`         | `number`                                | 覆盖     | 超时时间（毫秒）                    |
| `signal`          | `AbortSignal`                           | 覆盖     | 取消信号                            |
| `withCredentials` | `boolean`                               | 覆盖     | 跨域携带凭证                        |
| `responseType`    | `XMLHttpRequestResponseType`            | 覆盖     | 按指定响应类型获取Js数据            |

#### query / params（互斥）

| 字段     | 类型                        | 继承规则 | 说明                                    |
| -------- | --------------------------- | -------- | --------------------------------------- |
| `query`  | `string \| URLSearchParams` | —        | 精确查询字符串，不支持 object           |
| `params` | `Record<string, any>`       | 合并     | 业务参数对象，自动序列化为 query string |

`params` 用于业务层用，业务层无需关注传输格式，`query`用于精确发送请求参数。

#### body / data（互斥）

| 字段          | 类型                                                           | 继承规则 | 说明                                                   |
| ------------- | -------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `body`        | `string \| FormData \| URLSearchParams \| Blob \| ArrayBuffer` | 覆盖     | 精确请求体，不支持 object                              |
| `data`        | `Record<string, any>`                                          | 覆盖     | 业务数据对象，根据 `requestType` 序列化为 JSON 或 form |
| `requestType` | `'form' \| 'json' \| 'xml' \| 'text'`                          | 覆盖     | 决定 Content-Type 和 data 序列化方式，默认 `json`      |
| `contentType` | `string`                                                       | 覆盖     | 强制指定 Content-Type                                  |

`data` 用于业务层用，业务层无需关注传输格式，`body` 用于精确发送请求参数。

## 错误处理

HTTP 错误（状态码非 2xx）和网络错误都会 reject 一个 `AjaxError`（继承 `TypeError`）：

```typescript
import { AjaxError } from 'sky-ajax';

try {
    await ajax.get('/api/users');
} catch (e) {
    if (e instanceof AjaxError) {
        console.log(e.status);   // HTTP 状态码，网络错误为 0
        console.log(e.options);  // 请求选项
    }
}
```

终止和超时抛出是通用的 `AbortError` 和 `TimeoutError`（DOMException）

## 拦截器

通过 `interceptors` 配置传入，先注册先执行。请求拦截器在发送前执行，响应拦截器在解析后执行。

```typescript
import { create, RequestInterceptor, ResponseInterceptor } from 'sky-ajax';

const ajax = create({
    base: 'https://api.example.com',
    interceptors: [
        new RequestInterceptor(config => {
            config.headers = { ...config.headers, Authorization: 'Bearer token' };
            return config;
        }),
        new ResponseInterceptor(res => res.data, err => {
            if (err.status === 401) { /* 跳转登录 */ }
            return Promise.reject(err);
        })
    ]
});
```

- 回调基于 `promise.then`，必须返回处理后的值
- 子实例通过 `create` 继承父实例拦截器，并可在子层追加

### 拦截器示例：自动更新token

```typescript
import { create, RequestInterceptor, ResponseInterceptor, AjaxError } from 'sky-ajax';

let accessToken = 'initial-token';
let refreshToken = 'initial-refresh';

const ajax = create({
    base: 'https://api.example.com',
    interceptors: [
        // 请求拦截器：自动附带 token
        new RequestInterceptor(config => {
            config.headers = { ...config.headers, accessToken };
            return config;
        }),
        // 响应拦截器：401 时刷新 token 并重试
        new ResponseInterceptor(
            res => res,
            async (err) => {
                if (err instanceof AjaxError && err.status === 401) {
                    const res = await ajax({
                        url: '/refresh',
                        method: 'POST',
                        data: { refreshToken }
                    });
                    const { access, refresh } = res;
                    accessToken = access;
                    refreshToken = refresh;
                    return ajax(err.options);
                }
                throw err;
            }
        )
    ]
});
```

## API 一览

```typescript
export function create(options: ContextOptions): Ajax;

export interface Ajax {
    (options: AjaxOptions): Promise<any>;
    get(url: string, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>): Promise<any>;
    post(url: string, data: Record<string, any>, options?: Omit<AjaxOptionsCommon, 'method' | 'url'>): Promise<any>;
    create: (options: ContextOptions) => Ajax;
}

export class RequestInterceptor { constructor(fulfilled?, rejected?) }
export class ResponseInterceptor { constructor(fulfilled?, rejected?) }
export class AjaxError extends TypeError { status?: number; options?: AjaxOptions }

export default create({});
```
