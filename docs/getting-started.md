# Run Vitrina Local

Use Node.js 22 and pnpm 10.32.1, the package manager pinned in [package.json](../package.json).

```sh
pnpm install --frozen-lockfile
pnpm --filter @scope/vitrina-web dev
```

Open the local URL printed by Vite. Discover, recipe details and the basket use authored recipes, fictional shops and browser-local stock. Saved recipes and the basket persist on this device.

## Build

```sh
pnpm --filter @scope/vitrina-web build --base /apps/vitrina-local/
```

The build writes to `apps/vitrina/product/public/app`. Use `--base /` for a root-hosted deployment.

## Connect the original services

The [demo adapter](../apps/vitrina/product/web/src/demo.ts) implements the recipe and cart contracts used by the standalone shopper. Your connected deployment supplies recipe intake, location-based shop stock, cart and checkout services. The original clients remain in [api](../apps/vitrina/product/web/src/api), [chat](../apps/vitrina/product/web/src/chat), [cart](../apps/vitrina/product/web/src/cart) and [orders](../apps/vitrina/product/web/src/orders).

[Social Recipes](https://github.com/latintzar/social-recipes-kit) supplies video extraction and playback. [Instagram Recipe Cart](https://github.com/latintzar/instagram-recipe-cart) supplies shared-Reel intake and basket review. The [Microinvest evidence](architecture.md#inventory-connector-evidence) describes the retailer-side inventory contract and historical read-only shop prototype.

[Product tour](product-tour.md) · [Architecture](architecture.md) · [Reached stage](status.md)
