# brand/scratch — throwaway output bin

Outputs from `packages/brand/examples/*.py` land here.

Rules:

- **Gitignored.** Nothing in this folder is committed (except this
  README and the `.gitignore` itself). Delete files here whenever you
  want. Regenerate via the matching `examples/` script.
- **Not a workspace.** Do not edit source code here. If you find
  yourself opening a file in `scratch/` to tweak it, stop — the change
  belongs in `packages/brand/src/brand/` (capability) or
  `apps/<project>/` (app-specific).
- **Ephemeral by design.** `scripts/tidy.py` may start warning about
  stale scratch files in the future; if your file matters, move it out
  — typically into `apps/<project>/brand/illustrations/`.

## Typical use

```bash
# Default — raster PNG via Gemini + Pillow alpha. Keeps accent-colour fill.
python3 packages/brand/examples/illustrate.py \
  --theme warm_drift \
  --scene "<what you want to draw>"

# Vector — same raster, traced by vtracer into a real editable SVG.
# 2–4x slower, but scalable.
python3 packages/brand/examples/illustrate.py \
  --theme warm_drift \
  --scene "<what you want to draw>" \
  --lane vector
```

See `packages/brand/examples/README.md` for the full list of demos.
