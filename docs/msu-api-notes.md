# MSU API Notes

Source: `api-reference.md`

## Request Rules

- Base URL: `https://openapi.msu.io`
- Required header: `x-nxopen-api-key`
- Optional user header: `msu-authorization`
- API key stays server-side only. Browser client should use server proxy or cached manifest.
- Default quota: 2 RPS / 3,000 RPD. Manifest builder should queue requests and back off on `ERROR_CODE_TOO_MANY_REQUEST`.

## Response Envelope

Successful MSU responses use:

```ts
type MsuSuccess<T> = {
  success: true;
  data: T;
  traceId?: string;
  trace_id?: string;
};
```

Failure responses use:

```ts
type MsuFailure = {
  success: false;
  error: { code: number; message: string };
  traceId?: string;
  trace_id?: string;
};
```

Implementation must treat `success: false` as failure even when HTTP status is 200. Failure logs should include `traceId ?? trace_id`.

## Unknown Field Policy

Official docs expose many domain payloads as `object`, `{}`, or `array<object>`. Type drafts preserve known top-level fields and keep nested domain data as `Record<string, unknown>`.

Rules:

- Preserve raw API response in cache/manifest build output.
- Narrow runtime fields only after validation.
- Do not drop unknown fields from character, item, skill, V-Matrix, reward, history, or pagination objects.
- Keep documented top-level fields in TypeScript drafts; keep `{}`, `object`, and nested domain payloads as `UnknownRecord`.
- Keep money-like values, balances, and blockchain-like identifiers as strings unless schema proves safe numeric range.

## Selected Endpoints

### Character

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `listWalletCharacters` | GET | `/v1rc1/accounts/{walletAddress}/characters` | `ListCharactersResponse` |
| `getCharacterByAssetKey` | GET | `/v1rc1/characters/{assetKey}` | `GetCharacterResponse` |
| `getCharacterByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}` | `GetCharacterResponse` |
| `getCharacterVMatrixByAssetKey` | GET | `/v1rc1/characters/{assetKey}/vmatrix` | `GetCharacterVMatrixResponse` |
| `getCharacterVMatrixByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/vmatrix` | `GetCharacterVMatrixResponse` |
| `listCharacterSkillsByAssetKey` | GET | `/v1rc1/characters/{assetKey}/skills` | `ListCharacterSkillsResponse` |
| `listCharacterSkillsByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/skills` | `ListCharacterSkillsResponse` |
| `listCharacterHyperSkillsByAssetKey` | GET | `/v1rc1/characters/{assetKey}/hyper-skill` | `ListCharacterSkillsResponse` |
| `listCharacterHyperSkillsByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/hyper-skill` | `ListCharacterSkillsResponse` |
| `listCharacterItemsByAssetKey` | GET | `/v1rc1/characters/{assetKey}/items` | `ListCharacterHoldingItemsResponse` |
| `listCharacterItemsByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/items` | `ListCharacterHoldingItemsResponse` |
| `listCharacterQuestsByAssetKey` | GET | `/v1rc1/characters/{assetKey}/quests` | `ListCharacterQuestsResponse` |
| `listCharacterQuestsByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/quests` | `ListCharacterQuestsResponse` |
| `listCharacterHistoryMissionsByAssetKey` | GET | `/v1rc1/characters/{assetKey}/history-missions` | `ListCharacterHistoryMissionsResponse` |
| `listCharacterHistoryMissionsByTokenId` | GET | `/v1rc1/characters/by-token-id/{tokenId}/history-missions` | `ListCharacterHistoryMissionsResponse` |

Use `assetKey` endpoints first. Use `by-token-id` only when NFT minting is confirmed.

### Skill And V-Matrix

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `getSkillMetadata` | GET | `/v1rc1/gamemeta/skills/{skillId}` | `GetSkillMetadataResponse` |
| `getVMatrixNodeSkillMetadata` | GET | `/v1rc1/gamemeta/vmatrix/{nodeId}` | `GetVMatrixNodeSkillResponse` |

`getVMatrixNodeSkillMetadata` has `nodeImageUrl`, strongest documented image field for MVP bullet/icon assets. `skillIdList` array encoding is unspecified; start with repeated query keys.

