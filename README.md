# Vitrina Local

Turn recipe Reels & TikToks into shopping baskets from local grocers

Vitrina Local is an agentic commerce app that turns recipe Reels and TikToks into shopping baskets from local grocers. Its shopping agent matches ingredients to nearby stock and returns a basket link in Instagram chat. The original app also includes recipe discovery, saved recipes and video-guided cooking.

The original Discover, recipe and basket app and the Instagram-to-cart service are preserved. The hosted app uses authored recipes and shop stock. The animated checkout study illustrates Stripe payment and delivery confirmation; a live Stripe and retailer fulfilment connection is a continuation of the project.

![Vitrina Local](https://atelierneyra.com/assets/product-motion-v4/vitrina.jpg)

Vitrina Local is a recipe and shopping app for independent neighbourhood shops. People discover or save recipes, follow their videos and build baskets from ingredients available nearby. Shops make their stock visible to people planning a meal.

The recovered shopper interface brings together recipe discovery, saved recipes, video and ingredients, local stock grouped by shop, and a multi-shop basket. The companion Instagram integration turns shared Reels into recipes and basket-review links. Social Recipes is the separate extraction and video work that Vitrina Local builds on.

The standalone preview runs the original Discover, recipe and basket interface using authored recipes, fictional shops and browser-local stock. Checkout is a provider integration for a connected deployment. The [architecture](docs/architecture.md) and [status](docs/status.md) describe the recovered scope.

## Run

Requires Node.js and pnpm 9.

```sh
pnpm install
pnpm --filter @scope/vitrina-web dev
```

Open the displayed local URL. Build for a public path with:

```sh
pnpm --filter @scope/vitrina-web build --base /apps/vitrina-local/
```

The build writes to `apps/vitrina/product/public/app`. Set the base to `/` for a root-hosted deployment. The demo stores the basket and saved recipes in the visitor's browser.

## Companion projects

- [Social Recipes Kit](https://github.com/latintzar/social-recipes-kit) — reusable extraction and video modules.
- [Instagram Recipe Cart](https://github.com/latintzar/instagram-recipe-cart) — shared-Reel intake and basket review integration.

## License

First-party source, original Vitrina doodles and the authored demo illustration are available under the [MIT license](LICENSE). Dependencies retain their own licenses and are installed separately. The preview contains no bundled third-party recipe videos or fonts.

The hosted build includes the shared Atelier navigation in `public/native-nav/`. It links directly to the other published projects and the Vitrina Local overview; the shopper interface runs in the same document.
