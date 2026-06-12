import type { MsuEndpointDefinition, MsuQueryPrimitive } from './types';

export const MSU_API_BASE_URL = 'https://openapi.msu.io';

export const MSU_AUTH_HEADERS = {
  apiKey: 'x-nxopen-api-key',
  msuAuthorization: 'msu-authorization'
} as const;

export const MSU_ENDPOINTS = {
  listWalletCharacters: {
    id: 'listWalletCharacters',
    group: 'accounts',
    method: 'GET',
    pathTemplate: '/v1rc1/accounts/{walletAddress}/characters',
    responseType: 'ListCharactersResponse',
    source: 'accounts/list-characters.md',
    purpose: 'Retrieve characters for wallet with cursor pagination.',
    requiresApiKey: true,
    pathParams: ['walletAddress'],
    queryParams: ['isTradable', 'name', 'cursor', 'size']
  },
  listWalletItems: {
    id: 'listWalletItems',
    group: 'accounts',
    method: 'GET',
    pathTemplate: '/v1rc1/accounts/{walletAddress}/items',
    responseType: 'ListWalletItemsResponse',
    source: 'accounts/list-wallet-items.md',
    purpose: 'Retrieve wallet-owned item list with cursor pagination.',
    requiresApiKey: true,
    pathParams: ['walletAddress'],
    queryParams: ['categoryNo', 'isOnSale', 'tokenName', 'cursor', 'size', 'tokenId'],
    notes: ['tokenId appears in Swagger only; preserve as optional until server validation.']
  },
  getCharacterByAssetKey: {
    id: 'getCharacterByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}',
    responseType: 'GetCharacterResponse',
    source: 'characters/get-character.md',
    purpose: 'Retrieve character details by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    notes: ['Prefer assetKey when minting state is unknown.']
  },
  getCharacterByTokenId: {
    id: 'getCharacterByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}',
    responseType: 'GetCharacterResponse',
    source: 'characters/get-character-by-token-id.md',
    purpose: 'Retrieve character details by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId'],
    notes: ['Use only when NFT minting is confirmed; otherwise NOT_FOUND is possible.']
  },
  getCharacterVMatrixByAssetKey: {
    id: 'getCharacterVMatrixByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/vmatrix',
    responseType: 'GetCharacterVMatrixResponse',
    source: 'characters/get-character-vmatrix.md',
    purpose: 'Retrieve V-Matrix data for character asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey']
  },
  getCharacterVMatrixByTokenId: {
    id: 'getCharacterVMatrixByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/vmatrix',
    responseType: 'GetCharacterVMatrixResponse',
    source: 'characters/get-character-vmatrix-by-token-id.md',
    purpose: 'Retrieve V-Matrix data for character token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId']
  },
  listCharacterSkillsByAssetKey: {
    id: 'listCharacterSkillsByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/skills',
    responseType: 'ListCharacterSkillsResponse',
    source: 'characters/list-character-skills.md',
    purpose: 'Retrieve character skill list by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey']
  },
  listCharacterSkillsByTokenId: {
    id: 'listCharacterSkillsByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/skills',
    responseType: 'ListCharacterSkillsResponse',
    source: 'characters/list-character-skills-by-token-id.md',
    purpose: 'Retrieve character skill list by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId']
  },
  listCharacterHyperSkillsByAssetKey: {
    id: 'listCharacterHyperSkillsByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/hyper-skill',
    responseType: 'ListCharacterSkillsResponse',
    source: 'characters/list-character-hyper-skills.md',
    purpose: 'Retrieve character hyper-skill list by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey']
  },
  listCharacterHyperSkillsByTokenId: {
    id: 'listCharacterHyperSkillsByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/hyper-skill',
    responseType: 'ListCharacterSkillsResponse',
    source: 'characters/list-character-hyper-skills-by-token-id.md',
    purpose: 'Retrieve character hyper-skill list by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId']
  },
  listCharacterItemsByAssetKey: {
    id: 'listCharacterItemsByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/items',
    responseType: 'ListCharacterHoldingItemsResponse',
    source: 'characters/list-character-items.md',
    purpose: 'Retrieve items held by character asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    queryParams: ['categoryNo', 'cursor']
  },
  listCharacterItemsByTokenId: {
    id: 'listCharacterItemsByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/items',
    responseType: 'ListCharacterHoldingItemsResponse',
    source: 'characters/list-character-items-by-token-id.md',
    purpose: 'Retrieve items held by character token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId'],
    queryParams: ['categoryNo', 'cursor']
  },
  listCharacterQuestsByAssetKey: {
    id: 'listCharacterQuestsByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/quests',
    responseType: 'ListCharacterQuestsResponse',
    source: 'characters/list-character-quests.md',
    purpose: 'Retrieve character quest list by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey']
  },
  listCharacterQuestsByTokenId: {
    id: 'listCharacterQuestsByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/quests',
    responseType: 'ListCharacterQuestsResponse',
    source: 'characters/list-character-quests-by-token-id.md',
    purpose: 'Retrieve character quest list by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId']
  },
  listCharacterHistoryMissionsByAssetKey: {
    id: 'listCharacterHistoryMissionsByAssetKey',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/{assetKey}/history-missions',
    responseType: 'ListCharacterHistoryMissionsResponse',
    source: 'characters/list-character-history-missions.md',
    purpose: 'Retrieve character history missions by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    queryParams: ['mainCategory', 'subCategory', 'cursor']
  },
  listCharacterHistoryMissionsByTokenId: {
    id: 'listCharacterHistoryMissionsByTokenId',
    group: 'characters',
    method: 'GET',
    pathTemplate: '/v1rc1/characters/by-token-id/{tokenId}/history-missions',
    responseType: 'ListCharacterHistoryMissionsResponse',
    source: 'characters/list-character-history-missions-by-token-id.md',
    purpose: 'Retrieve character history missions by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId'],
    queryParams: ['mainCategory', 'subCategory', 'cursor']
  },
  getSkillMetadata: {
    id: 'getSkillMetadata',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/skills/{skillId}',
    responseType: 'GetSkillMetadataResponse',
    source: 'gamemeta/get-skill-metadata.md',
    purpose: 'Retrieve skill metadata by skill ID.',
    requiresApiKey: true,
    pathParams: ['skillId'],
    queryParams: ['level']
  },
  getVMatrixNodeSkillMetadata: {
    id: 'getVMatrixNodeSkillMetadata',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/vmatrix/{nodeId}',
    responseType: 'GetVMatrixNodeSkillResponse',
    source: 'gamemeta/get-vmatrix-node-skill.md',
    purpose: 'Retrieve V-Matrix node skill metadata and node image URL.',
    requiresApiKey: true,
    pathParams: ['nodeId'],
    queryParams: ['level', 'skillIdList'],
    notes: ['skillIdList array encoding is not specified; use repeated query key first.']
  },
  getDynamicPrice: {
    id: 'getDynamicPrice',
    group: 'enhancement',
    method: 'GET',
    pathTemplate: '/v1rc1/enhancement/items/{itemId}/dynamicprice',
    responseType: 'GetCurrentPriceResponse',
    source: 'enhancement/get-dynamic-price.md',
    purpose: 'Retrieve enhancement prices for item metadata ID.',
    requiresApiKey: true,
    pathParams: ['itemId']
  },
  getItemMetadata: {
    id: 'getItemMetadata',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/items/{itemId}',
    responseType: 'GetItemMetadataResponse',
    source: 'gamemeta/get-item-metadata.md',
    purpose: 'Retrieve item metadata by item ID.',
    requiresApiKey: true,
    pathParams: ['itemId']
  },
  getItemCategory: {
    id: 'getItemCategory',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/items/{itemId}/category',
    responseType: 'GetItemCategoryResponse',
    source: 'gamemeta/get-item-category.md',
    purpose: 'Retrieve item category by item ID.',
    requiresApiKey: true,
    pathParams: ['itemId']
  },
  getItemSet: {
    id: 'getItemSet',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/items/{itemId}/set',
    responseType: 'GetItemSetResponse',
    source: 'gamemeta/get-item-set.md',
    purpose: 'Retrieve item set metadata by item ID.',
    requiresApiKey: true,
    pathParams: ['itemId']
  },
  getItemExclusive: {
    id: 'getItemExclusive',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/items/{itemId}/exclusive',
    responseType: 'GetItemExclusiveResponse',
    source: 'gamemeta/get-item-exclusive.md',
    purpose: 'Retrieve items that cannot be equipped with requested item.',
    requiresApiKey: true,
    pathParams: ['itemId']
  },
  getQuestMetadata: {
    id: 'getQuestMetadata',
    group: 'gamemeta',
    method: 'GET',
    pathTemplate: '/v1rc1/gamemeta/quests/{questId}',
    responseType: 'GetQuestMetadataResponse',
    source: 'gamemeta/get-quest-metadata.md',
    purpose: 'Retrieve quest metadata by quest ID.',
    requiresApiKey: true,
    pathParams: ['questId']
  },
  getNftItemByAssetKey: {
    id: 'getNftItemByAssetKey',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/{assetKey}',
    responseType: 'GetNftItemResponse',
    source: 'items/get-nft-item.md',
    purpose: 'Retrieve NFT item details by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    notes: ['Prefer assetKey when minting state is unknown.']
  },
  getNftItemByTokenId: {
    id: 'getNftItemByTokenId',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/by-token-id/{tokenId}',
    responseType: 'GetNftItemResponse',
    source: 'items/get-nft-item-by-token-id.md',
    purpose: 'Retrieve NFT item details by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId']
  },
  listNftItemHistoryMissionsByAssetKey: {
    id: 'listNftItemHistoryMissionsByAssetKey',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/{assetKey}/history-missions',
    responseType: 'ListNftItemHistoryMissionsResponse',
    source: 'items/list-nft-item-history-missions.md',
    purpose: 'Retrieve NFT item history missions by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    queryParams: ['cursor']
  },
  listRepresentativeNftItemHistoryMissionsByAssetKey: {
    id: 'listRepresentativeNftItemHistoryMissionsByAssetKey',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/{assetKey}/history-missions/representative',
    responseType: 'ListNftItemHistoryMissionsResponse',
    source: 'items/list-nft-item-history-missions-representative.md',
    purpose: 'Retrieve representative NFT item history missions by asset key.',
    requiresApiKey: true,
    pathParams: ['assetKey'],
    queryParams: ['cursor']
  },
  listNftItemHistoryMissionsByTokenId: {
    id: 'listNftItemHistoryMissionsByTokenId',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/by-token-id/{tokenId}/history-missions',
    responseType: 'ListNftItemHistoryMissionsResponse',
    source: 'items/list-nft-item-history-missions-by-token-id.md',
    purpose: 'Retrieve NFT item history missions by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId'],
    queryParams: ['cursor']
  },
  listRepresentativeNftItemHistoryMissionsByTokenId: {
    id: 'listRepresentativeNftItemHistoryMissionsByTokenId',
    group: 'items',
    method: 'GET',
    pathTemplate: '/v1rc1/items/by-token-id/{tokenId}/history-missions/representative',
    responseType: 'ListNftItemHistoryMissionsResponse',
    source: 'items/list-nft-item-history-missions-representative-by-token-id.md',
    purpose: 'Retrieve representative NFT item history missions by token ID.',
    requiresApiKey: true,
    pathParams: ['tokenId'],
    queryParams: ['cursor']
  },
  getCharacterRaffleHistory: {
    id: 'getCharacterRaffleHistory',
    group: 'rewards',
    method: 'GET',
    pathTemplate: '/v1rc1/msn/characters/{characterAssetKey}/raffles/history',
    responseType: 'CharacterRaffleHistoryResponse',
    source: 'rewards/get-character-raffles-history.md',
    purpose: 'Retrieve character raffle history.',
    requiresApiKey: true,
    pathParams: ['characterAssetKey'],
    queryParams: ['walletAddress', 'raffledAt']
  },
  getCharacterRaffleInformation: {
    id: 'getCharacterRaffleInformation',
    group: 'rewards',
    method: 'GET',
    pathTemplate: '/v1rc1/msn/characters/{characterAssetKey}/raffles',
    responseType: 'CharacterRaffleInformationResponse',
    source: 'rewards/get-character-raffles.md',
    purpose: 'Retrieve character raffle status before draw.',
    requiresApiKey: true,
    pathParams: ['characterAssetKey'],
    queryParams: ['walletAddress']
  },
  getLayerStaticData: {
    id: 'getLayerStaticData',
    group: 'rewards',
    method: 'POST',
    pathTemplate: '/v1rc1/msn/layers/static',
    responseType: 'LayerStaticDataResponse',
    source: 'rewards/get-layer-static.md',
    purpose: 'Retrieve reward layer static data.',
    requiresApiKey: true
  },
  getRewardHistory: {
    id: 'getRewardHistory',
    group: 'rewards',
    method: 'POST',
    pathTemplate: '/v1rc1/msn/rewards/{worldId}/history',
    responseType: 'RewardHistoryResponse',
    source: 'rewards/get-reward-history.md',
    purpose: 'Retrieve reward draw history by world ID.',
    requiresApiKey: true,
    pathParams: ['worldId']
  },
  getRewardInformation: {
    id: 'getRewardInformation',
    group: 'rewards',
    method: 'POST',
    pathTemplate: '/v1rc1/msn/rewards/{worldId}',
    responseType: 'RewardInformationResponse',
    source: 'rewards/get-reward-information.md',
    purpose: 'Retrieve reward status and drop information by world ID.',
    requiresApiKey: true,
    pathParams: ['worldId']
  },
  getServerInfo: {
    id: 'getServerInfo',
    group: 'rewards',
    method: 'POST',
    pathTemplate: '/v1rc1/msn/server',
    responseType: 'ServerInfoResponse',
    source: 'rewards/get-server-info.md',
    purpose: 'Retrieve reward server info.',
    requiresApiKey: true,
    notes: ['Docs conflict between GET and POST; endpoint detail and curl use POST.']
  },
  exploreCharacters: {
    id: 'exploreCharacters',
    group: 'search',
    method: 'GET',
    pathTemplate: '/v1rc1/search/characters',
    responseType: 'ExploreCharactersResponse',
    source: 'search/explore-characters.md',
    purpose: 'Search NFT marketplace characters.',
    requiresApiKey: true,
    supportsMsuAuthorization: true,
    queryParams: [
      'filter.name',
      'filter.class',
      'filter.job',
      'filter.attackPower',
      'filter.price.min',
      'filter.price.max',
      'filter.level.min',
      'filter.level.max',
      'sorting',
      'paginationParam.pageNo',
      'paginationParam.pageSize',
      'walletAddr'
    ]
  },
  exploreItems: {
    id: 'exploreItems',
    group: 'search',
    method: 'GET',
    pathTemplate: '/v1rc1/search/items',
    responseType: 'ExploreItemsResponse',
    source: 'search/explore-items.md',
    purpose: 'Search NFT marketplace items.',
    requiresApiKey: true,
    supportsMsuAuthorization: true,
    queryParams: [
      'filter.name',
      'filter.mintingNo',
      'filter.categoryNo',
      'filter.itemId',
      'filter.classes',
      'filter.achievedCharName',
      'filter.color',
      'filter.PetSkills',
      'filter.price.min',
      'filter.price.max',
      'filter.level.min',
      'filter.level.max',
      'filter.starforce.min',
      'filter.starforce.max',
      'filter.potential.min',
      'filter.potential.max',
      'filter.bonusPotential.min',
      'filter.bonusPotential.max',
      'sorting',
      'paginationParam.pageNo',
      'paginationParam.pageSize',
      'walletAddr'
    ],
    notes: ['Preserve capital P in filter.PetSkills.']
  }
} as const satisfies Record<string, MsuEndpointDefinition>;

export type MsuEndpointId = keyof typeof MSU_ENDPOINTS;
export type MsuEndpoint = (typeof MSU_ENDPOINTS)[MsuEndpointId];

export const MSU_GAME_ENDPOINT_IDS = [
  'exploreCharacters',
  'exploreItems',
  'listWalletItems',
  'getCharacterByAssetKey',
  'getCharacterVMatrixByAssetKey',
  'listCharacterSkillsByAssetKey',
  'listCharacterHyperSkillsByAssetKey',
  'getDynamicPrice',
  'getSkillMetadata',
  'getVMatrixNodeSkillMetadata',
  'getItemMetadata',
  'getItemCategory',
  'getItemExclusive',
  'getNftItemByAssetKey',
  'getLayerStaticData',
  'getRewardInformation',
  'getServerInfo'
] as const satisfies readonly MsuEndpointId[];

export const buildMsuPath = (
  pathTemplate: string,
  params: Record<string, MsuQueryPrimitive>
): string =>
  pathTemplate.replace(/\{([A-Za-z0-9_]+)\}/g, (match: string, key: string) => {
    const value = params[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing MSU path param: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