### Item

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `listWalletItems` | GET | `/v1rc1/accounts/{walletAddress}/items` | `ListWalletItemsResponse` |
| `getDynamicPrice` | GET | `/v1rc1/enhancement/items/{itemId}/dynamicprice` | `GetCurrentPriceResponse` |
| `getItemMetadata` | GET | `/v1rc1/gamemeta/items/{itemId}` | `GetItemMetadataResponse` |
| `getItemCategory` | GET | `/v1rc1/gamemeta/items/{itemId}/category` | `GetItemCategoryResponse` |
| `getItemSet` | GET | `/v1rc1/gamemeta/items/{itemId}/set` | `GetItemSetResponse` |
| `getItemExclusive` | GET | `/v1rc1/gamemeta/items/{itemId}/exclusive` | `GetItemExclusiveResponse` |
| `getNftItemByAssetKey` | GET | `/v1rc1/items/{assetKey}` | `GetNftItemResponse` |
| `getNftItemByTokenId` | GET | `/v1rc1/items/by-token-id/{tokenId}` | `GetNftItemResponse` |
| `listNftItemHistoryMissionsByAssetKey` | GET | `/v1rc1/items/{assetKey}/history-missions` | `ListNftItemHistoryMissionsResponse` |
| `listNftItemHistoryMissionsByTokenId` | GET | `/v1rc1/items/by-token-id/{tokenId}/history-missions` | `ListNftItemHistoryMissionsResponse` |
| `listRepresentativeNftItemHistoryMissionsByAssetKey` | GET | `/v1rc1/items/{assetKey}/history-missions/representative` | `ListNftItemHistoryMissionsResponse` |
| `listRepresentativeNftItemHistoryMissionsByTokenId` | GET | `/v1rc1/items/by-token-id/{tokenId}/history-missions/representative` | `ListNftItemHistoryMissionsResponse` |

Wallet item list accepts `categoryNo`, `isOnSale`, `tokenName`, `cursor`, `size`, and Swagger-only `tokenId`. Character-held item list accepts `categoryNo` and `cursor`.

### Quest Metadata

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `getQuestMetadata` | GET | `/v1rc1/gamemeta/quests/{questId}` | `GetQuestMetadataResponse` |

Quest metadata is only shallowly documented as `questMetadata: object`; keep payload as unknown passthrough.

### Reward

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `getCharacterRaffleHistory` | GET | `/v1rc1/msn/characters/{characterAssetKey}/raffles/history` | `CharacterRaffleHistoryResponse` |
| `getCharacterRaffleInformation` | GET | `/v1rc1/msn/characters/{characterAssetKey}/raffles` | `CharacterRaffleInformationResponse` |
| `getLayerStaticData` | POST | `/v1rc1/msn/layers/static` | `LayerStaticDataResponse` |
| `getRewardHistory` | POST | `/v1rc1/msn/rewards/{worldId}/history` | `RewardHistoryResponse` |
| `getRewardInformation` | POST | `/v1rc1/msn/rewards/{worldId}` | `RewardInformationResponse` |
| `getServerInfo` | POST | `/v1rc1/msn/server` | `ServerInfoResponse` |

`POST /v1rc1/msn/server` follows endpoint detail and curl example. Builder Guide summary says GET, so keep this inconsistency documented.

### Search

| ID | Method | Path | Response |
| --- | --- | --- | --- |
| `exploreCharacters` | GET | `/v1rc1/search/characters` | `ExploreCharactersResponse` |
| `exploreItems` | GET | `/v1rc1/search/items` | `ExploreItemsResponse` |

Search uses dotted query keys such as `paginationParam.pageNo` and `filter.price.min`. Preserve `filter.PetSkills` uppercase `P`.

## MVP Asset Notes

- Best documented image candidate: V-Matrix `nodeImageUrl`.
- Skill metadata, character objects, item objects, reward payloads expose shallow schemas only.
- Manifest generator should store raw response plus derived fields like `assetKey`, `skillId`, `nodeId`, `displayName`, `imageUrl` when validation succeeds.
- Game runtime should read local manifest only. No MSU API call inside Phaser loop.
