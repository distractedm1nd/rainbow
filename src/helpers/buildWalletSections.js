import lang from 'i18n-js';
import {
  compact,
  find,
  flattenDeep,
  get,
  groupBy,
  map,
  property,
} from 'lodash';
import React from 'react';
import { LayoutAnimation } from 'react-native';
import { createSelector } from 'reselect';
import { assets } from '../../react-native.config';
import { AssetListItemSkeleton } from '../components/asset-list';
import { BalanceCoinRow } from '../components/coin-row';
import { UniswapInvestmentRow } from '../components/investment-cards';
import { CollectibleTokenFamily } from '../components/token-family';
import { withNavigation } from '../navigation/Navigation';
import { compose, withHandlers } from '../utils/recompactAdapters';
import {
  buildBriefCoinsList, buildBriefUniqueTokenList,
  buildCoinsList,
  buildUniqueTokenList,
} from './assets';
import networkTypes from './networkTypes';
import { add, convertAmountToNativeDisplay, multiply } from './utilities';
import { ImgixImage } from '@rainbow-me/images';
import { setIsCoinListEdited } from '@rainbow-me/redux/editOptions';
import { setOpenSmallBalances } from '@rainbow-me/redux/openStateSettings';
import store from '@rainbow-me/redux/store';
import Routes from '@rainbow-me/routes';

const allAssetsSelector = state => state.allAssets;
const allAssetsCountSelector = state => state.allAssetsCount;
const assetsTotalSelector = state => state.assetsTotal;
const currentActionSelector = state => state.currentAction;
const hiddenCoinsSelector = state => state.hiddenCoins;
const isBalancesSectionEmptySelector = state => state.isBalancesSectionEmpty;
const isCoinListEditedSelector = state => state.isCoinListEdited;
const isLoadingAssetsSelector = state => state.isLoadingAssets;
const languageSelector = state => state.language;
const networkSelector = state => state.network;
const nativeCurrencySelector = state => state.nativeCurrency;
const pinnedCoinsSelector = state => state.pinnedCoins;
const savingsSelector = state => state.savings;
const showcaseTokensSelector = state => state.showcaseTokens;
const uniqueTokensSelector = state => state.uniqueTokens;
const uniswapSelector = state => state.uniswap;
const uniswapTotalSelector = state => state.uniswapTotal;

const enhanceRenderItem = compose(
  withNavigation,
  withHandlers({
    onPress: ({ assetType, navigation }) => (item, params) => {
      navigation.navigate(Routes.EXPANDED_ASSET_SHEET, {
        asset: item,
        type: assetType,
        ...params,
      });
    },
  })
);

const TokenItem = enhanceRenderItem(BalanceCoinRow);

const balancesSkeletonRenderItem = item => (
  <AssetListItemSkeleton animated descendingOpacity={false} {...item} />
);

const balancesRenderItem = item => <TokenItem {...item} assetType="token" />;

export const tokenFamilyItem = item => (
  <CollectibleTokenFamily {...item} uniqueId={item.uniqueId} />
);
const uniswapRenderItem = item => (
  <UniswapInvestmentRow {...item} assetType="uniswap" isCollapsible />
);

const filterWalletSections = sections =>
  sections.filter(({ data, header }) =>
    data ? get(header, 'totalItems') : true
  );

const buildWalletSections = (
  balanceSection,
  uniqueTokenFamiliesSection,
  uniswapSection
) => {
  const sections = [balanceSection, uniswapSection, uniqueTokenFamiliesSection];

  const filteredSections = filterWalletSections(sections);
  const isEmpty = !filteredSections.length;

  return {
    isEmpty,
    sections: filteredSections,
  };
};

const buildBriefWalletSections = (
  balanceSection,
  savings,
  uniqueTokenFamiliesSection,
  uniswapSection
) => {
  const sections = [
    balanceSection,
    savings,
    uniswapSection,
    uniqueTokenFamiliesSection,
  ];

  const filteredSections = sections
    .filter(section => section.length !== 0)
    .flat(1);
  return filteredSections;
};

const withUniswapSection = (
  language,
  nativeCurrency,
  uniswap,
  uniswapTotal
) => {
  return {
    data: uniswap,
    header: {
      title: 'Pools',
      totalItems: uniswap.length,
      totalValue: convertAmountToNativeDisplay(uniswapTotal, nativeCurrency),
    },
    name: 'pools',
    pools: true,
    renderItem: uniswapRenderItem,
  };
};

