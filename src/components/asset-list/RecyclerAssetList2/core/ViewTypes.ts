import { RecyclerListView, RecyclerListViewProps } from 'recyclerlistview';
import { RecyclerListViewState } from 'recyclerlistview/dist/reactnative/core/RecyclerListView';

export enum CellType {
  ASSETS_HEADER = 'ASSETS_HEADER',
  COIN = 'COIN',
  COIN_DIVIDER = 'COIN_DIVIDER',
  SAVINGS_HEADER = 'SAVINGS_HEADER',
  SAVINGS = 'SAVINGS',
  POOLS_HEADER = 'POOLS_HEADER',
  UNISWAP_POOL = 'UNISWAP_POOL',
  NFTS_HEADER = 'NFTS_HEADER',
  FAMILY_HEADER = 'FAMILY_HEADER',
  NFT = 'NFT',
  LOADING_ASSETS = 'LOADING_ASSETS',
}
export type RecyclerListViewRef = RecyclerListView<
  RecyclerListViewProps,
  RecyclerListViewState
>;

export type BaseCellType = { type: CellType; uid: string; hidden?: boolean };

export type SavingsHeaderExtraData = {
  type: CellType.SAVINGS_HEADER;
  value: string;
};
export type SavingExtraData = { type: CellType.SAVINGS; address: string };
export type UniswapPoolExtraData = {
  type: CellType.UNISWAP_POOL;
  address: string;
};
export type CoinDividerExtraData = {
  type: CellType.COIN_DIVIDER;
  value: number;
};
export type AssetsHeaderExtraData = {
  type: CellType.ASSETS_HEADER;
  value: number;
};
export type PoolsHeaderExtraData = {
  type: CellType.POOLS_HEADER;
  value: number;
};
export type CoinExtraData = { type: CellType.COIN; uniqueId: string };
export type NFTExtraData = { type: CellType.NFT; uniqueId: string };
export type NFTFamilyExtraData = {
  type: CellType.FAMILY_HEADER;
  name: string;
  total?: number;
  image?: string;
};

export type CellExtraData =
  | { type: CellType.NFTS_HEADER }
  | { type: CellType.LOADING_ASSETS }
  | NFTFamilyExtraData
  | SavingExtraData
  | SavingsHeaderExtraData
  | UniswapPoolExtraData
  | CoinDividerExtraData
  | CoinExtraData
  | NFTExtraData
  | AssetsHeaderExtraData
  | PoolsHeaderExtraData;

export type CellTypes = BaseCellType & CellExtraData;
