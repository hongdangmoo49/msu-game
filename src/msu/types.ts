export type UnknownRecord = Record<string, unknown>;

export type MsuHttpMethod = 'GET' | 'POST';

export type MsuEndpointGroup =
  | 'accounts'
  | 'characters'
  | 'enhancement'
  | 'gamemeta'
  | 'items'
  | 'rewards'
  | 'search';

export type MsuQueryPrimitive = string | number | boolean;
export type MsuQueryValue =
  | MsuQueryPrimitive
  | readonly MsuQueryPrimitive[]
  | null
  | undefined;
export type MsuQuery = Record<string, MsuQueryValue>;

export interface MsuEndpointDefinition<TResponseType extends string = string> {
  readonly id: string;
  readonly group: MsuEndpointGroup;
  readonly method: MsuHttpMethod;
  readonly pathTemplate: string;
  readonly responseType: TResponseType;
  readonly source: string;
  readonly purpose: string;
  readonly requiresApiKey: true;
  readonly supportsMsuAuthorization?: boolean;
  readonly pathParams?: readonly string[];
  readonly queryParams?: readonly string[];
  readonly notes?: readonly string[];
}

export interface MsuTraceFields {
  readonly traceId?: string;
  readonly trace_id?: string;
}

export interface MsuSuccessEnvelope<TData> extends MsuTraceFields {
  readonly success: true;
  readonly data: TData;
}

export interface MsuFailureEnvelope extends MsuTraceFields {
  readonly success: false;
  readonly error: MsuErrorDetail;
}

export type MsuEnvelope<TData> = MsuSuccessEnvelope<TData> | MsuFailureEnvelope;

export const MSU_ERROR_CODES = {
  ERROR_CODE_UNSPECIFIED: 0,
  ERROR_CODE_INVALID_ARGUMENT: 2,
  ERROR_CODE_NOT_FOUND: 3,
  ERROR_CODE_INTERNAL_ERROR: 4,
  ERROR_CODE_PERMISSION_DENIED: 5,
  ERROR_CODE_FAILED_PRECONDITION: 6,
  ERROR_CODE_ALREADY_PROCESS: 7,
  ERROR_CODE_UNAUTHENTICATED: 8,
  ERROR_CODE_EXPECTATION_FAILED: 9,
  ERROR_CODE_TOO_MANY_REQUEST: 10,
  ERROR_CODE_CANCELED: 11,
  ERROR_CODE_NOT_APPROVE_WALLET: 1001,
  ERROR_CODE_NOT_ENOUGH_NESO: 1002,
  ERROR_CODE_NOT_FOUND_SYNERGY_APP: 2002,
  ERROR_CODE_NOT_APPROVED_SYNERGY_APP_BY_USER: 2003,
  ERROR_CODE_INVALID_AUTH_TOKEN: 3001,
  ERROR_CODE_TOKEN_EXPIRED: 4001,
  ERROR_CODE_TOKEN_EXPIRED_BY_OTHER_APP: 4002
} as const;

export type KnownMsuErrorCode = (typeof MSU_ERROR_CODES)[keyof typeof MSU_ERROR_CODES];

export interface MsuErrorDetail extends UnknownRecord {
  readonly code: KnownMsuErrorCode | (number & {});
  readonly message: string;
}

export interface CategoryTier extends UnknownRecord {
  readonly label: string;
  readonly code: string;
}

export interface Category extends UnknownRecord {
  readonly categoryNo: number;
  readonly label: string;
  readonly tier0?: CategoryTier;
  readonly tier1?: CategoryTier;
  readonly tier2?: CategoryTier;
  readonly tier3?: CategoryTier;
}

export const MSU_TOKEN_TYPES = {
  TOKEN_TYPE_UNSPECIFIED: 0,
  TOKEN_TYPE_NFT_ITEM: 1,
  TOKEN_TYPE_FT_ITEM: 2,
  TOKEN_TYPE_NFT_CHARACTER: 3,
  TOKEN_TYPE_NFT_NICKNAME: 4
} as const;

