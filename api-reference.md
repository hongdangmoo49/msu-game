# MSU Open API Reference

작성일: 2026-06-12
대상 버전: v1rc1
Base URL: `https://openapi.msu.io`

이 문서는 MapleStory Universe MSU Open API 공식 문서 전체를 에이전트가 개발 중 바로 참조할 수 있도록 재구성한 레퍼런스입니다. 공식 페이지 46개와 `openapi-v1rc1.swagger.json`을 함께 대조했습니다. 단순 요약이 아니라 클라이언트 구현, 타입 정의, 오류 처리, 페이지네이션, 문서 간 불일치까지 포함합니다.

## Sources

- [Introduction](https://docs.msu.io/msu-open-api/introduction)
- [MSU OpenAPI Builder Guide](https://docs.msu.io/msu-open-api/ai-assistant/msu-openapi-builder-guide)
- [Documentation index](https://docs.msu.io/llms.txt)
- [Swagger spec](https://docs.msu.io/openapi-v1rc1.swagger.json)

## Quick Start

### 공통 요청 규칙

- 모든 일반 MSU Open API 요청은 HTTPS + JSON을 사용합니다.
- 모든 요청에 API key 헤더 `x-nxopen-api-key`가 필요합니다.
- API key는 서버 사이드에서만 보관합니다. 브라우저 번들, 모바일 앱, 공개 저장소에 노출하지 마세요.
- 일부 사용자 컨텍스트가 필요한 API는 `msu-authorization` 헤더를 추가로 받을 수 있습니다. 검색 API 문서에서는 이 헤더가 optional이며, 제공 시 사용자 기반 필터가 적용된다고 설명합니다.
- 공식 Builder Guide는 JSON 필드명이 camelCase라고 설명합니다. 단, Introduction과 Swagger는 `trace_id`를 쓰고 Builder Guide와 일부 예시는 `traceId`를 씁니다. 클라이언트는 운영 안정성을 위해 둘 다 읽도록 구현하세요.

### 기본 TypeScript fetch 래퍼

```ts
const BASE_URL = 'https://openapi.msu.io';

type MsuSuccess<T> = {
  success: true;
  data: T;
  traceId?: string;
  trace_id?: string;
};

type MsuFailure = {
  success: false;
  error: { code: number; message: string };
  traceId?: string;
  trace_id?: string;
};

export class MsuApiError extends Error {
  code: number;
  traceId?: string;

  constructor(body: MsuFailure) {
    super(body.error.message);
    this.name = 'MsuApiError';
    this.code = body.error.code;
    this.traceId = body.traceId ?? body.trace_id;
  }
}

export async function msuFetch<T>(
  path: string,
  options: {
    apiKey: string;
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | boolean | Array<string | number> | undefined>;
    body?: unknown;
    msuAuthorization?: string;
  },
): Promise<T> {
  const url = new URL(path, BASE_URL);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-nxopen-api-key': options.apiKey,
  };
  if (options.msuAuthorization) headers['msu-authorization'] = options.msuAuthorization;

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const body = (await res.json()) as MsuSuccess<T> | MsuFailure;
  if ('success' in body && body.success === false) throw new MsuApiError(body);
  return (body as MsuSuccess<T>).data;
}
```

### Rate Limits

| Level | RPS | RPD quota |
| --- | ---: | ---: |
| Default | 2 | 3,000 |
| Level 1 | 10 | 50,000 |
| Level 2 | 30 | 200,000 |

Quota는 매일 00:00 UTC에 초기화됩니다. 운영용 에이전트는 API key 단위로 큐를 두고, `ERROR_CODE_TOO_MANY_REQUEST(10)`은 exponential backoff로 재시도하세요. 상향 요청은 `contact_builder@nexpace.io`로 보냅니다.

## Response Envelope

### Success

```json
{
  "success": true,
  "data": {},
  "traceId": "string"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": 3,
    "message": "character not found"
  },
  "traceId": "string"
}
```

### Agent Rules For Responses

- HTTP status가 200이거나 프록시가 status를 감춰도 `success: false`이면 실패로 처리합니다.
- 실패 로그에는 항상 `traceId` 또는 `trace_id`를 포함합니다.
- `data` 구조는 endpoint별로 다릅니다. 공식 문서가 내부 도메인 객체를 단순 `object` 또는 `{}`로만 공개하는 경우가 많으므로 unknown field를 허용하세요.
- 가격, 잔액, 블록체인 식별자에 가까운 값은 문자열인 경우가 많습니다. 정밀도 손실이 허용되지 않으면 JavaScript `number`로 변환하지 마세요.

## Error Codes

| Code | Constant | HTTP | 의미 | 처리 지침 |
| ---: | --- | ---: | --- | --- |
| 0 | `ERROR_CODE_UNSPECIFIED` | 500 | 미분류 서버 오류 | 1회 재시도 후 trace ID와 함께 문의합니다. |
| 2 | `ERROR_CODE_INVALID_ARGUMENT` | 400 | 요청 인자 오류 | 파라미터명, 타입, 필수값을 점검합니다. |
| 3 | `ERROR_CODE_NOT_FOUND` | 404 | 대상 없음 | `assetKey`, `tokenId`, `walletAddress`, metadata ID를 확인합니다. |
| 4 | `ERROR_CODE_INTERNAL_ERROR` | 500 | 서버 내부 오류 | backoff 재시도 후 지속되면 문의합니다. |
| 5 | `ERROR_CODE_PERMISSION_DENIED` | 403 | 권한 부족 | API key scope 또는 사용자 grant를 확인합니다. |
| 6 | `ERROR_CODE_FAILED_PRECONDITION` | 412 | 현재 상태에서 처리 불가 | 리소스 상태를 먼저 검증합니다. |
| 7 | `ERROR_CODE_ALREADY_PROCESS` | 409 | 이미 처리됨 | 중복 요청을 제거합니다. |
| 8 | `ERROR_CODE_UNAUTHENTICATED` | 401 | 인증 실패 | `x-nxopen-api-key` 누락/오류를 확인합니다. |
| 9 | `ERROR_CODE_EXPECTATION_FAILED` | 417 | 서버 측 전제조건 실패 | `error.message`를 기반으로 분기합니다. |
| 10 | `ERROR_CODE_TOO_MANY_REQUEST` | 429 | rate limit 초과 | 큐잉과 exponential backoff를 적용합니다. |
| 11 | `ERROR_CODE_CANCELED` | 408 | timeout/canceled | idempotent read는 재시도합니다. |
| 1001 | `ERROR_CODE_NOT_APPROVE_WALLET` | 403 | wallet asset approval 없음 | 사용자에게 wallet asset access 승인을 요청합니다. |
| 1002 | `ERROR_CODE_NOT_ENOUGH_NESO` | 402 | on-chain NESO 부족 | NESO 충전을 안내합니다. |
| 2002 | `ERROR_CODE_NOT_FOUND_SYNERGY_APP` | 404 | Synergy app 없음 | `client_id`를 확인합니다. |
| 2003 | `ERROR_CODE_NOT_APPROVED_SYNERGY_APP_BY_USER` | 403 | 사용자가 app 승인하지 않음 | app approval 플로우를 다시 실행합니다. |
| 3001 | `ERROR_CODE_INVALID_AUTH_TOKEN` | 401 | MSU auth token 오류 | token 재발급이 필요합니다. |
| 4001 | `ERROR_CODE_TOKEN_EXPIRED` | 401 | access token 만료 | refresh token으로 재발급합니다. |
| 4002 | `ERROR_CODE_TOKEN_EXPIRED_BY_OTHER_APP` | 401 | 같은 app group의 다른 app이 token을 만료시킴 | 재로그인 후 token을 재발급합니다. |

## Identifier Model

| Identifier | 의미 | 사용 기준 |
| --- | --- | --- |
| `assetKey` / `asset_key` | 민팅 상태와 무관하게 존재하는 내부 식별자 | minted/unminted 여부가 불확실한 리소스 조회. |
| `tokenId` / `token_id` | NFT 민팅 이후 발급되는 토큰 식별자 | 리소스가 민팅되었음을 알고 있을 때. 민팅 전이면 `NOT_FOUND(3)` 가능. |
| `walletAddress` | wallet owner 조회 키 | 계정 잔액, 컬렉션, wallet item/character 목록. |
| `itemId`, `questId`, `skillId`, `nodeId` | 게임 metadata ID | static metadata와 enhancement price 조회. |

## Pagination Patterns

### Cursor Pagination

대부분의 list API가 사용합니다. 첫 요청에서는 `cursor`를 생략하고, 다음 요청부터 응답의 `nextCursor`를 넣습니다. 응답의 `hasMore`가 false이면 중단합니다.

```ts
async function collectCursorPages<T>(fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string; hasMore?: boolean }>) {
  const all: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  } while (cursor);
  return all;
}
```

### Page Number Pagination

Search endpoints에서 사용합니다. query key는 `paginationParam.pageNo`, `paginationParam.pageSize`처럼 dotted key 그대로 보냅니다.

응답은 `paginationResult.totalCount`, `paginationResult.pageSize`, `paginationResult.currPageNo`, `paginationResult.isLastPage`를 사용합니다.

Search 문서는 `(pageNo - 1) * pageSize` offset이 10,000을 넘으면 안 된다고 설명합니다.

### Scroll Pagination

Wallet collection 조회에서 사용합니다. 요청은 `paginationParam.lastKey`, `paginationParam.pageSize`, 응답은 `paginationResult.lastKey`, `paginationResult.isLastPage`를 기준으로 처리합니다.

## Common Types

### Category

| Field | Type | 의미 |
| --- | --- | --- |
| `categoryNo` | integer | category number. |
| `label` | string | 사람이 읽는 category label. |
| `tier0` | CategoryTier | 최상위 분류. NFT, FT, Character 등. |
| `tier1` | CategoryTier | 대분류. |
| `tier2` | CategoryTier | 중분류. |
| `tier3` | CategoryTier | 소분류. |

### CategoryTier

| Field | Type | 의미 |
| --- | --- | --- |
| `label` | string | tier label. |
| `code` | string | tier code. |

### TokenType

| Value | 의미 |
| --- | --- |
| `TOKEN_TYPE_UNSPECIFIED` (0) | unspecified. |
| `TOKEN_TYPE_NFT_ITEM` (1) | NFT item. |
| `TOKEN_TYPE_FT_ITEM` (2) | FT item. |
| `TOKEN_TYPE_NFT_CHARACTER` (3) | NFT character. |
| `TOKEN_TYPE_NFT_NICKNAME` (4) | NFT nickname. |

## Official Document Inconsistencies To Preserve In Clients

- `traceId` vs `trace_id`: Builder Guide는 camelCase라고 설명하고 예시는 `traceId`를 쓰지만, Introduction과 Swagger는 `trace_id`를 씁니다. 둘 다 읽으세요.
- `/msu-open-api/openapi.json`은 MSU API가 아니라 Mintlify sample Plant Store 스펙입니다. 실제 스펙은 `https://docs.msu.io/openapi-v1rc1.swagger.json`입니다.
- Swagger에는 36개 path만 있습니다. 공식 페이지에는 Rewards, MCP Resource, GameMeta exclusive-item 등이 추가로 존재하므로 이 문서에 함께 포함했습니다.
- Search array query encoding은 명시되어 있지 않습니다. production test 전까지는 `URLSearchParams.append`로 repeated key 방식을 우선 사용하세요.
- `POST /v1rc1/msn/server`: 상세 페이지는 POST, Builder Guide summary는 GET으로 표기합니다. 이 문서는 상세 페이지와 curl 예시 기준 POST를 따릅니다.

## Endpoint Matrix

### Accounts

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/accounts/{walletAddress}/neso` | Retrieve both on-chain and off-chain NESO balances for a wallet | [doc](https://docs.msu.io/msu-open-api/accounts/get-neso.md) |
| `GET /v1rc1/accounts/{walletAddress}/characters` | Retrieve a list of characters associated with the given wallet address. Pagination is supported, with range of 1 to 100 items per page. Default pagination: pageNo=1, pageSize=10 | [doc](https://docs.msu.io/msu-open-api/accounts/list-characters.md) |
| `GET /v1rc1/accounts/{walletAddress}/collection` | Retrieve a list of collection owned by a wallet address | [doc](https://docs.msu.io/msu-open-api/accounts/list-collection.md) |
| `GET /v1rc1/accounts/{walletAddress}/currencies` | Retrieve only internally defined currencies and balances for a given wallet address | [doc](https://docs.msu.io/msu-open-api/accounts/list-currencies.md) |
| `GET /v1rc1/accounts/{walletAddress}/items` | Retrieve a list of items owned by a wallet address. Pagination is supported, with range of 1 to 200 items per page. Default pagination: pageNo=1, pageSize=10 | [doc](https://docs.msu.io/msu-open-api/accounts/list-wallet-items.md) |

### Characters

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/characters/by-token-id/{tokenId}` | Retrieve detailed information using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/get-character-by-token-id.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/vmatrix` | Retrieve character V-Matrix information using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/get-character-vmatrix-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/vmatrix` | Retrieve character V-Matrix information using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/get-character-vmatrix.md) |
| `GET /v1rc1/characters/{assetKey}` | Retrieve detailed information using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/get-character.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/history-missions` | Retrieve character history mission information with optional filtering by main and sub categories | [doc](https://docs.msu.io/msu-open-api/characters/list-character-history-missions-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/history-missions` | Retrieve character history mission information with optional filtering by main and sub categories | [doc](https://docs.msu.io/msu-open-api/characters/list-character-history-missions.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/hyper-skill` | Retrieve character hyper-skill information using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/list-character-hyper-skills-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/hyper-skill` | Retrieve character hyper-skill information using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/list-character-hyper-skills.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/items` | Retrieve a list of items owned by a character using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/list-character-items-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/items` | Retrieve a list of items owned by a character using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/list-character-items.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/quests` | Retrieve character quest information using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/list-character-quests-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/quests` | Retrieve character quest information using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/list-character-quests.md) |
| `GET /v1rc1/characters/by-token-id/{tokenId}/skills` | Retrieve character skill information using the character token ID | [doc](https://docs.msu.io/msu-open-api/characters/list-character-skills-by-token-id.md) |
| `GET /v1rc1/characters/{assetKey}/skills` | Retrieve character skill information using the character asset key | [doc](https://docs.msu.io/msu-open-api/characters/list-character-skills.md) |

### Enhancement

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/enhancement/items/{itemId}/dynamicprice` | Retrieves all enhancement prices (e.g. StarForce, Potential) for a given item using only its meta ID | [doc](https://docs.msu.io/msu-open-api/enhancement/get-dynamic-price.md) |

### GameMeta

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/gamemeta/items/{itemId}/category` | Retrieve category information for a specific item using its item ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-item-category.md) |
| `GET /v1rc1/gamemeta/items/{itemId}/exclusive` | Retrieve a list of items that cannot be equipped simultaneously with the specified item. | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-item-exclusive.md) |
| `GET /v1rc1/gamemeta/items/{itemId}` | Retrieve metadata for an item using its item ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-item-metadata.md) |
| `GET /v1rc1/gamemeta/items/{itemId}/set` | Retrieve set information for a specific item using its item ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-item-set.md) |
| `GET /v1rc1/gamemeta/quests/{questId}` | Retrieve metadata for a specific quest using its quest ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-quest-metadata.md) |
| `GET /v1rc1/gamemeta/skills/{skillId}` | Retrieve metadata for a specific skill using its skill ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-skill-metadata.md) |
| `GET /v1rc1/gamemeta/vmatrix/{nodeId}` | Retrieve metadata for a specific V-Matrix node skill using its node ID | [doc](https://docs.msu.io/msu-open-api/gamemeta/get-vmatrix-node-skill.md) |

### Game Resource

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `POST /v1rc1/resource/mcp` | Proxy request to MCP (Model Context Protocol) resources | [doc](https://docs.msu.io/msu-open-api/game-resource/get-mcp-proxy.md) |

### Items

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/items/by-token-id/{tokenId}` | Retrieve detailed NFT item information using the token id. | [doc](https://docs.msu.io/msu-open-api/items/get-nft-item-by-token-id.md) |
| `GET /v1rc1/items/{assetKey}` | Retrieve detailed NFT item information using the item asset key. | [doc](https://docs.msu.io/msu-open-api/items/get-nft-item.md) |
| `GET /v1rc1/items/by-token-id/{tokenId}/history-missions` | Retrieve a list of history missions for a specific NFT item using the token id. Pagination is supported, with 20 items per page. | [doc](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-by-token-id.md) |
| `GET /v1rc1/items/by-token-id/{tokenId}/history-missions/representative` | Retrieve a list of representative history missions for a specific NFT item using the token ID. Pagination is supported, with 20 items per page. | [doc](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-representative-by-token-id.md) |
| `GET /v1rc1/items/{assetKey}/history-missions/representative` | Retrieve a list of representative history missions for a specific NFT item using the item asset key. Pagination is supported, with 20 items per page. | [doc](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-representative.md) |
| `GET /v1rc1/items/{assetKey}/history-missions` | Retrieve a list of history missions for a specific NFT item using the item asset key. Pagination is supported, with 20 items per page. | [doc](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions.md) |

### Rewards

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/msn/characters/{characterAssetKey}/raffles/history` | Retrieve raffle participation history for a specific character (up to 30 days after the draw). | [doc](https://docs.msu.io/msu-open-api/rewards/get-character-raffles-history.md) |
| `GET /v1rc1/msn/characters/{characterAssetKey}/raffles` | Retrieve raffle participation status for a specific character (before the draw). | [doc](https://docs.msu.io/msu-open-api/rewards/get-character-raffles.md) |
| `POST /v1rc1/msn/layers/static` | Retrieve static data for layers including level ranges and layer names. | [doc](https://docs.msu.io/msu-open-api/rewards/get-layer-static.md) |
| `POST /v1rc1/msn/rewards/{worldId}/history` | Retrieve reward draw history (up to 30 days after the draw). | [doc](https://docs.msu.io/msu-open-api/rewards/get-reward-history.md) |
| `POST /v1rc1/msn/rewards/{worldId}` | Retrieve reward status information including drop rates, inventory for fields, bosses, and contents. | [doc](https://docs.msu.io/msu-open-api/rewards/get-reward-information.md) |
| `POST /v1rc1/msn/server` | Retrieve server info for layers including level ranges and layer names. | [doc](https://docs.msu.io/msu-open-api/rewards/get-server-info.md) |

### Search

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /v1rc1/search/characters` | Explore NFT characters listed on the marketplace. | [doc](https://docs.msu.io/msu-open-api/search/explore-characters.md) |
| `GET /v1rc1/search/items` | Explore NFT items listed on the marketplace. | [doc](https://docs.msu.io/msu-open-api/search/explore-items.md) |
| `GET /v1rc1/search/nicknames` | Explore NFT nicknames listed on the marketplace. | [doc](https://docs.msu.io/msu-open-api/search/explore-nicknames.md) |
| `GET /v1rc1/search/suggest` | Retrieve autocomplete keyword suggestions based on a search keyword. | [doc](https://docs.msu.io/msu-open-api/search/suggest-keywords.md) |

## Endpoint Details

## Accounts

### Get NESO balance

- Method/path: `GET /v1rc1/accounts/{walletAddress}/neso`
- Source: [accounts/get-neso.md](https://docs.msu.io/msu-open-api/accounts/get-neso.md)
- Operation ID: `AccountService_GetNeso2`
- Response schema: `GetNesoResponse`
- 목적: Retrieve both on-chain and off-chain NESO balances for a wallet

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | The wallet address to query |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `offchainNeso` | string | Off-chain NESO balance |
| `onchainNeso` | string | On-chain NESO balance |

Example response

```json
{
    "success": true,
    "data": {
      "offchainNeso": "0",
      "onchainNeso": "0"
    }
  }
```

### Get Character List

- Method/path: `GET /v1rc1/accounts/{walletAddress}/characters`
- Source: [accounts/list-characters.md](https://docs.msu.io/msu-open-api/accounts/list-characters.md)
- Operation ID: `AccountService_ListCharacters2`
- Response schema: `ListCharactersResponse`
- 목적: Retrieve a list of characters associated with the given wallet address. Pagination is supported, with range of 1 to 100 items per page. Default pagination: pageNo=1, pageSize=10

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | The wallet address to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `isTradable` | boolean | No | isTradable |
| `name` | string | No | name |
| `cursor` | string | No | cursor |
| `size` | integer | No | size |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `characters` | array | characters |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Implementation notes

- 커서 기반 페이지네이션입니다. 페이지 문서는 `name`, `size`를 설명하고 Swagger는 `isTradable`, `cursor`를 노출합니다. 클라이언트에서는 문서화된 키를 모두 허용하는 편이 안전합니다.
- 페이지 크기 범위는 1-100, 기본값은 10으로 문서화되어 있습니다.

Example response

```json
{
    "success": true,
    "data": {
      "characters": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get wallet collection list

- Method/path: `GET /v1rc1/accounts/{walletAddress}/collection`
- Source: [accounts/list-collection.md](https://docs.msu.io/msu-open-api/accounts/list-collection.md)
- Operation ID: `AccountService_ListCollection2`
- Response schema: `ListCollectionResponse`
- 목적: Retrieve a list of collection owned by a wallet address

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | The wallet address to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `paginationParam.lastKey` | string | No | Last key for pagination |
| `paginationParam.pageSize` | integer | No | Number of items per page |
| `traceId` | string | No | Request trace ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `collection` | array | List of collection items |
| `paginationResult` | object | Pagination information |
| `traceId` | string | Request trace ID |

Implementation notes

- 스크롤 페이지네이션을 사용합니다. 요청은 `paginationParam.lastKey`, `paginationParam.pageSize`, 응답은 `paginationResult`를 중심으로 처리합니다.
- 페이지 크기 범위는 1-200, 기본값은 10입니다.

Example response

```json
{
    "success": true,
    "data": {
      "collection": [],
      "paginationResult": {},
      "traceId": "string"
    }
  }
```

### Get currency list

- Method/path: `GET /v1rc1/accounts/{walletAddress}/currencies`
- Source: [accounts/list-currencies.md](https://docs.msu.io/msu-open-api/accounts/list-currencies.md)
- Operation ID: `AccountService_ListCurrency2`
- Response schema: `ListCurrencyResponse`
- 목적: Retrieve only internally defined currencies and balances for a given wallet address

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | The wallet address to query |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `currency` | array | List of currency objects with balances |

Example response

```json
{
    "success": true,
    "data": {
      "currency": []
    }
  }
```

### Get Wallet Item List

- Method/path: `GET /v1rc1/accounts/{walletAddress}/items`
- Source: [accounts/list-wallet-items.md](https://docs.msu.io/msu-open-api/accounts/list-wallet-items.md)
- Operation ID: `AccountService_ListWalletItems2`
- Response schema: `ListWalletItemsResponse`
- 목적: Retrieve a list of items owned by a wallet address. Pagination is supported, with range of 1 to 200 items per page. Default pagination: pageNo=1, pageSize=10

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | The wallet address to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `categoryNo` | integer | No | categoryNo |
| `isOnSale` | boolean | No | isOnSale |
| `tokenName` | string | No | tokenName |
| `cursor` | string | No | cursor |
| `size` | integer | No | size |
| `tokenId` | string | No | Swagger 스펙에만 있는 파라미터입니다. 엔드포인트 상세 페이지에는 별도 설명이 없습니다. |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `elements` | array | elements |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Implementation notes

- 커서 기반 페이지네이션입니다. 페이지 문서는 `size`를 설명하고 Swagger는 `tokenId`를 추가로 노출합니다. 실제 서버 검증 전까지 두 키를 모두 보존하세요.
- 페이지 크기 범위는 1-200, 기본값은 10으로 문서화되어 있습니다.

Example response

```json
{
    "success": true,
    "data": {
      "elements": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

## Characters

### Get character details by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}`
- Source: [characters/get-character-by-token-id.md](https://docs.msu.io/msu-open-api/characters/get-character-by-token-id.md)
- Operation ID: `CharacterService_GetCharacterByTokenId2`
- Response schema: `GetCharacterResponse`
- 목적: Retrieve detailed information using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `character` | object | Full character object with detailed information |

Implementation notes

- `tokenId`는 NFT 민팅 이후에만 존재합니다. 민팅 전 대상에 by-token-id 엔드포인트를 호출하면 `NOT_FOUND(3)`가 날 수 있습니다.

Example response

```json
{
    "success": true,
    "data": {
      "character": {}
    }
  }
```

### Get character V-Matrix by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/vmatrix`
- Source: [characters/get-character-vmatrix-by-token-id.md](https://docs.msu.io/msu-open-api/characters/get-character-vmatrix-by-token-id.md)
- Operation ID: `CharacterService_GetCharacterVMatrixByTokenId2`
- Response schema: `GetCharacterVMatrixResponse`
- 목적: Retrieve character V-Matrix information using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `matrixPoint` | integer | Matrix points available |
| `vCoreShardCount` | integer | Number of V-Core shards |
| `vMatrixSlots` | array | List of V-Matrix slot objects |
| `vMatrixNodes` | array | List of V-Matrix node objects |

Example response

```json
{
    "success": true,
    "data": {
      "matrixPoint": 0,
      "vCoreShardCount": 0,
      "vMatrixSlots": [],
      "vMatrixNodes": []
    }
  }
```

### Get character V-Matrix

- Method/path: `GET /v1rc1/characters/{assetKey}/vmatrix`
- Source: [characters/get-character-vmatrix.md](https://docs.msu.io/msu-open-api/characters/get-character-vmatrix.md)
- Operation ID: `CharacterService_GetCharacterVMatrix2`
- Response schema: `GetCharacterVMatrixResponse`
- 목적: Retrieve character V-Matrix information using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `matrixPoint` | integer | Matrix points available |
| `vCoreShardCount` | integer | Number of V-Core shards |
| `vMatrixSlots` | array | List of V-Matrix slot objects |
| `vMatrixNodes` | array | List of V-Matrix node objects |

Example response

```json
{
    "success": true,
    "data": {
      "matrixPoint": 0,
      "vCoreShardCount": 0,
      "vMatrixSlots": [],
      "vMatrixNodes": []
    }
  }
```

### Get character details

- Method/path: `GET /v1rc1/characters/{assetKey}`
- Source: [characters/get-character.md](https://docs.msu.io/msu-open-api/characters/get-character.md)
- Operation ID: `CharacterService_GetCharacter2`
- Response schema: `GetCharacterResponse`
- 목적: Retrieve detailed information using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `character` | object | Full character object with detailed information |

Example response

```json
{
    "success": true,
    "data": {
      "character": {}
    }
  }
```

### Get character history mission list by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/history-missions`
- Source: [characters/list-character-history-missions-by-token-id.md](https://docs.msu.io/msu-open-api/characters/list-character-history-missions-by-token-id.md)
- Operation ID: `CharacterService_ListCharacterHistoryMissionsByTokenId2`
- Response schema: `ListCharacterHistoryMissionsResponse`
- 목적: Retrieve character history mission information with optional filtering by main and sub categories

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `mainCategory` | string | No | Filter by main category. Options: `HISTORY_MISSION_MAIN_CATEGORY_CHARACTER`, `HISTORY_MISSION_MAIN_CATEGORY_ITEM`, `HISTORY_MISSION_MAIN_CATEGORY_ADVENTURE`, `HISTORY_MISSION_MAIN_CATEGORY_BATTLE`, `HISTORY_MISSION_MAIN_CATEGORY_BLOCKCHAIN`, `HISTORY_MISSION_MAIN_CATEGORY_SOCIAL` |
| `subCategory` | string | No | Filter by sub category |
| `cursor` | string | No | Pagination cursor for next page |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | List of history mission objects |
| `nextCursor` | string | Cursor for the next page |
| `hasMore` | boolean | Indicates if more results are available |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get character history mission list

- Method/path: `GET /v1rc1/characters/{assetKey}/history-missions`
- Source: [characters/list-character-history-missions.md](https://docs.msu.io/msu-open-api/characters/list-character-history-missions.md)
- Operation ID: `CharacterService_ListCharacterHistoryMissions2`
- Response schema: `ListCharacterHistoryMissionsResponse`
- 목적: Retrieve character history mission information with optional filtering by main and sub categories

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `mainCategory` | string | No | Filter by main category. Options: `HISTORY_MISSION_MAIN_CATEGORY_CHARACTER`, `HISTORY_MISSION_MAIN_CATEGORY_ITEM`, `HISTORY_MISSION_MAIN_CATEGORY_ADVENTURE`, `HISTORY_MISSION_MAIN_CATEGORY_BATTLE`, `HISTORY_MISSION_MAIN_CATEGORY_BLOCKCHAIN`, `HISTORY_MISSION_MAIN_CATEGORY_SOCIAL` |
| `subCategory` | string | No | Filter by sub category |
| `cursor` | string | No | Pagination cursor for next page |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | List of history mission objects |
| `nextCursor` | string | Cursor for the next page |
| `hasMore` | boolean | Indicates if more results are available |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get character hyper-skill list by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/hyper-skill`
- Source: [characters/list-character-hyper-skills-by-token-id.md](https://docs.msu.io/msu-open-api/characters/list-character-hyper-skills-by-token-id.md)
- Operation ID: `CharacterService_ListCharacterHyperSkillsByTokenId2`
- Response schema: `ListCharacterSkillsResponse`
- 목적: Retrieve character hyper-skill information using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skills` | array | List of hyper-skill objects |

Example response

```json
{
    "success": true,
    "data": {
      "skills": []
    }
  }
```

### Get character hyper-skill list

- Method/path: `GET /v1rc1/characters/{assetKey}/hyper-skill`
- Source: [characters/list-character-hyper-skills.md](https://docs.msu.io/msu-open-api/characters/list-character-hyper-skills.md)
- Operation ID: `CharacterService_ListCharacterHyperSkills2`
- Response schema: `ListCharacterSkillsResponse`
- 목적: Retrieve character hyper-skill information using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skills` | array | List of hyper-skill objects |

Example response

```json
{
    "success": true,
    "data": {
      "skills": []
    }
  }
```

### Get character item list by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/items`
- Source: [characters/list-character-items-by-token-id.md](https://docs.msu.io/msu-open-api/characters/list-character-items-by-token-id.md)
- Operation ID: `CharacterService_ListCharacterHoldingItemsByTokenId2`
- Response schema: `ListCharacterHoldingItemsResponse`
- 목적: Retrieve a list of items owned by a character using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `categoryNo` | integer | No | Filter by category number |
| `cursor` | string | No | Pagination cursor for next page |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `elements` | array | List of item objects |
| `nextCursor` | string | Cursor for the next page |
| `hasMore` | boolean | Indicates if more results are available |

Implementation notes

- `tokenId`는 NFT 민팅 이후에만 존재합니다. 민팅 전 대상 조회는 `assetKey` 엔드포인트를 우선 사용하세요.

Example response

```json
{
    "success": true,
    "data": {
      "elements": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get character item list

- Method/path: `GET /v1rc1/characters/{assetKey}/items`
- Source: [characters/list-character-items.md](https://docs.msu.io/msu-open-api/characters/list-character-items.md)
- Operation ID: `CharacterService_ListCharacterHoldingItems2`
- Response schema: `ListCharacterHoldingItemsResponse`
- 목적: Retrieve a list of items owned by a character using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `categoryNo` | integer | No | Filter by category number |
| `cursor` | string | No | Pagination cursor for next page |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `elements` | array | List of item objects |
| `nextCursor` | string | Cursor for the next page |
| `hasMore` | boolean | Indicates if more results are available |

Implementation notes

- 공식 문서 기준 20개 단위 커서 페이지네이션입니다.

Example response

```json
{
    "success": true,
    "data": {
      "elements": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get character quest list by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/quests`
- Source: [characters/list-character-quests-by-token-id.md](https://docs.msu.io/msu-open-api/characters/list-character-quests-by-token-id.md)
- Operation ID: `CharacterService_ListCharacterQuestsByTokenId2`
- Response schema: `ListCharacterQuestsResponse`
- 목적: Retrieve character quest information using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `quests` | array | List of quest objects |

Example response

```json
{
    "success": true,
    "data": {
      "quests": []
    }
  }
```

### Get character quest list

- Method/path: `GET /v1rc1/characters/{assetKey}/quests`
- Source: [characters/list-character-quests.md](https://docs.msu.io/msu-open-api/characters/list-character-quests.md)
- Operation ID: `CharacterService_ListCharacterQuests2`
- Response schema: `ListCharacterQuestsResponse`
- 목적: Retrieve character quest information using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `quests` | array | List of quest objects |

Example response

```json
{
    "success": true,
    "data": {
      "quests": []
    }
  }
```

### Get character skill list by token ID

- Method/path: `GET /v1rc1/characters/by-token-id/{tokenId}/skills`
- Source: [characters/list-character-skills-by-token-id.md](https://docs.msu.io/msu-open-api/characters/list-character-skills-by-token-id.md)
- Operation ID: `CharacterService_ListCharacterSkillsByTokenId2`
- Response schema: `ListCharacterSkillsResponse`
- 목적: Retrieve character skill information using the character token ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The character token ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skills` | array | List of skill objects |

Example response

```json
{
    "success": true,
    "data": {
      "skills": []
    }
  }
```

### Get character skill list

- Method/path: `GET /v1rc1/characters/{assetKey}/skills`
- Source: [characters/list-character-skills.md](https://docs.msu.io/msu-open-api/characters/list-character-skills.md)
- Operation ID: `CharacterService_ListCharacterSkills2`
- Response schema: `ListCharacterSkillsResponse`
- 목적: Retrieve character skill information using the character asset key

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The character asset key |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skills` | array | List of skill objects |

Example response

```json
{
    "success": true,
    "data": {
      "skills": []
    }
  }
```

## Enhancement

### Retrieve all enhancement prices by item ID

- Method/path: `GET /v1rc1/enhancement/items/{itemId}/dynamicprice`
- Source: [enhancement/get-dynamic-price.md](https://docs.msu.io/msu-open-api/enhancement/get-dynamic-price.md)
- Operation ID: `DynamicPriceService_GetCurrentPrice2`
- Response schema: `GetCurrentPriceResponse`
- 목적: Retrieves all enhancement prices (e.g. StarForce, Potential) for a given item using only its meta ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `itemId` | integer | Yes | The item meta ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `currentPrices` | object |  |
| `starforce` | object | StarForce enhancement prices by level |
| `potential` | object | Potential enhancement prices by level |

Example response

```json
{
    "success": true,
    "data": {
      "currentPrices": {
        "starforce": {},
        "potential": {}
      }
    }
  }
```

## GameMeta

### Get item category information

- Method/path: `GET /v1rc1/gamemeta/items/{itemId}/category`
- Source: [gamemeta/get-item-category.md](https://docs.msu.io/msu-open-api/gamemeta/get-item-category.md)
- Operation ID: `GameMetadataService_GetItemCategory2`
- Response schema: `GetItemCategoryResponse`
- 목적: Retrieve category information for a specific item using its item ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `itemId` | integer | Yes | The item ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `category` | object | Item category information |

Example response

```json
{
    "success": true,
    "data": {
      "category": {}
    }
  }
```

### Get equipment exclusive items

- Method/path: `GET /v1rc1/gamemeta/items/{itemId}/exclusive`
- Source: [gamemeta/get-item-exclusive.md](https://docs.msu.io/msu-open-api/gamemeta/get-item-exclusive.md)
- 목적: Retrieve a list of items that cannot be equipped simultaneously with the specified item.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `itemId` | integer | Yes | The itemId to query |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `items` | array | items |

Example response

```json
{
    "success": true,
    "data": {
      "items": []
    }
  }
```

### Get item metadata

- Method/path: `GET /v1rc1/gamemeta/items/{itemId}`
- Source: [gamemeta/get-item-metadata.md](https://docs.msu.io/msu-open-api/gamemeta/get-item-metadata.md)
- Operation ID: `GameMetadataService_GetItemMetadata2`
- Response schema: `GetItemMetadataResponse`
- 목적: Retrieve metadata for an item using its item ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `itemId` | integer | Yes | The item ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `item` | object | Item metadata object |

Example response

```json
{
    "success": true,
    "data": {
      "item": {}
    }
  }
```

### Get item set information

- Method/path: `GET /v1rc1/gamemeta/items/{itemId}/set`
- Source: [gamemeta/get-item-set.md](https://docs.msu.io/msu-open-api/gamemeta/get-item-set.md)
- Operation ID: `GameMetadataService_GetItemSet2`
- Response schema: `GetItemSetResponse`
- 목적: Retrieve set information for a specific item using its item ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `itemId` | integer | Yes | The item ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `itemSet` | object | Item set information |

Example response

```json
{
    "success": true,
    "data": {
      "itemSet": {}
    }
  }
```

### Get quest metadata

- Method/path: `GET /v1rc1/gamemeta/quests/{questId}`
- Source: [gamemeta/get-quest-metadata.md](https://docs.msu.io/msu-open-api/gamemeta/get-quest-metadata.md)
- Operation ID: `GameMetadataService_GetQuestMetadata2`
- Response schema: `GetQuestMetadataResponse`
- 목적: Retrieve metadata for a specific quest using its quest ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `questId` | integer | Yes | The quest ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `questMetadata` | object | Quest metadata object |

### Get skill metadata

- Method/path: `GET /v1rc1/gamemeta/skills/{skillId}`
- Source: [gamemeta/get-skill-metadata.md](https://docs.msu.io/msu-open-api/gamemeta/get-skill-metadata.md)
- Operation ID: `GameMetadataService_GetSkillMetadata2`
- Response schema: `GetSkillMetadataResponse`
- 목적: Retrieve metadata for a specific skill using its skill ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `skillId` | integer | Yes | The skill ID |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `level` | integer | No | Skill level |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skillMetadata` | object | Skill metadata object |

Example response

```json
{
    "success": true,
    "data": {
      "skillMetadata": {}
    }
  }
```

### Get V-Matrix node skill metadata

- Method/path: `GET /v1rc1/gamemeta/vmatrix/{nodeId}`
- Source: [gamemeta/get-vmatrix-node-skill.md](https://docs.msu.io/msu-open-api/gamemeta/get-vmatrix-node-skill.md)
- Operation ID: `GameMetadataService_GetVMatrixNodeSkill2`
- Response schema: `GetVMatrixNodeSkillResponse`
- 목적: Retrieve metadata for a specific V-Matrix node skill using its node ID

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `nodeId` | integer | Yes | The V-Matrix node ID |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `level` | integer | No | Node level |
| `skillIdList` | array | No | List of skill IDs |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `nodeId` | integer | Node ID |
| `nodeName` | string | Node name |
| `nodeDesc` | string | Node description |
| `nodeLevel` | integer | Node level |
| `nodeImageUrl` | string | Node image URL |
| `skills` | array | List of skill objects |

Implementation notes

- `skillIdList`는 Swagger에서 array query parameter로 노출됩니다. 배열 인코딩 방식은 명시되어 있지 않으므로 repeated key 방식부터 통합 테스트하세요.

Example response

```json
{
    "success": true,
    "data": {
      "nodeId": 0,
      "nodeName": "string",
      "nodeDesc": "string",
      "nodeLevel": 0,
      "nodeImageUrl": "string",
      "skills": []
    }
  }
```

## Game Resource

### MCP Proxy Request

- Method/path: `POST /v1rc1/resource/mcp`
- Source: [game-resource/get-mcp-proxy.md](https://docs.msu.io/msu-open-api/game-resource/get-mcp-proxy.md)
- 목적: Proxy request to MCP (Model Context Protocol) resources

Path parameters

_없음._

Body parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `rawBody` | string | Yes | Raw JSON-RPC 2.0 request body to forward to the MCP server |
| `sessionId` | string | No | MCP session ID |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `jsonrpc` | string | JSON-RPC version. Always `"2.0"` |
| `id` | integer | Request ID echoed from the original request |
| `result` | object | Result payload. Shape depends on the MCP method called. |
| `error` | object | Set only when a JSON-RPC error occurs. |
| `code` | integer | JSON-RPC error code |
| `message` | string | Human-readable error message |

Implementation notes

- 이 엔드포인트는 표준 MSU `success/data/error` envelope가 아니라 MCP JSON-RPC 응답을 그대로 반환합니다. 응답 Content-Type은 `application/json` 또는 SSE `text/event-stream`일 수 있습니다.

Example response

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {}
  }
```

## Items

### Get NFT item information by token ID

- Method/path: `GET /v1rc1/items/by-token-id/{tokenId}`
- Source: [items/get-nft-item-by-token-id.md](https://docs.msu.io/msu-open-api/items/get-nft-item-by-token-id.md)
- Operation ID: `ItemService_GetNftItemByTokenId2`
- Response schema: `GetNftItemResponse`
- 목적: Retrieve detailed NFT item information using the token id.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The tokenId to query |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `item` | object | item |

Implementation notes

- 아이템도 동일하게 `tokenId`는 민팅 이후 식별자입니다. 민팅 여부가 불확실하면 `assetKey` 조회를 사용하세요.

Example response

```json
{
    "success": true,
    "data": {
      "item": {}
    }
  }
```

### Get NFT item information

- Method/path: `GET /v1rc1/items/{assetKey}`
- Source: [items/get-nft-item.md](https://docs.msu.io/msu-open-api/items/get-nft-item.md)
- Operation ID: `ItemService_GetNftItem2`
- Response schema: `GetNftItemResponse`
- 목적: Retrieve detailed NFT item information using the item asset key.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The assetKey to query |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `item` | object | item |

Example response

```json
{
    "success": true,
    "data": {
      "item": {}
    }
  }
```

### Get NFT item history mission list by token ID

- Method/path: `GET /v1rc1/items/by-token-id/{tokenId}/history-missions`
- Source: [items/list-nft-item-history-missions-by-token-id.md](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-by-token-id.md)
- Operation ID: `ItemService_ListNftItemHistoryMissionsByTokenId2`
- Response schema: `ListNftItemHistoryMissionsResponse`
- 목적: Retrieve a list of history missions for a specific NFT item using the token id. Pagination is supported, with 20 items per page.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The tokenId to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `cursor` | string | No | cursor |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | historyMissions |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get representative NFT item history mission list by token ID

- Method/path: `GET /v1rc1/items/by-token-id/{tokenId}/history-missions/representative`
- Source: [items/list-nft-item-history-missions-representative-by-token-id.md](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-representative-by-token-id.md)
- Operation ID: `ItemService_ListNftItemHistoryMissionsRepresentativeByTokenId2`
- Response schema: `ListNftItemHistoryMissionsResponse`
- 목적: Retrieve a list of representative history missions for a specific NFT item using the token ID. Pagination is supported, with 20 items per page.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tokenId` | string | Yes | The tokenId to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `cursor` | string | No | cursor |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | historyMissions |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get representative NFT item history mission list

- Method/path: `GET /v1rc1/items/{assetKey}/history-missions/representative`
- Source: [items/list-nft-item-history-missions-representative.md](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions-representative.md)
- Operation ID: `ItemService_ListNftItemHistoryMissionsRepresentative2`
- Response schema: `ListNftItemHistoryMissionsResponse`
- 목적: Retrieve a list of representative history missions for a specific NFT item using the item asset key. Pagination is supported, with 20 items per page.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The assetKey to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `cursor` | string | No | cursor |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | historyMissions |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

### Get NFT item history mission list

- Method/path: `GET /v1rc1/items/{assetKey}/history-missions`
- Source: [items/list-nft-item-history-missions.md](https://docs.msu.io/msu-open-api/items/list-nft-item-history-missions.md)
- Operation ID: `ItemService_ListNftItemHistoryMissions2`
- Response schema: `ListNftItemHistoryMissionsResponse`
- 목적: Retrieve a list of history missions for a specific NFT item using the item asset key. Pagination is supported, with 20 items per page.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `assetKey` | string | Yes | The assetKey to query |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `cursor` | string | No | cursor |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array | historyMissions |
| `nextCursor` | string | nextCursor |
| `hasMore` | boolean | hasMore |

Example response

```json
{
    "success": true,
    "data": {
      "historyMissions": [],
      "nextCursor": "string",
      "hasMore": false
    }
  }
```

## Rewards

### Get Character Raffle History

- Method/path: `GET /v1rc1/msn/characters/{characterAssetKey}/raffles/history`
- Source: [rewards/get-character-raffles-history.md](https://docs.msu.io/msu-open-api/rewards/get-character-raffles-history.md)
- 목적: Retrieve raffle participation history for a specific character (up to 30 days after the draw).

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `characterAssetKey` | string | Yes | The characterAssetKey |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | walletAddress |
| `raffledAt` | string | No | raffledAt |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `walletAddress` | string | walletAddress |
| `characterAssetKey` | string | characterAssetKey |
| `histories` | array | histories |
| `updatedAt` | string | updatedAt |

Example response

```json
{
    "success": true,
    "data": {
      "walletAddress": "string",
      "characterAssetKey": "string",
      "histories": [],
      "updatedAt": "string"
    }
  }
```

### Get Character Raffle Information

- Method/path: `GET /v1rc1/msn/characters/{characterAssetKey}/raffles`
- Source: [rewards/get-character-raffles.md](https://docs.msu.io/msu-open-api/rewards/get-character-raffles.md)
- 목적: Retrieve raffle participation status for a specific character (before the draw).

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `characterAssetKey` | string | Yes | The characterAssetKey |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `walletAddress` | string | Yes | walletAddress |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `walletAddress` | string | walletAddress |
| `characterAssetKey` | string | characterAssetKey |
| `informations` | array | informations |
| `updatedAt` | string | updatedAt |

Example response

```json
{
    "success": true,
    "data": {
      "walletAddress": "string",
      "characterAssetKey": "string",
      "informations": [],
      "updatedAt": "string"
    }
  }
```

### Get Layer Static Data

- Method/path: `POST /v1rc1/msn/layers/static`
- Source: [rewards/get-layer-static.md](https://docs.msu.io/msu-open-api/rewards/get-layer-static.md)
- 목적: Retrieve static data for layers including level ranges and layer names.

Path parameters

_없음._

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `staticDatas` | array | staticDatas |
| `expiredAt` | string | expiredAt |

Example response

```json
{
    "success": true,
    "data": {
      "staticDatas": [],
      "expiredAt": "string"
    }
  }
```

### Get Reward History

- Method/path: `POST /v1rc1/msn/rewards/{worldId}/history`
- Source: [rewards/get-reward-history.md](https://docs.msu.io/msu-open-api/rewards/get-reward-history.md)
- 목적: Retrieve reward draw history (up to 30 days after the draw).

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `worldId` | integer | Yes | The worldId |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `worldId` | integer | worldId |
| `rewardHistories` | object | rewardHistories |
| `updatedAt` | string | updatedAt |

Example response

```json
{
    "success": true,
    "data": {
      "worldId": null,
      "rewardHistories": {},
      "updatedAt": "string"
    }
  }
```

### Get Reward Information

- Method/path: `POST /v1rc1/msn/rewards/{worldId}`
- Source: [rewards/get-reward-information.md](https://docs.msu.io/msu-open-api/rewards/get-reward-information.md)
- 목적: Retrieve reward status information including drop rates, inventory for fields, bosses, and contents.

Path parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `worldId` | integer | Yes | The worldId |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `worldId` | integer | worldId |
| `rewardInformations` | object | rewardInformations |
| `updatedAt` | string | updatedAt |

Example response

```json
{
    "success": true,
    "data": {
      "worldId": null,
      "rewardInformations": {},
      "updatedAt": "string"
    }
  }
```

### Get Server Info

- Method/path: `POST /v1rc1/msn/server`
- Source: [rewards/get-server-info.md](https://docs.msu.io/msu-open-api/rewards/get-server-info.md)
- 목적: Retrieve server info for layers including level ranges and layer names.

Path parameters

_없음._

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `informations` | array | informations |

Implementation notes

- 상세 페이지와 curl 예시는 POST를 사용합니다. Builder Guide 요약표는 GET이라고 적혀 있어 불일치가 있으므로, 이 문서는 상세 페이지 기준 POST를 따릅니다.

Example response

```json
{
    "success": true,
    "data": {
      "informations": []
    }
  }
```

## Search

### Explore Characters

- Method/path: `GET /v1rc1/search/characters`
- Source: [search/explore-characters.md](https://docs.msu.io/msu-open-api/search/explore-characters.md)
- Operation ID: `SearchService_ExploreCharacters2`
- Response schema: `ExploreCharactersResponse`
- 목적: Explore NFT characters listed on the marketplace.

Path parameters

_없음._

Header parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `msu-authorization` | string | No | Auth token. When provided, search filters are applied; without it, filters are not applied. |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `filter.name` | string | No | Character name partial match (bidirectional wildcard, case-sensitive) |
| `filter.class` | string | No | Class filter. Use `all_classes` (default) for all classes |
| `filter.job` | string | No | Job filter. Includes all job advancement stages 1–5. Use `all_jobs` (default) to remove filter |
| `filter.attackPower` | string | No | Minimum attack power threshold (inclusive). Positive integers only |
| `filter.price.min` | number | No | Minimum price (NESO, ≥0) |
| `filter.price.max` | number | No | Maximum price (NESO, ≥min) |
| `filter.level.min` | integer | No | Minimum level |
| `filter.level.max` | integer | No | Maximum level (≥min) |
| `sorting` | string | No | Sort criterion (`HIGHEST_PRICE`, `LOWEST_PRICE`, `ENDING_SOON`, `RECENTLY_LISTED`, `HIGHEST_ATTACK_POWER`) |
| `paginationParam.pageNo` | integer | No | Page number (starting from 1, default: 1) |
| `paginationParam.pageSize` | integer | No | Page size (default: 30). Combined offset of `(pageNo-1) × pageSize` must not exceed 10,000 |
| `walletAddr` | string | No | Swagger 스펙에만 있는 파라미터입니다. 엔드포인트 상세 페이지에는 별도 설명이 없습니다. |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `characters` | array | List of characters on sale |
| `paginationResult.totalCount` | integer | Total result count |
| `paginationResult.currPageNo` | integer | Current page number |
| `paginationResult.pageSize` | integer | Page size |
| `paginationResult.isLastPage` | boolean | Whether this is the last page |

Implementation notes

- 검색 페이지는 `msu-authorization`을 optional로 표시합니다. Swagger는 `walletAddr`도 노출하므로 필요하면 optional query로 열어두세요.

Example response

```json
{
    "success": true,
    "data": {
      "characters": [],
      "paginationResult": {
        "totalCount": 0,
        "currPageNo": 1,
        "pageSize": 30,
        "isLastPage": true
      }
    }
  }
```

### Explore Items

- Method/path: `GET /v1rc1/search/items`
- Source: [search/explore-items.md](https://docs.msu.io/msu-open-api/search/explore-items.md)
- Operation ID: `SearchService_ExploreItems2`
- Response schema: `ExploreItemsResponse`
- 목적: Explore NFT items listed on the marketplace.

Path parameters

_없음._

Header parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `msu-authorization` | string | No | Auth token. When provided, search filters are applied; without it, filters are not applied. |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `filter.name` | string | No | Item name partial match (bidirectional wildcard, case-sensitive) |
| `filter.mintingNo` | integer | No | Minting number (exact match) |
| `filter.categoryNo` | integer | No | Category number (exact match) |
| `filter.itemId` | integer | No | Item meta ID (exact match) |
| `filter.classes` | array | No | Class code filter (OR condition). Include `all_classes` to remove filter |
| `filter.achievedCharName` | string | No | History achievement character name (exact match, case-sensitive) |
| `filter.color` | array | No | Color code filter for beauty/hair items (OR condition). Include `all_colors` to remove filter |
| `filter.PetSkills` | array | No | Pet skill code filter (OR condition) |
| `filter.price.min` | number | No | Minimum price (NESO, ≥0) |
| `filter.price.max` | number | No | Maximum price (NESO, ≥min) |
| `filter.level.min` | integer | No | Minimum required level |
| `filter.level.max` | integer | No | Maximum required level (≥min) |
| `filter.starforce.min` | integer | No | Minimum Starforce (valid range: 0–25) |
| `filter.starforce.max` | integer | No | Maximum Starforce |
| `filter.potential.min` | integer | No | Minimum Potential grade (0: Normal, 1: Rare, 2: Epic, 3: Unique, 4: Legendary) |
| `filter.potential.max` | integer | No | Maximum Potential grade |
| `filter.bonusPotential.min` | integer | No | Minimum additional Potential grade |
| `filter.bonusPotential.max` | integer | No | Maximum additional Potential grade |
| `sorting` | string | No | Sort criterion (`HIGHEST_PRICE`, `LOWEST_PRICE`, `ENDING_SOON`, `RECENTLY_LISTED`) |
| `paginationParam.pageNo` | integer | No | Page number (starting from 1, default: 1) |
| `paginationParam.pageSize` | integer | No | Page size (default: 30). Combined offset of `(pageNo-1) × pageSize` must not exceed 10,000 |
| `walletAddr` | string | No | Swagger 스펙에만 있는 파라미터입니다. 엔드포인트 상세 페이지에는 별도 설명이 없습니다. |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `items` | array | List of items on sale |
| `paginationResult.totalCount` | integer | Total result count |
| `paginationResult.currPageNo` | integer | Current page number |
| `paginationResult.pageSize` | integer | Page size |
| `paginationResult.isLastPage` | boolean | Whether this is the last page |

Implementation notes

- 검색 페이지는 `msu-authorization`을 optional로 표시합니다. 제공 시 사용자 기반 필터가 적용되고, 없으면 일부 필터가 적용되지 않을 수 있습니다.
- 공식 query key는 `filter.PetSkills`입니다. 대문자 `P`를 그대로 보존하세요.

Example response

```json
{
    "success": true,
    "data": {
      "items": [],
      "paginationResult": {
        "totalCount": 0,
        "currPageNo": 1,
        "pageSize": 30,
        "isLastPage": true
      }
    }
  }
```

### Explore Nicknames

- Method/path: `GET /v1rc1/search/nicknames`
- Source: [search/explore-nicknames.md](https://docs.msu.io/msu-open-api/search/explore-nicknames.md)
- Operation ID: `SearchService_ExploreNicknames2`
- Response schema: `ExploreNicknamesResponse`
- 목적: Explore NFT nicknames listed on the marketplace.

Path parameters

_없음._

Header parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `msu-authorization` | string | No | Auth token. When provided, search filters are applied; without it, filters are not applied. |

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `filter.name` | string | No | Nickname partial match (case-insensitive, internally normalized to lowercase) |
| `filter.nameLengths` | array | No | Nickname length filter (multi-select, OR condition) |
| `filter.price.min` | number | No | Minimum price (NESO, ≥0) |
| `filter.price.max` | number | No | Maximum price (NESO, ≥min) |
| `filter.characterSets` | array | No | Character composition filter (`ALPHABET_ONLY`, `NUMERIC_ONLY`, `MIXED`) |
| `sorting` | string | No | Sort criterion (`HIGHEST_PRICE`, `LOWEST_PRICE`, `ENDING_SOON`, `RECENTLY_LISTED`) |
| `paginationParam.pageNo` | integer | No | Page number (starting from 1, default: 1) |
| `paginationParam.pageSize` | integer | No | Page size (default: 30). Combined offset of `(pageNo-1) × pageSize` must not exceed 10,000 |
| `walletAddr` | string | No | Swagger 스펙에만 있는 파라미터입니다. 엔드포인트 상세 페이지에는 별도 설명이 없습니다. |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `nicknames` | array | List of nickname NFTs on sale |
| `paginationResult.totalCount` | integer | Total result count |
| `paginationResult.currPageNo` | integer | Current page number |
| `paginationResult.pageSize` | integer | Page size |
| `paginationResult.isLastPage` | boolean | Whether this is the last page |

Implementation notes

- 검색 페이지는 `msu-authorization`을 optional로 표시합니다. Swagger는 `walletAddr`도 노출하므로 필요하면 optional query로 열어두세요.

Example response

```json
{
    "success": true,
    "data": {
      "nicknames": [],
      "paginationResult": {
        "totalCount": 0,
        "currPageNo": 1,
        "pageSize": 30,
        "isLastPage": true
      }
    }
  }
```

### Suggest Keywords

- Method/path: `GET /v1rc1/search/suggest`
- Source: [search/suggest-keywords.md](https://docs.msu.io/msu-open-api/search/suggest-keywords.md)
- Operation ID: `SuggestService_SuggestKeywords2`
- Response schema: `SuggestKeywordsResponse`
- 목적: Retrieve autocomplete keyword suggestions based on a search keyword.

Path parameters

_없음._

Query parameters

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `keyword` | string | No | Search keyword (minimum 2 characters) |
| `type` | string | Yes | Autocomplete type (`item`, `character`, `user`). Returns `400 INVALID_ARGUMENT` if not provided. |
| `tokenType` | string | No | Token type filter (`all`, `nft`, `ft`) |
| `size` | integer | No | Number of results to return |

Response data fields

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `suggestions` | array | List of autocomplete suggestions |

Example response

```json
{
    "success": true,
    "data": {
      "suggestions": []
    }
  }
```

## Swagger Schema Summary

공식 Swagger schema는 많은 도메인 객체를 얕게 노출합니다. 그래도 envelope 이름과 endpoint별 최상위 response field 확인에는 유용합니다.

### CommonSuccessResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `success` | boolean |  |
| `data` | object | API response data |
| `trace_id` | string | Request trace ID |

### CommonErrorResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `success` | boolean |  |
| `error` | CommonErrorDetail |  |
| `trace_id` | string | Request trace ID |

### CommonErrorDetail

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `code` | integer/int32 | Error code |
| `message` | string | Error message |

### GetNesoResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `offchainNeso` | string |  |
| `onchainNeso` | string |  |

### GetCurrentPriceResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `currentPrices` | PriceForItem |  |

### PriceForItem

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `starforce` | object |  |
| `potential` | object |  |

### DynamicPrice

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `previousPrice` | DynamicPriceDetail |  |
| `currentPrice` | DynamicPriceDetail |  |

### DynamicPriceDetail

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `price` | string |  |
| `step` | string |  |
| `createDate` | string |  |
| `startDate` | string |  |
| `endDate` | string |  |

### GetCharacterResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `character` | object | Full character object |

### GetCharacterVMatrixResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `matrixPoint` | integer/int32 |  |
| `vCoreShardCount` | integer/int32 |  |
| `vMatrixSlots` | array<object> |  |
| `vMatrixNodes` | array<object> |  |

### ListCharactersResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `characters` | array<object> |  |
| `nextCursor` | string |  |
| `hasMore` | boolean |  |

### ListCollectionResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `collection` | array<object> |  |
| `paginationResult` | object |  |
| `traceId` | string |  |

### ListCurrencyResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `currency` | array<object> |  |

### ListWalletItemsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `elements` | array<object> |  |
| `nextCursor` | string |  |
| `hasMore` | boolean |  |

### ListCharacterHoldingItemsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `elements` | array<object> |  |
| `nextCursor` | string |  |
| `hasMore` | boolean |  |

### ListCharacterSkillsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skills` | array<object> |  |

### ListCharacterQuestsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `quests` | array<object> |  |

### ListCharacterHistoryMissionsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array<object> |  |
| `nextCursor` | string |  |
| `hasMore` | boolean |  |

### GetItemMetadataResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `item` | object |  |

### GetItemCategoryResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `category` | object |  |

### GetItemSetResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `itemSet` | object |  |

### GetQuestMetadataResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `questMetadata` | object |  |

### GetSkillMetadataResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `skillMetadata` | object |  |

### GetVMatrixNodeSkillResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `nodeId` | integer/int32 |  |
| `nodeName` | string |  |
| `nodeDesc` | string |  |
| `nodeLevel` | integer/int32 |  |
| `nodeImageUrl` | string |  |
| `skills` | array<object> |  |

### GetNftItemResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `item` | object |  |

### ListNftItemHistoryMissionsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `historyMissions` | array<object> |  |
| `nextCursor` | string |  |
| `hasMore` | boolean |  |

### ExploreItemsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `items` | array<object> |  |
| `paginationResult` | object |  |

### ExploreCharactersResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `characters` | array<object> |  |
| `paginationResult` | object |  |

### ExploreNicknamesResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `nicknames` | array<object> |  |
| `paginationResult` | object |  |

### SuggestKeywordsResponse

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `suggestions` | array<object> |  |

## Client Implementation Checklist

- `x-nxopen-api-key`, `msu-authorization`, base URL, retry, response envelope parsing을 한 곳에 모으세요.
- Default limit은 2 RPS / 3,000 RPD입니다. higher tier key가 아니라면 API key 단위 queue를 둡니다.
- 민팅 전 데이터 가능성이 있으면 `assetKey` endpoint를 우선 사용하고, NFT 민팅이 확실할 때만 `by-token-id` endpoint를 사용합니다.
- 공식 문서가 `object`로만 공개한 복잡한 도메인 객체는 passthrough unknown field로 보존합니다.
- 가격, 잔액, blockchain-like identifier는 string 또는 decimal-safe 값으로 유지합니다.
- 검색 query는 dotted key와 대소문자를 그대로 보냅니다. 예: `filter.price.min`, `paginationParam.pageNo`, `filter.PetSkills`.
- 실패 로그와 support report에는 항상 `traceId` 또는 `trace_id`를 넣습니다.
- 테스트는 success envelope, failure envelope, rate limit, token expiration, cursor pagination, page pagination, by-token `NOT_FOUND`를 포함하세요.
