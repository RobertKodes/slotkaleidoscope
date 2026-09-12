# slotkaleidoscope

The parlor is coal-dark; the only heat is a coal-oil lamp on burgundy felt.
You look into a brass tube — smoked glass, triangular mirrors, a Victorian toy.
Shards of colored glass are recent transactions; they tumble into a new geometry on each slot.
Fee pressure fogs the lamp and thickens the spin blur; failed txs leave soot cracks that linger.
Cap the eyepiece and the sample holds. This is an instrument, not a product.

Live Solana **mainnet** as a parlor kaleidoscope. Not an explorer. Not a dashboard. Not a newspaper.
Distinct from slotzoetrope (spinning drum), slotneon (shop tubes), sandslot (hourglass), and slotorrery (brass planets).

Live: https://robertkodes.github.io/slotkaleidoscope/

## How to read the tube

| Eyepiece | Chain |
| --- | --- |
| Facet tumble / rotation | Confirmed slot clock |
| Colored glass shard | A recent transaction |
| Shard hue | Program family: system, JUP, RAY, token, stake, unknown |
| Spin blur / lamp glare / shard density | `getRecentPrioritizationFees` pressure, log-scaled |
| Cracked, soot-black, or missing shard | Sampled signature with `err` — lingers a beat longer |
| **CAP EYE** / Space | Freeze the current sample |
| UNCAP / Space again | Resume the live feed |

No wallet. No keys. Browser talks JSON-RPC.

## Palette

Named hex, parlor brass and felt, six dyes:

| Token | Hex | Use |
| --- | --- | --- |
| **coal** | `#140C08` | Parlor void, tube interior |
| **felt** | `#5A1824` | Burgundy table, leather pad |
| **brass** | `#C9A15B` | Barrel, rim, JUP shards |
| **lampoil** | `#E8B04A` | Coal-oil lamp, system shards, live digits |
| **smoke** | `#CDB892` | Smoked glass, token shards, labels |
| **claret** | `#8B2430` | Fail linger, capped latch |

RAY ember (`#B85A38`) is brass mixed toward claret. Stake dim (`#9A7A48`) is brass into coal. Unknown ash (`#6A5848`) is smoke dimmed into coal. None is a seventh brand color.

## Type

- **Cormorant Garamond** — parlor invitation mast. High-contrast serif, not Inter, not a SaaS geometric.
- **Cutive Mono** — plate figures, the cap rocker. Reads as a desk stamp, not a terminal theme.

## Tinkerer notes

```bash
npm i
npm run dev
```

Vite serves at `/slotkaleidoscope/`. Open that path, not `/`.

```bash
npm run build
```

must pass. Static `dist/` is force-pushed to the `gh-pages` branch at root (`index.html`, `assets/`, `.nojekyll`). Repo Pages source should be **branch `gh-pages` / folder `/`**. Enabling Pages via API may return **403** (token cannot write Pages settings). One click: GitHub → Settings → Pages → source **`gh-pages` / root**.

Public RPC, rotating on failure (no API keys):

- `solana-rpc.publicnode.com`
- `solana.publicnode.com`
- `solana-mainnet.publicnode.com`
- `api.mainnet-beta.solana.com`
- `solana.drpc.org`

Override with `VITE_RPC_URL`. Methods: `getSlot`, `getRecentPerformanceSamples`, `getRecentPrioritizationFees`, rotating `getSignaturesForAddress` on a short program roster via `@solana/web3.js`. If RPC flakes, the tube keeps the last shards and the plate marks **degraded**.

`prefers-reduced-motion`: static facet view (no tumble, no spin blur); slot / TPS / RTT still update until you cap the eyepiece.

Space or the cap plate freezes the sample.
