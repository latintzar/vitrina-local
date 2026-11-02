# Vitrina Local

Turn recipe Reels & TikToks into shopping baskets from local grocers

Vitrina Local is an agentic commerce app that connects a recipe someone wants to cook with stock at nearby independent shops. The original app combines recipe discovery, saved recipes, video-guided cooking and shop-grouped baskets. Its companion Instagram integration turns a shared Reel into a basket-review link in chat.

[Open demo](https://preview.atelierneyra.com/apps/vitrina-local/) · [Website](https://atelierneyra.com/vitrina) · [Product tour](docs/product-tour.md) · [Documentation](https://docs.atelierneyra.com/vitrina/overview/)

![Vitrina Local](https://atelierneyra.com/assets/product-motion-v4/vitrina.jpg)

## Try a recipe basket

Open **Discover**, choose **Tomato pasta**, and review its matched ingredients. **Add to Basket** groups the products into Garden Market and Corner Pantry. Open the basket to change quantities or remove an item; it stays on your device when you return.

That complete demonstration uses authored recipes, fictional shops and browser-local stock. It lets you explore the original shopper interface immediately. The [product tour](docs/product-tour.md) separates that working path from the connected Instagram, inventory and payment services.

## Product areas

| Area | What it does |
| --- | --- |
| Discover and saved recipes | Find a meal and keep recipes together |
| Recipe viewer | Keep the source video, ingredients and matched shop products in one place |
| Local stock | Show the shops supplying each ingredient, pack quantities and walking information |
| Multi-shop basket | Review products by shop and update quantities |
| Instagram intake | Resolve a shared Reel and return a basket-review link through the companion integration |
| Inventory and checkout | Connect retailer stock, basket review and the payment/collection workflow |

The source preserves the original consumer UI and commerce clients. The hosted release exercises Discover, recipe details and baskets with demo data. The checkout study on the project website illustrates Stripe payment and confirmation; connected retailer inventory, payment and fulfilment remain continuation work. [Reached stage](docs/status.md).

## Build on it

[Run locally](docs/getting-started.md) with Node.js 22 and the repository’s pinned pnpm 10.32.1. The [architecture guide](docs/architecture.md) maps the original app and its standalone adapter.

| Module | Source |
| --- | --- |
| Discovery and recipe viewer | [discover](apps/vitrina/product/web/src/discover) |
| Cart, quantities and basket sheet | [cart](apps/vitrina/product/web/src/cart), [shops](apps/vitrina/product/web/src/shops) |
| Browser-local demo contracts | [demo.ts](apps/vitrina/product/web/src/demo.ts) |
| Original agent and commerce clients | [chat](apps/vitrina/product/web/src/chat), [api](apps/vitrina/product/web/src/api), [orders](apps/vitrina/product/web/src/orders) |
| Historical shop connector | [Microinvest evidence](docs/architecture.md#inventory-connector-evidence) |

[Social Recipes](https://github.com/latintzar/social-recipes-kit) supplies the separate video-to-recipe layer. [Instagram Recipe Cart](https://github.com/latintzar/instagram-recipe-cart) supplies shared-Reel intake and basket-review integration.

First-party source, original Vitrina doodles and the authored demo illustration use the [MIT licence](LICENSE). Dependencies and source media retain their own terms.

[made by atelier neyra](https://atelierneyra.com)
