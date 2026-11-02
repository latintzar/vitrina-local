# Vitrina Local product tour

Vitrina Local turns recipe Reels and TikToks into shopping baskets from local grocers. It connects online meal discovery to the inventory of independent physical shops.

[Open demo](https://preview.atelierneyra.com/apps/vitrina-local/) · [Run locally](getting-started.md)

## Discover to basket

1. Open **Discover** and select **Tomato pasta**. The recipe viewer opens over the feed.
2. Review **Ingredients**. The authored example matches tomatoes and herbs at Garden Market and pasta at Corner Pantry, with the shop names and walking information beside them.
3. Choose **Add to Basket**. The products enter the basket grouped by shop; the add animation links the recipe card to that result.
4. Open **Your basket**. Inspect the recipe grouping, adjust a quantity or remove a line. Close the sheet and reopen it to continue.
5. Reload the app. Browser storage preserves this device’s saved recipes and basket.

At the original example quantities, the two shop subtotals are €3.90 and €2.20. The useful result is a local-shop basket for a meal, with ingredient and shop context retained. These recipes, products, prices and shop identities are authored demonstration data.

## Product areas and source

| Area | Action and result | Module |
| --- | --- | --- |
| Discover | Open a recipe or save it for later | [DiscoverPage.tsx](../apps/vitrina/product/web/src/discover/DiscoverPage.tsx), [recipeLikes.ts](../apps/vitrina/product/web/src/discover/recipeLikes.ts) |
| Recipe viewer | Inspect the recipe and stock groups; add matched items | [RecipeModal.tsx](../apps/vitrina/product/web/src/discover/RecipeModal.tsx) |
| Video | Keep a recipe’s source clip with its ingredients | [RecipeEmbed.tsx](../apps/vitrina/product/web/src/discover/RecipeEmbed.tsx) |
| Basket | Review, change and remove products by shop | [BasketSheet.tsx](../apps/vitrina/product/web/src/cart/BasketSheet.tsx), [useCart.ts](../apps/vitrina/product/web/src/cart/useCart.ts) |
| Local demo | Supply recipe/cart responses and persist this device’s cart | [demo.ts](../apps/vitrina/product/web/src/demo.ts) |
| Connected commerce | Supply agent chat, shop inventory, payment and orders | [chat](../apps/vitrina/product/web/src/chat), [api](../apps/vitrina/product/web/src/api), [orders](../apps/vitrina/product/web/src/orders) |

## Instagram to checkout

The broader product starts when someone sends a cooking Reel to an Instagram account. [Social Recipes](https://github.com/latintzar/social-recipes-kit) resolves the video and extracts the recipe. The [Instagram Recipe Cart companion](https://github.com/latintzar/instagram-recipe-cart) matches it to shop stock and returns a basket-review link. The shopper reviews the basket before the connected checkout and collection flow.

The website’s Instagram → recipe → Stripe-style payment → confirmation sequence is an illustrated checkout study. The standalone app supplies the concrete Discover-to-basket path above. Its fixtures use authored recipe illustrations; the source video player and connected commerce screens are retained for a configured deployment. [Status](status.md) records that boundary.

## Product and UX decisions

The recipe is the shopper’s starting point; physical stock is the shop’s contribution. Recipe details lead with matched ingredients, while the basket groups purchases by supplier. Discover stays mounted while another surface opens, preserving its scroll position. The basket keeps its own back stack: back returns from checkout to cart, and close dismisses the entire sheet.

These decisions are visible in [App.tsx](../apps/vitrina/product/web/src/App.tsx), [RecipeModal.tsx](../apps/vitrina/product/web/src/discover/RecipeModal.tsx) and [BasketSheet.tsx](../apps/vitrina/product/web/src/cart/BasketSheet.tsx).

## Shop inventory and continuation

The [inventory connector evidence](architecture.md#inventory-connector-evidence) records the historical Microinvest WHP reader contract and documented April 2026 read-only shop lab. The original contract and lab remain in the retained Leo work; this public package carries their provenance and scope. A production retailer reader is continuation work.

Your connected deployment supplies current retailer stock, recipe intake, cart/checkout services and participating shops. Start with [local setup](getting-started.md), then replace the demo adapter with the services needed for your workflow.
