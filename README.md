# DELPHI — Beyond the Visible

Project page for **Beyond the Visible: Learning Dense 4D Motion in Contact-Rich Deformable Worlds**.

**Live page:** https://alexpeng517.github.io/DELPHI/

The page embeds interactive [Rerun](https://rerun.io) viewers. Smaller recordings live in `docs/public/recordings/`; the large ADYTON benchmark and multi-view recordings are served from the [`AlexPeng/delphi-recordings`](https://huggingface.co/datasets/AlexPeng/delphi-recordings) Hugging Face dataset.

## Run locally

```bash
cd docs
npm install
npm run dev
```

Pushes to `main` that touch `docs/` deploy to GitHub Pages via `.github/workflows/deploy.yml`.