const withBriefUniswapSection = (uniswap, uniswapTotal, nativeCurrency) => {
  const pools = uniswap.map(pool => ({
    address: pool.address,
    type: 'UNISWAP_POOL',
    uid: 'pool-' + pool.address
  }));

  if (pools.length > 0) {
    return [{ type: 'POOLS_HEADER', value:convertAmountToNativeDisplay(uniswapTotal, nativeCurrency), uid: 'pools-header' }, ...pools];
  }
  return [];
};

const withBalanceSavingsSection = savings => {
  let totalUnderlyingNativeValue = '0';
  const savingsAssets = map(savings, asset => {
    const {
      lifetimeSupplyInterestAccrued,
      underlyingBalanceNativeValue,
      underlyingPrice,
    } = asset;
    totalUnderlyingNativeValue = add(
      totalUnderlyingNativeValue,
      underlyingBalanceNativeValue || 0
    );
    const lifetimeSupplyInterestAccruedNative = lifetimeSupplyInterestAccrued
      ? multiply(lifetimeSupplyInterestAccrued, underlyingPrice)
      : 0;

    return {
      ...asset,
      lifetimeSupplyInterestAccruedNative,
      underlyingBalanceNativeValue,
    };
  });

  const savingsSection = {
    assets: savingsAssets,
    savingsContainer: true,
    totalValue: totalUnderlyingNativeValue,
  };
  return savingsSection;
};

const withBriefBalanceSavingsSection = savings => {
  let totalUnderlyingNativeValue = '0';
  for (let saving of savings) {
    const {
      underlyingBalanceNativeValue,
    } = saving;
    totalUnderlyingNativeValue = add(
      totalUnderlyingNativeValue,
      underlyingBalanceNativeValue || 0
    );
  }
  const addresses = savings?.map(asset => asset.cToken.address);
  return [
    { type: 'SAVINGS_HEADER', uid: 'savings-header', value: totalUnderlyingNativeValue },
    ...addresses.map(address => ({ address, type: 'SAVINGS', uid: 'savings-' + address })),
  ];
};

const coinEditContextMenu = (
  allAssets,
  balanceSectionData,
  isCoinListEdited,
  currentAction,
  isLoadingAssets,
  allAssetsCount,
  totalValue,
  addedEth
) => {
  const noSmallBalances = !find(balanceSectionData, 'smallBalancesContainer');

  return {
    contextMenuOptions:
      allAssets.length > 0 && noSmallBalances
        ? {
            cancelButtonIndex: 0,
            dynamicOptions: () => {
              return ['Cancel', 'Edit'];
            },
            onPressActionSheet: async index => {
              if (index === 1) {
                store.dispatch(setIsCoinListEdited(!isCoinListEdited));
                store.dispatch(setOpenSmallBalances(true));
                LayoutAnimation.configureNext(
                  LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')
                );
              }
            },
          }
        : undefined,
    title: null,
    totalItems: isLoadingAssets ? 1 : (addedEth ? 1 : 0) + allAssetsCount,
    totalValue: totalValue,
  };
};

const withBalanceSection = (
  allAssets,
  allAssetsCount,
  assetsTotal,
  savingsSection,
  isBalancesSectionEmpty,
  isLoadingAssets,
  language,
  nativeCurrency,
  network,
  isCoinListEdited,
  pinnedCoins,
  hiddenCoins,
  currentAction,
  uniswapTotal,
  collectibles
) => {
  const { addedEth, assets, totalBalancesValue } = buildCoinsList(
    allAssets,
    nativeCurrency,
    isCoinListEdited,
    pinnedCoins,
    hiddenCoins,
    true,
    !collectibles.length
  );

  const briefAssets = buildBriefCoinsList(
    allAssets,
    nativeCurrency,
    isCoinListEdited,
    pinnedCoins,
    hiddenCoins,
    true,
    !collectibles.length
  );
  let balanceSectionData = [...assets];

  const totalBalanceWithSavingsValue = add(
    totalBalancesValue,
    get(savingsSection, 'totalValue', 0)
  );
  const totalBalanceWithAllSectionValues = add(
    totalBalanceWithSavingsValue,
    uniswapTotal
  );

  const totalValue = convertAmountToNativeDisplay(
    totalBalanceWithAllSectionValues,
    nativeCurrency
  );

  if (networkTypes.mainnet === network) {
    balanceSectionData.push(savingsSection);
  }

  if (isLoadingAssets) {
    balanceSectionData = [{ item: { uniqueId: 'skeleton0' } }];
  }

  return {
    balances: true,
    data: balanceSectionData,
    header: coinEditContextMenu(
      allAssets,
      balanceSectionData,
      isCoinListEdited,
      currentAction,
      isLoadingAssets,
      allAssetsCount,
      totalValue,
      addedEth
    ),
    name: 'balances',
    renderItem: isLoadingAssets
      ? balancesSkeletonRenderItem
      : balancesRenderItem,
  };
};

