# Store Assets — ReddID Love Button

This folder contains the listing copy, screenshot specs, and promo image requirements for the Chrome Web Store and Firefox Add-ons (AMO) submissions.

See `listing.md` for the store listing copy and `screenshots.md` for screenshot captions and layout notes.

---

## Required assets checklist

### Chrome Web Store

| Asset | Size | Format | Status |
|-------|------|--------|--------|
| Small icon (tile) | 128 × 128 px | PNG | ✅ `icons/icon128.png` |
| Screenshots (min 1, max 5) | 1280 × 800 px or 640 × 400 px | PNG or JPG | 🔲 Needed |
| Promo tile (small) | 440 × 280 px | PNG or JPG | 🔲 Needed |
| Marquee promo image | 1400 × 560 px | PNG or JPG | 🔲 Optional |

### Firefox Add-ons (AMO)

| Asset | Size | Format | Status |
|-------|------|--------|--------|
| Icon | 64 × 64 px or 128 × 128 px | PNG | ✅ `icons/icon128.png` |
| Screenshots (min 1, max 10) | Min 800 px wide | PNG or JPG | 🔲 Needed |

---

## Screenshot requirements

Capture at 1280 × 800 px on Chrome (use DevTools → Device toolbar or a clean profile).

### Screenshot 1 — Popup: handle lookup result
- Visit `redd.love` in a tab or any page
- Open the popup
- Search for a registered handle
- Show the result state: name, social badges, RDD address, balance, BIP21 buttons
- **Filename:** `ss1-popup-result.png`

### Screenshot 2 — Popup: auto-detected creator
- Visit a Twitter/X profile that has a registered ReddID
- Open the popup
- Show the auto-detect banner ("username on twitter — click to look up")
- **Filename:** `ss2-popup-autodetect.png`

### Screenshot 3 — In-page tip button (Twitter/X)
- Visit a Twitter/X creator profile with a registered ReddID
- Show the injected "Tip with Ɍ RDD" red button next to the Follow button
- **Filename:** `ss3-inpage-twitter.png`

### Screenshot 4 — In-page tip button (GitHub)
- Visit a GitHub profile with a registered ReddID
- Show the injected button in the profile sidebar
- **Filename:** `ss4-inpage-github.png`

### Screenshot 5 — Settings page
- Open the extension options page
- Show the API endpoint and block explorer fields
- **Filename:** `ss5-options.png`

---

## Promo tile copy (440 × 280 px)

```
[background: #080808]
[top-left: ReddID logo / Ɍ symbol, brand red #E30613]

  Tip creators with
  Ɍ ReddCoin
  directly in your browser.

[small text, bottom: redd.love]
```

---

## Notes

- All screenshots must show real (or realistic demo) data — no placeholder text
- The RDD address shown in screenshots should be a real mainnet address format (starts with R, 34 chars)
- Do not show private keys, seed phrases, or API tokens in any screenshot
- Store listing copy lives in `listing.md`