export type MsuTokenType = (typeof MSU_TOKEN_TYPES)[keyof typeof MSU_TOKEN_TYPES];

export type MsuCharacter = UnknownRecord;
export type MsuItem = UnknownRecord;
export type MsuSkill = UnknownRecord;
export type MsuQuest = UnknownRecord;
export type MsuHistoryMission = UnknownRecord;
export type MsuRewardEntry = UnknownRecord;

export interface CursorPageData extends UnknownRecord {
  readonly nextCursor?: string;
  readonly hasMore?: boolean;
}

export interface PagePaginationResult extends UnknownRecord {
  readonly totalCount?: number;
  readonly currPageNo?: number;
  readonly pageSize?: number;
  readonly isLastPage?: boolean;
}

export interface PagePaginatedData extends UnknownRecord {
  readonly paginationResult?: PagePaginationResult;
}

export interface ListCharactersResponse extends CursorPageData {
  readonly characters: MsuCharacter[];
}

export interface ListWalletItemsResponse extends CursorPageData {
  readonly elements: MsuItem[];
}

export interface GetCharacterResponse extends UnknownRecord {
  readonly character: MsuCharacter;
}

export interface GetCharacterVMatrixResponse extends UnknownRecord {
  readonly matrixPoint?: number;
  readonly vCoreShardCount?: number;
  readonly vMatrixSlots?: UnknownRecord[];
  readonly vMatrixNodes?: UnknownRecord[];
}

export interface ListCharacterSkillsResponse extends UnknownRecord {
  readonly skills: MsuSkill[];
}

export interface ListCharacterHoldingItemsResponse extends CursorPageData {
  readonly elements: MsuItem[];
}

export interface ListCharacterQuestsResponse extends UnknownRecord {
  readonly quests: MsuQuest[];
}

export interface ListCharacterHistoryMissionsResponse extends CursorPageData {
  readonly historyMissions: MsuHistoryMission[];
}

export interface GetSkillMetadataResponse extends UnknownRecord {
  readonly skillMetadata: UnknownRecord;
}

export interface GetVMatrixNodeSkillResponse extends UnknownRecord {
  readonly nodeId?: number;
  readonly nodeName?: string;
  readonly nodeDesc?: string;
  readonly nodeLevel?: number;
  readonly nodeImageUrl?: string;
  readonly skills: MsuSkill[];
}

export interface GetItemMetadataResponse extends UnknownRecord {
  readonly item: MsuItem;
}

export interface GetItemCategoryResponse extends UnknownRecord {
  readonly category: Category;
}

export interface GetItemSetResponse extends UnknownRecord {
  readonly itemSet: UnknownRecord;
}

export interface GetItemExclusiveResponse extends UnknownRecord {
  readonly items: MsuItem[];
}

export interface GetQuestMetadataResponse extends UnknownRecord {
  readonly questMetadata: UnknownRecord;
}

export interface GetCurrentPriceResponse extends UnknownRecord {
  readonly currentPrices: {
    readonly starforce?: UnknownRecord;
    readonly potential?: UnknownRecord;
  } & UnknownRecord;
}

export interface GetNftItemResponse extends UnknownRecord {
  readonly item: MsuItem;
}

export interface ListNftItemHistoryMissionsResponse extends CursorPageData {
  readonly historyMissions: MsuHistoryMission[];
}

export interface ExploreCharactersResponse extends PagePaginatedData {
  readonly characters: MsuCharacter[];
}

export interface ExploreItemsResponse extends PagePaginatedData {
  readonly items: MsuItem[];
}

export interface CharacterRaffleHistoryResponse extends UnknownRecord {
  readonly walletAddress: string;
  readonly characterAssetKey: string;
  readonly histories: MsuRewardEntry[];
  readonly updatedAt: string;
}