const withBriefBalanceSection = (
  allAssets,
  isLoadingAssets,
  nativeCurrency,
  isCoinListEdited,
  pinnedCoins,
  hiddenCoins,
  collectibles,
  savingsSection,
  uniswapTotal
) => {

  const {briefAssets, totalBalancesValue} = buildBriefCoinsList(
    allAssets,
    nativeCurrency,
    isCoinListEdited,
    pinnedCoins,
    hiddenCoins,
    true,
    !collectibles.length
  );


  console.log(savingsSection, uniswapTotal)
  const totalBalanceWithSavingsValue = add(
    totalBalancesValue,
    get(savingsSection, 'totalValue', 0)
  );
  const totalBalanceWithAllSectionValues = add(
    totalBalanceWithSavingsValue,
    uniswapTotal
  );

  const totalValue = convertAmountToNativeDisplay(
    totalBalanceWithAllSectionValues,
    nativeCurrency
  );

  const headerItem = { type: 'ASSETS_HEADER', value: totalValue };

  return [
    headerItem,
    ...(isLoadingAssets ? [{ type: 'LOADING_ASSETS', uid: 'loadings-asset' }] : briefAssets),
  ];
};

const withSmallBalancelValue = (
  allAssets,
  isLoadingAssets,
  nativeCurrency,
  isCoinListEdited,
  pinnedCoins,
  hiddenCoins,
  collectibles
) => {
  const { smallBalancesValue } = buildCoinsList(
    allAssets,
    nativeCurrency,
    isCoinListEdited,
    pinnedCoins,
    hiddenCoins,
    true,
    !collectibles.length
  );

  return smallBalancesValue;
};

let isPreloadComplete = false;
const largeFamilyThreshold = 4;
const jumboFamilyThreshold = largeFamilyThreshold * 2;
const minTopFoldThreshold = 10;

const buildImagesToPreloadArray = (family, index, families) => {
  const isLargeFamily = family.tokens.length > largeFamilyThreshold;
  const isJumboFamily = family.tokens.length >= jumboFamilyThreshold;
  const isTopFold = index < Math.max(families.length / 2, minTopFoldThreshold);

  return family.tokens.map((token, rowIndex) => {
    let priority = ImgixImage.priority[isTopFold ? 'high' : 'normal'];

    if (isTopFold && isLargeFamily) {
      if (rowIndex <= largeFamilyThreshold) {
        priority = ImgixImage.priority.high;
      } else if (isJumboFamily) {
        const isMedium =
          rowIndex > largeFamilyThreshold && rowIndex <= jumboFamilyThreshold;
        priority = ImgixImage.priority[isMedium ? 'normal' : 'low'];
      } else {
        priority = ImgixImage.priority.normal;
      }
    }

    const images = token.map(({ image_preview_url, uniqueId }) => {
      if (!image_preview_url) return null;
      return {
        id: uniqueId,
        priority,
        uri: image_preview_url,
      };
    });

    return images.length ? images : null;
  });
};

const sortImagesToPreload = images => {
  const filtered = compact(flattenDeep(images));
  const grouped = groupBy(filtered, property('priority'));
  return [
    ...get(grouped, 'high', []),
    ...get(grouped, 'normal', []),
    ...get(grouped, 'low', []),
  ];
};

const withUniqueTokenFamiliesSection = (uniqueTokens, data) => {
  // TODO preload elsewhere?
  if (!isPreloadComplete) {
    const imagesToPreload = sortImagesToPreload(
      data.map(buildImagesToPreloadArray)
    );
    isPreloadComplete = !!imagesToPreload.length;
    ImgixImage.preload(imagesToPreload, 200);
  }

  return {
    collectibles: true,
    data,
    header: {
      title: lang.t('account.tab_collectibles'),
      totalItems: uniqueTokens.length,
      totalValue: '',
    },
    name: 'collectibles',
    renderItem: tokenFamilyItem,
    type: 'big',
  };
};

