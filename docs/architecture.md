# Architecture

The original Vitrina shopper app combined Discover, a video recipe viewer, shop-grouped stock matches and a multi-shop basket. Its React modules are retained in `apps/vitrina/product/web/src`: `discover/` owns the feed, likes and recipe viewer; `cart/` and `shops/` own the basket and shop presentation; `api/` and `chat/` describe the original commerce and agent clients.

The standalone `src/demo.ts` adapter supplies authored recipe, shop and product fixtures through a subset of the original `/recipe-videos` and `/carts` response shapes. Cart contents and saved likes stay in browser storage. The adapter does not implement the production commerce API or the recipe extraction service. The live integrations need a separately commissioned backend, shop data and payment provider.

Original social-video embedding remains in `discover/RecipeEmbed.tsx`. Social Recipes is the separate extraction and video project; [Instagram Recipe Cart](https://github.com/latintzar/instagram-recipe-cart) is a companion integration for shared-Reel intake and basket review.

## Inventory connector evidence

The historical Leo tree records a Microinvest WHP customer-side reader contract under `apps/vitrina/product/integrations/microinvest-pos/README.md`. Its companion lab notes document a working read-only PowerShell polling prototype at one shop in April 2026. The production reader binary and source were not in that integration folder; the original notes describe a future signed production reader. The lab data and merchant credentials are outside this release.