export interface CharacterRaffleInformationResponse extends UnknownRecord {
  readonly walletAddress: string;
  readonly characterAssetKey: string;
  readonly informations: MsuRewardEntry[];
  readonly updatedAt: string;
}

export interface LayerStaticDataResponse extends UnknownRecord {
  readonly staticDatas: UnknownRecord[];
  readonly expiredAt: string;
}

export interface RewardHistoryResponse extends UnknownRecord {
  readonly worldId: number | null;
  readonly rewardHistories: UnknownRecord;
  readonly updatedAt: string;
}

export interface RewardInformationResponse extends UnknownRecord {
  readonly worldId: number | null;
  readonly rewardInformations: UnknownRecord;
  readonly updatedAt: string;
}

export interface ServerInfoResponse extends UnknownRecord {
  readonly informations: UnknownRecord[];
}

export interface CharacterListQuery extends MsuQuery {
  readonly isTradable?: boolean;
  readonly name?: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface WalletItemsQuery extends MsuQuery {
  readonly categoryNo?: number;
  readonly isOnSale?: boolean;
  readonly tokenName?: string;
  readonly cursor?: string;
  readonly size?: number;
  readonly tokenId?: string;
}

export interface CursorQuery extends MsuQuery {
  readonly cursor?: string;
}

export interface CharacterItemsQuery extends CursorQuery {
  readonly categoryNo?: number;
}

export interface SkillMetadataQuery extends MsuQuery {
  readonly level?: number;
}

export interface VMatrixNodeSkillQuery extends MsuQuery {
  readonly level?: number;
  readonly skillIdList?: readonly number[];
}

export interface SearchPaginationQuery extends MsuQuery {
  readonly 'paginationParam.pageNo'?: number;
  readonly 'paginationParam.pageSize'?: number;
}

export interface ExploreCharactersQuery extends SearchPaginationQuery {
  readonly 'filter.name'?: string;
  readonly 'filter.class'?: string;
  readonly 'filter.job'?: string;
  readonly 'filter.attackPower'?: string;
  readonly 'filter.price.min'?: number;
  readonly 'filter.price.max'?: number;
  readonly 'filter.level.min'?: number;
  readonly 'filter.level.max'?: number;
  readonly sorting?:
    | 'HIGHEST_PRICE'
    | 'LOWEST_PRICE'
    | 'ENDING_SOON'
    | 'RECENTLY_LISTED'
    | 'HIGHEST_ATTACK_POWER';
  readonly walletAddr?: string;
}

export interface ExploreItemsQuery extends SearchPaginationQuery {
  readonly 'filter.name'?: string;
  readonly 'filter.mintingNo'?: number;
  readonly 'filter.categoryNo'?: number;
  readonly 'filter.itemId'?: number;
  readonly 'filter.classes'?: readonly string[];
  readonly 'filter.achievedCharName'?: string;
  readonly 'filter.color'?: readonly string[];
  readonly 'filter.PetSkills'?: readonly string[];
  readonly 'filter.price.min'?: number;
  readonly 'filter.price.max'?: number;
  readonly 'filter.level.min'?: number;
  readonly 'filter.level.max'?: number;
  readonly 'filter.starforce.min'?: number;
  readonly 'filter.starforce.max'?: number;
  readonly 'filter.potential.min'?: number;
  readonly 'filter.potential.max'?: number;
  readonly 'filter.bonusPotential.min'?: number;
  readonly 'filter.bonusPotential.max'?: number;
  readonly sorting?: 'HIGHEST_PRICE' | 'LOWEST_PRICE' | 'ENDING_SOON' | 'RECENTLY_LISTED';
  readonly walletAddr?: string;
}

export interface CharacterRaffleHistoryQuery extends MsuQuery {
  readonly walletAddress: string;
  readonly raffledAt?: string;
}

export interface CharacterRaffleInformationQuery extends MsuQuery {
  readonly walletAddress: string;
}