const withBriefUniqueTokenFamiliesSection = (uniqueTokens, data) => {
  // TODO preload elsewhere?
  if (!isPreloadComplete) {
    const imagesToPreload = sortImagesToPreload(
      data.map(buildImagesToPreloadArray)
    );
    isPreloadComplete = !!imagesToPreload.length;
    ImgixImage.preload(imagesToPreload, 200);
  }

  const result = [{ type: 'NFTS_HEADER', uid: 'nfts-header' }];
  for (let family of data) {
    result.push({
      id: family.familyId,
      name: family.familyName,
      uid: 'nfts-header-' + family.familyId,
      type: 'FAMILY_HEADER',
      amount: family.tokens,
      image: family.familyImage
    });
    for (let tokens of family.tokens) {
      result.push({
        uid: 'nft-' + tokens[0].uniqueId,
        nfts: tokens.map(token => token.uniqueId),
        type: 'NFTS_ROW',
      });
    }
  }

  return result;
};

const uniqueTokenDataSelector = createSelector(
  [uniqueTokensSelector, showcaseTokensSelector],
  buildUniqueTokenList
);

const briefUniqueTokenDataSelector = createSelector(
  [uniqueTokensSelector, showcaseTokensSelector],
  buildBriefUniqueTokenList
);

const balanceSavingsSectionSelector = createSelector(
  [savingsSelector],
  withBalanceSavingsSection
);


const briefBalanceSavingsSectionSelector = createSelector(
  [savingsSelector],
  withBriefBalanceSavingsSection
);


const uniswapSectionSelector = createSelector(
  [
    languageSelector,
    nativeCurrencySelector,
    uniswapSelector,
    uniswapTotalSelector,
  ],
  withUniswapSection
);

const briefUniswapSectionSelector = createSelector(
  [uniswapSelector, uniswapTotalSelector, nativeCurrencySelector],
  withBriefUniswapSection
);

const balanceSectionSelector = createSelector(
  [
    allAssetsSelector,
    allAssetsCountSelector,
    assetsTotalSelector,
    balanceSavingsSectionSelector,
    isBalancesSectionEmptySelector,
    isLoadingAssetsSelector,
    languageSelector,
    nativeCurrencySelector,
    networkSelector,
    isCoinListEditedSelector,
    pinnedCoinsSelector,
    hiddenCoinsSelector,
    currentActionSelector,
    uniswapTotalSelector,
    uniqueTokensSelector,
  ],
  withBalanceSection
);

const briefBalanceSectionSelector = createSelector(
  [
    allAssetsSelector,
    isLoadingAssetsSelector,
    nativeCurrencySelector,
    isCoinListEditedSelector,
    pinnedCoinsSelector,
    hiddenCoinsSelector,
    uniqueTokensSelector,
    balanceSavingsSectionSelector,
    uniswapTotalSelector,
  ],
  withBriefBalanceSection
);


export const briefSmallBalanceValueSelector = createSelector(
  [
    allAssetsSelector,
    isLoadingAssetsSelector,
    nativeCurrencySelector,
    isCoinListEditedSelector,
    pinnedCoinsSelector,
    hiddenCoinsSelector,
    uniqueTokensSelector,
    balanceSavingsSectionSelector,
    uniswapTotalSelector,
  ],
  withSmallBalancelValue
);

const uniqueTokenFamiliesSelector = createSelector(
  [uniqueTokensSelector, uniqueTokenDataSelector],
  withUniqueTokenFamiliesSection
);

const briefUniqueTokenFamiliesSelector = createSelector(
  [uniqueTokensSelector, uniqueTokenDataSelector],
  withBriefUniqueTokenFamiliesSection
);

export const buildWalletSectionsSelector = createSelector(
  [balanceSectionSelector, uniqueTokenFamiliesSelector, uniswapSectionSelector],
  buildWalletSections
);

export const buildBriefWalletSectionsSelector = createSelector(
  [
    briefBalanceSectionSelector,
    briefBalanceSavingsSectionSelector,
    briefUniqueTokenDataSelector,
    briefUniswapSectionSelector,
  ],
  buildBriefWalletSections
);
