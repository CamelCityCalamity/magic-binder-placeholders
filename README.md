# MTG Binder Placeholders

**Try it out online:**  
https://camelcitycalamity.github.io/magic-binder-placeholders/

---

Print paper placeholders for your Magic: The Gathering binder sleeves. This is most useful for a game store that has MTG binders where cards come and go frequently, but might also be of use to collectors.

No card images are used.

It fetches card data directly from the Scryfall API, allowing you to select a set, adjust print options, and generate a perfectly-aligned grid that is easy to cut with scissors.

## Features

- **Set Search:** Find an MTG set using the Scryfall API. (Some sets are not included and require changing settings.js to include.)
- **Customizable Print Grid:** Choose the number of rows and columns per page to change the size of the printed placeholders. Cut lines are included.
- **Adjustable Margins:** Fine-tune printer margins for perfect alignment of the printed placeholders. This ensures the printed page can be sliced into equal sized placeholders.
- **Card Counts:** Set how many placeholders to print for each rarity (mythic, rare, uncommon, common). Useful if you want extra slots for rares or something.
- **Print Mode:** Hide the UI with one click. Use Back or Esc to restore the UI.
- **Local Storage:** User settings, set lists, and card data are cached in your browser for speed.
- **Refresh Buttons:** Manually refresh the set list or card data from Scryfall if needed.

## Technical Details

- **Single-page app** written in vanilla JavaScript (no frameworks).
- **No backend required** all data is fetched from the public Scryfall API using JavaScript.
- **User settings and cache** are stored in browser localStorage.
- **No tracking, ads, or analytics.**

## Development

- All code is in plain JS, CSS, and HTML. See the `scripts/` folder for logic.
- To run locally, serve the site with any static web server like the one included in Python:

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080/index.html

---

Powered by the [Scryfall API](https://scryfall.com/docs/api). This project is not affiliated with or endorsed by Wizards of the Coast.
