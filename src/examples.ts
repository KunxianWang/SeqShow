import { parseSequence } from './core/parser';

export const loginSource = `sequenceDiagram
    actor U as Browser
    participant API
    participant DB as Database
    U->>API: POST /login
    API->>DB: Find user
    DB-->>API: User
    API->>API: Verify password
    alt authenticated
        API-->>U: Session
        Note over U,API: Login succeeded
    else unauthorized
        API-->>U: 401
        Note over U,API: Login failed
    end`;

const parsed = parseSequence(loginSource);
if (!parsed.ok) throw new Error(`Invalid bundled example: ${JSON.stringify(parsed.diagnostics)}`);
export const loginExample = parsed.document;

export const examples = [
  { id: 'login', title: 'Login · success / failure', source: loginSource },
  { id: 'request', title: 'API request · first steps', source: `sequenceDiagram
    participant Client
    participant API as Health API
    Client->>API: GET /health
    API-->>Client: 200 OK` },
  { id: 'cache', title: 'Cache · unequal paths', source: `sequenceDiagram
    actor U as User
    participant Cache
    participant DB as Database
    U->>Cache: Look up profile
    alt cache hit
        Cache-->>U: Cached profile
    else cache miss
        Cache->>DB: Read profile
        DB-->>Cache: Profile
        Cache-->>U: Fresh profile
    end
    Note over U,Cache: Profile ready` },
  { id: 'job', title: 'Background job · two choices', source: `sequenceDiagram
    participant Client
    participant Worker
    Client->>Worker: Submit job
    alt already computed
        Worker->>Worker: Read saved result
    else new job
        Worker->>Worker: Compute result
        Note right of Worker: Save result
    end
    alt deliver now
        Worker-->>Client: Result
    else deliver later
        Note over Client: Waiting for delivery
        Worker-->>Client: Delivery scheduled
    end
    Client->>Client: Update job status` },
  { id: 'validation', title: 'Validation · self calls / Notes', source: `sequenceDiagram
    participant API as Validation service
    participant DB as Rules store
    Note left of API: Request received
    API->>API: Validate
    API->>API: Validate
    Note right of DB: Rules are local
    Note over API: Both checks complete
    Note over API,DB: Continue with the same rules` },
  { id: 'chinese', title: '中文订单 · 长文本与别名', source: `sequenceDiagram
    actor U as 手机用户与订单页面
    participant API as 订单接口服务
    participant DB as 商品与库存数据库
    U->>API: 提交订单：商品、数量与配送地址；请求地址 https://example.com:8080/orders?source=web&version=1
    API->>DB: 查询库存：同时核对商品状态、可售数量与预留库存，确认当前请求能否继续处理。
    DB-->>API: 库存充足：可售数量 > 0
    API->>API: 计算商品金额、配送费用与优惠后的总价
    Note over U,API: 本图是演示路径，不会调用真实接口或提交订单。
    API-->>U: 订单已创建：等待支付` },
];
