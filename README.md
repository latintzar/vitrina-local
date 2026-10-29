# Vitrina Local

Vitrina helped people discover recipes and collect ingredients from independent local shops. This repository recovers the original shopper React app: Discover, saved recipes, the recipe detail, shop-grouped ingredients and a multi-shop basket.

The standalone demonstration uses fictional recipes, shops, products and prices. Its API adapter implements a small subset of the original contract in the browser; basket and likes stay in browser storage. It does not connect to a store or take payments. Original social video support remains in the source; this demonstration uses an authored illustration and contains no third-party video files.

## Run

Requires Node.js and pnpm 9.

```sh
pnpm install
pnpm --filter @scope/vitrina-web dev
```

Open the displayed local URL. `pnpm --filter @scope/vitrina-web build` checks TypeScript and builds the app.

## Provenance and status

The shopper UI is derived from the Vitrina era-1 app in the Leo monorepo (`apps/vitrina/product/web`, paused May 2026). The browser-local demo adapter and fictional data are new. Original customer accounts, backend services, store records, deployment settings and repository history are excluded. The historical app included social recipe extraction and store matching, which require their own backend and are not represented by the local fixture.

The Microinvest WHP integration was a read-only PowerShell lab demo at one shop. The historical source tree contains a production-reader contract, not a production reader binary; it is not included here.

Social Recipes is a separate extraction and CDN project; Vitrina Local consumed recipe results as part of its shopping flow.

## License

First-party source and the authored demo illustration are available under the [MIT license](LICENSE). Dependencies retain their own licenses; they are installed separately and are not distributed in this repository. The demo includes no third-party recipe videos or bundled third-party fonts.
