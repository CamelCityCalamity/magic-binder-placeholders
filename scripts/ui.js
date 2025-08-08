// --- UI Rendering and DOM Manipulation ---

export class BinderUI {
    constructor(settings) {
        //throw an error if settings is not provided
        if (!settings || typeof settings !== "object") {
            throw new Error("Settings must be provided as an object.");
        }

        this._settings = settings

        // --- Internal State ---
        this._sets = [];
        this._setsFiltered = [];
        this._cards = [];
        this._highlightedSetIdx = -1;

        // DOM Elements
        this.landingView = document.getElementById("landing-view");
        this.gridView = document.getElementById("grid-view");
        this.setCode = document.getElementById("set-code");
        this.setName = document.getElementById("set-name");
        this.setSearchForm = document.getElementById("set-search-form");
        this.setSearchInput = document.getElementById("set-search-input");
        this.setList = document.getElementById("set-list");
        this.setListTimestamp = document.getElementById("set-list-timestamp");
        this.refreshSetListButton = document.getElementById("refresh-set-list");
        this.errorMessage = document.getElementById("error-message");
        this.refreshCardListButton = document.getElementById("refresh-card-list");
        this.printModeButton = document.getElementById("enter-print-mode");
        this.binderGrid = document.getElementById("binder-grid");
        this.homeButton = document.getElementById("home-btn");

        // Add Event Properties for API or navigation events
        this.onSetSelected = null;     // function(setCode, setName)
        this.onEnterPrintMode = null;  // function()
        this.onHome = null;            // function()
        this.onRefreshSetList = null;  // function()
        this.onRefreshCardList = null; // function(setCode)
        this.onExitPrintMode = null;   // function()

        // Control panel inputs
        this.marginInputs = {
            top: document.getElementById("margin-top"),
            right: document.getElementById("margin-right"),
            bottom: document.getElementById("margin-bottom"),
            left: document.getElementById("margin-left"),
        };
        this.equalMarginsBtn = document.getElementById("equal-margins-btn");
        this.rarityInputs = {
            mythic: document.getElementById("mythic-count"),
            rare: document.getElementById("rare-count"),
            uncommon: document.getElementById("uncommon-count"),
            common: document.getElementById("common-count"),
        };
        this.columnsInput = document.getElementById("columns");
        this.rowsInput = document.getElementById("rows");

        // --- Event Handlers ---

        // ---- Landing Page ----

        // Filter set list as user types
        this.setSearchInput.addEventListener("input", this._debounce(e => {
            const query = this.setSearchInput.value;
            this._renderSetList(query);
            this._highlightAndScrollSetList(query);            
        }, 120));

        // Handle Enter key and arrow navigation in set search input
        this.setSearchInput.addEventListener("keydown", e => {
            const items = Array.from(this.setList.children);
            if (!items.length) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                this._moveHighlight(1);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                this._moveHighlight(-1);
            } else if (e.key === "Enter") {
                e.preventDefault();
                let idx = this._highlightedSetIdx >= 0 ? this._highlightedSetIdx : 0;                
                this._selectSet(idx);
            }
        });

        // Click on set list item
        this.setList.addEventListener("click", e => {
            const div = e.target.closest(".set-list-item");
            if (!div) return;
            const idx = parseInt(div.dataset.index, 10);              
            this._selectSet(idx);
        });

        // ---- Buttons that need to be handled by Main ----

        // Refresh set list button
        if (this.refreshSetListButton) {
            this.refreshSetListButton.addEventListener("click", () => {
                this._showSetsLoadingMessage();
                this.setListTimestamp.textContent = "Refreshing set list…";
                if (typeof this.onRefreshSetList === "function") this.onRefreshSetList();
            });
        }

        // Refresh set button (in control panel in cards view)
        if (this.refreshCardListButton) {
            this.refreshCardListButton.addEventListener("click", () => {
                this._showLoadingGrid();
                if (typeof this.onRefreshCardList === "function") this.onRefreshCardList();
            });
        }

        // Print Mode button
        if (this.printModeButton) {
            this.printModeButton.addEventListener("click", () => {
                this._showPrintView();
                if (typeof this.onEnterPrintMode === "function") this.onEnterPrintMode();
            });
        }

        // Home button
        if (this.homeButton) {
            this.homeButton.addEventListener("click", () => {
                if (typeof this.onHome === "function") this.onHome();
            });
        }

        // ---- Cards View Controls ----

        // Equal margins button
        if (this.equalMarginsBtn) {
            this.equalMarginsBtn.addEventListener("click", () => {
                const topVal = this.marginInputs.top.value;
                this.marginInputs.right.value = topVal;
                this.marginInputs.bottom.value = topVal;
                this.marginInputs.left.value = topVal;
                this._renderCards()
            });
        }

        // Add event listeners for all controls that affect the grid layout and save settings
        const controls = [
            { input: this.marginInputs.top,      update: (v, settings) => settings.margins.top = parseFloat(v) || 0.16 },
            { input: this.marginInputs.right,    update: (v, settings) => settings.margins.right = parseFloat(v) || 0.16 },
            { input: this.marginInputs.bottom,   update: (v, settings) => settings.margins.bottom = parseFloat(v) || 0.16 },
            { input: this.marginInputs.left,     update: (v, settings) => settings.margins.left = parseFloat(v) || 0.16 },
            { input: this.rarityInputs.mythic,   update: (v, settings) => settings.rarityCounts.mythic = parseInt(v) || 1 },
            { input: this.rarityInputs.rare,     update: (v, settings) => settings.rarityCounts.rare = parseInt(v) || 1 },
            { input: this.rarityInputs.uncommon, update: (v, settings) => settings.rarityCounts.uncommon = parseInt(v) || 1 },
            { input: this.rarityInputs.common,   update: (v, settings) => settings.rarityCounts.common = parseInt(v) || 1 },
            { input: this.columnsInput,          update: (v, settings) => settings.grid.columns = Math.max(1, Math.min(8, parseInt(v) || 4)) },
            { input: this.rowsInput,             update: (v, settings) => settings.grid.rows = Math.max(1, Math.min(8, parseInt(v) || 4)) },
        ];
        controls.forEach(({input, update}) => {
            if (input) {
                input.addEventListener("input", () => {
                    update(input.value, this._settings);
                    this._settings.saveSettings();
                    this._renderCards();
                });
            }
        });

        // ---- Print Mode ----

        // Handle Esc key to exit print mode
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && document.body.classList.contains("print-mode")) {
                this._showGridUiView();
                if (typeof this.onExitPrintMode === "function") this.onExitPrintMode();
            }
        });

        // Setup info/help icon toggles for control panel
        this._setupInfoToggles();
        this._loadSettings();
    }

    // Setup info/help icon toggles for control panel sections
    _setupInfoToggles() {
        const infoSections = [
            {btn: 'printer-margins-info-btn', box: 'printer-margins-info-box'},
            {btn: 'card-counts-info-btn', box: 'card-counts-info-box'},
            {btn: 'grid-size-info-btn', box: 'grid-size-info-box'}
        ];
        infoSections.forEach(({btn, box}) => {
            const button = document.getElementById(btn);
            const infoBox = document.getElementById(box);
            if (button && infoBox) {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = infoBox.style.display !== 'none';
                    // Hide all info boxes first
                    infoSections.forEach(({box: otherBox}) => {
                        const el = document.getElementById(otherBox);
                        if (el) el.style.display = 'none';
                    });
                    // Toggle this one
                    infoBox.style.display = isVisible ? 'none' : 'block';
                });
            }
        });

        // Hide info box if clicking outside
        document.addEventListener('click', (e) => {
            if (![...infoSections.map(s => document.getElementById(s.btn)), ...infoSections.map(s => document.getElementById(s.box))].some(el => el && el.contains(e.target))) {
                infoSections.forEach(({box}) => {
                    const el = document.getElementById(box);
                    if (el) el.style.display = 'none';
                });
            }
        });
    }

    _loadSettings() {
        // Throw an error if settings is not loaded
        if (!this._settings || typeof this._settings !== "object") {
            throw new Error("Settings must be loaded before loading UI controls.");
        }
        const m = this._settings.margins;
        if (m) {
            this.marginInputs.top.value = m.top;
            this.marginInputs.right.value = m.right;
            this.marginInputs.bottom.value = m.bottom;
            this.marginInputs.left.value = m.left;
        }
        const r = this._settings.rarityCounts;
        if (r) {
            this.rarityInputs.mythic.value = r.mythic;
            this.rarityInputs.rare.value = r.rare;
            this.rarityInputs.uncommon.value = r.uncommon;
            this.rarityInputs.common.value = r.common;
        }
        const g = this._settings.grid;
        if (g) {
            this.columnsInput.value = g.columns;
            this.rowsInput.value = g.rows;
        }
    }

    // --- Public Methods ---

    loadSetList(sets, ts) {
        if (!Array.isArray(sets)) {
            throw new Error("Set list must be an array.");
        }
        if (ts && typeof ts !== "number") {
            throw new Error("Timestamp must be a number.");
        }

        this._sets = sets;
        this._setsFiltered = sets;
        this._highlightedSetIdx = -1;

        //reset input
        this.setSearchInput.value = "";
        this._updateSetListTimestamp(ts);
        this._showLandingView();
        this._hideError();
        this._renderSetList();
    }

    loadCardList(setCode, setName, cards, isPrintMode) {
        // cards: array of card objects
        if (!Array.isArray(cards)) {
            throw new Error("Card list must be an array.");
        }
        if (typeof setCode !== "string" || !setCode.trim()) {
            throw new Error("Set code must be a non-empty string.");
        }
        if (typeof setName !== "string" || !setName.trim()) {
            throw new Error("Set name must be a non-empty string.");
        }
        this._cards = cards;
        this.setCode.textContent = setCode.toUpperCase();
        this.setName.textContent = setName;
        this._hideError();
        this._renderCards();
        if (isPrintMode) {
            this._showPrintView();
        } else {
            this._showGridUiView();
        }
    }

    showError(msg) {
        this.errorMessage.textContent = msg;
        this.errorMessage.style.display = "block";
    }

    // --- Private Methods ---

    _hideError() {
        this.errorMessage.textContent = "";
        this.errorMessage.style.display = "none";
    }

    _showSetsLoadingMessage() {
        this._clearSetList();        
        this.setList.innerHTML = "<div class='loading-sets'>Loading sets…</div>";
        this._setsFiltered = [];
        this._highlightedSetIdx = -1;
    }

    _clearSetList() {
        this.setList.innerHTML = "";
        this._setsFiltered = [];
        this._highlightedSetIdx = -1;
    }

    _updateSetListTimestamp(ts) {
        // Throw an error if ts is not a number
        if (typeof ts !== "number") {
            throw new Error("Timestamp must be a number.");
        }

        this.setListTimestamp.textContent = ts
            ? `Set list updated ${this._daysAgo(ts)}`
            : "";
    }

    _showLandingView() {
        this.gridView.classList.add("hidden");
        this.landingView.classList.remove("hidden");
        this._hideError();
        this.setSearchInput.focus();
    }

    _selectSet(idx) {
        const set = this._setsFiltered[idx];
        this._showLoadingGrid(set.code, set.name);
        if (set && typeof this.onSetSelected === "function") {
            this.onSetSelected(set.code, set.name);
        }
    }

    _showLoadingGrid(code = null, name = null) {
        document.body.classList.remove("print-mode");
        this.landingView.classList.add("hidden");
        this.gridView.classList.remove("hidden");
        this.binderGrid.innerHTML = "<div class='loading-cards'>Loading cards…</div>";
        if(code) {
            this.setCode.textContent = this._escapeHTML(code.toUpperCase());
        }
        if(name) {
            this.setName.textContent = this._escapeHTML(name);
        }
    }

    _showGridUiView() {
        document.body.classList.remove("print-mode");
        this.landingView.classList.add("hidden");
        this.gridView.classList.remove("hidden");
    }

    _showPrintView() {
        document.body.classList.add("print-mode");
        this.landingView.classList.add("hidden");
        this.gridView.classList.remove("hidden");
    }

    _daysAgo(ts) {
        if (!ts) return "";
        const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
        if (days < 1) return "today";
        if (days === 1) return "1 day ago";
        return `${days} days ago`;
    }

    _debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    _escapeHTML(str) {
        return str.replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    _renderSetList(query) {
        // Set the filtered sets based on the search query
        if (!query) {
            this._setsFiltered = this._sets;
        } else {
            const q = query.trim().toLowerCase();
            this._setsFiltered = this._sets.filter(set =>
                set.code.toLowerCase().includes(q) ||   
                set.name.toLowerCase().includes(q)
            );
        }

        this.setList.innerHTML = "";
        
        this._setsFiltered.forEach((set, i) => {
            const div = document.createElement("div");
            div.className = "set-list-item";
            div.textContent = `[${set.code.toUpperCase()}] ${set.name}`;
            div.tabIndex = 0;
            div.dataset.index = i;
            div.addEventListener("click", () => {
                if (typeof this.onSetSelected === "function") this.onSetSelected(set.code, set.name);
            });
            this.setList.appendChild(div);
        });
    }

    // Highlight and scroll to the exact match in the set list, or first item.
    _highlightAndScrollSetList(query) {
        const items = Array.from(this.setList.children);
        let exactIdx = -1;
        const q = query.trim().toLowerCase();
        if (!q) {
            items.forEach(div => div.classList.remove("selected"));
            this._highlightedSetIdx = -1;
            this.setList.scrollTop = 0;
            return;
        }
        for (let i = 0; i < this._setsFiltered.length; ++i) {
            const set = this._setsFiltered[i];
            if (
                set.code.toLowerCase() === q ||
                set.name.toLowerCase() === q
            ) {
                exactIdx = i;
                break;
            }
        }
        items.forEach(div => div.classList.remove("selected"));
        if (exactIdx >= 0) {
            items[exactIdx].classList.add("selected");
            items[exactIdx].scrollIntoView({ block: "nearest" });
            this._highlightedSetIdx = exactIdx;
        } else if (items.length > 0) {
            items[0].classList.add("selected");
            items[0].scrollIntoView({ block: "nearest" });
            this._highlightedSetIdx = 0;
        } else {
            this._highlightedSetIdx = -1;
        }
    }

    // Move highlight up/down in set list.
    _moveHighlight(delta) {
        const items = Array.from(this.setList.children);
        if (!items.length) return;
        let idx = this._highlightedSetIdx;
        if (idx < 0) idx = 0;
        idx = Math.max(0, Math.min(items.length - 1, idx + delta));
        items.forEach(div => div.classList.remove("selected"));
        items[idx].classList.add("selected");
        items[idx].scrollIntoView({ block: "nearest" });
        this._highlightedSetIdx = idx;
    }

    _renderCards() {
        // Get user options from this instance's DOM elements
        const margins = {
            top: parseFloat(this.marginInputs.top.value) || 0.16,
            right: parseFloat(this.marginInputs.right.value) || 0.16,
            bottom: parseFloat(this.marginInputs.bottom.value) || 0.16,
            left: parseFloat(this.marginInputs.left.value) || 0.16,
        };
        const rarityCounts = {
            mythic: parseInt(this.rarityInputs.mythic.value) || 1,
            rare: parseInt(this.rarityInputs.rare.value) || 1,
            uncommon: parseInt(this.rarityInputs.uncommon.value) || 1,
            common: parseInt(this.rarityInputs.common.value) || 1,
        };
        const columns = Math.max(1, Math.min(8, parseInt(this.columnsInput.value) || 4));
        const rows = Math.max(1, Math.min(8, parseInt(this.rowsInput.value) || 4));

        // --- Grid math per goals.md ---
        const paperWidth = 8.5, paperHeight = 11;
        const stupidHack = 0.001; // Prevents rounding issues in CSS

        const printableWidth = paperWidth - margins.left - margins.right + stupidHack;
        const printableHeight = paperHeight - margins.top - margins.bottom + stupidHack;

        // Visual margins (the larger of each pair)
        const visualLeftRightMargin = Math.max(margins.left, margins.right);
        const visualTopBottomMargin = Math.max(margins.top, margins.bottom);

        // Shim paddings (difference between margins)
        const shimLeft = margins.right > margins.left ? Math.abs(margins.right - margins.left) : 0;
        const shimRight = margins.left > margins.right ? Math.abs(margins.left - margins.right) : 0;
        const shimTop = margins.bottom > margins.top ? Math.abs(margins.bottom - margins.top) : 0;
        const shimBottom = margins.top > margins.bottom ? Math.abs(margins.top - margins.bottom) : 0;

        // Usable area (printable area minus visual margins)
        const usableWidth = paperWidth - 2 * visualLeftRightMargin;
        const usableHeight = paperHeight - 2 * visualTopBottomMargin;

        // Interior paddings (between cards)
        const cardLeftRightPaddingCount = (columns - 1) * 2;
        const cardTopBottomPaddingCount = (rows - 1) * 2;
        const cardLeftRightPadding = visualLeftRightMargin / 2;
        const cardTopBottomPadding = visualTopBottomMargin / 2;

        // Card marginless width/height
        const cardMarginlessWidth = (usableWidth - cardLeftRightPaddingCount * cardLeftRightPadding) / columns;
        const cardMarginlessHeight = (usableHeight - cardTopBottomPaddingCount * cardTopBottomPadding) / rows;

        // Card widths/heights for edge/middle columns/rows
        const cardWidthEdge = cardMarginlessWidth + cardLeftRightPadding;
        const cardWidthMiddle = cardMarginlessWidth + 2 * cardLeftRightPadding;
        const cardHeightEdge = cardMarginlessHeight + cardTopBottomPadding;
        const cardHeightMiddle = cardMarginlessHeight + 2 * cardTopBottomPadding;

        // --- Dynamic CSS for grid/card sizing ---
        let dynStyle = document.getElementById("dynamic-grid-style");
        if (dynStyle) dynStyle.remove();
        dynStyle = document.createElement("style");
        dynStyle.id = "dynamic-grid-style";
        let css = `
        .binder-grid {
            width: ${printableWidth}in; /*Static CSS file specifies border-box*/
            margin-left: ${shimLeft}in;
            margin-top: ${shimTop}in;
            margin-right: ${shimRight}in;
            margin-bottom: ${shimBottom}in;
        }
        .first-column { width: ${cardWidthEdge}in; padding-left: 0; padding-right: ${cardLeftRightPadding}in; border-right: 1px dotted #888; }
        .middle-column { width: ${cardWidthMiddle}in; padding-left: ${cardLeftRightPadding}in; padding-right: ${cardLeftRightPadding}in; border-right: 1px dotted #888; }
        .last-column { width: ${cardWidthEdge}in; padding-left: ${cardLeftRightPadding}in; padding-right: 0; }
        .first-row { height: ${cardHeightEdge}in; padding-top: 0; padding-bottom: ${cardTopBottomPadding}in; border-bottom: 1px dotted #888; }
        .middle-row { height: ${cardHeightMiddle}in; padding-top: ${cardTopBottomPadding}in; padding-bottom: ${cardTopBottomPadding}in; border-bottom: 1px dotted #888; }
        .last-row { height: ${cardHeightEdge}in; padding-top: ${cardTopBottomPadding}in; padding-bottom: 0; }
        `;
        dynStyle.textContent = css;
        document.head.appendChild(dynStyle);

        // --- Prepare card list ---
        // Expand cards by rarity count
        let expandedCards = [];
        if (!this._cards || !Array.isArray(this._cards)) {
            this.binderGrid.innerHTML = "<div style='padding:2em;text-align:center;'>No cards to display.</div>";
            return;
        }
        for (const card of this._cards) {
            let rarity = (card.rarity || "unknown").toLowerCase();
            let count = rarityCounts[rarity] || 1;
            for (let i = 0; i < count; ++i) expandedCards.push(card);
        }
        // Sort by collector_number
        expandedCards.sort((a, b) => {
            let na = parseInt(a.collector_number), nb = parseInt(b.collector_number);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.collector_number.localeCompare(b.collector_number);
        });

        // --- Render grid ---
        this.binderGrid.innerHTML = "";
        this.binderGrid.style.setProperty('--columns', columns); // Set columns for CSS grid

        const cardsPerPage = rows * columns;
        for (let idx = 0; idx < expandedCards.length; ++idx) {
            const card = expandedCards[idx];
            const col_idx = idx % columns;
            const row_idx = Math.floor(idx / columns) % rows;

            // Determine column class
            let col_class = "";
            if (col_idx === 0) col_class = "first-column";
            else if (col_idx === columns - 1) col_class = "last-column";
            else col_class = "middle-column";

            // Determine row class
            let row_class = "";
            if (row_idx === 0) row_class = "first-row";
            else if (row_idx === rows - 1) row_class = "last-row";
            else row_class = "middle-row";

            // Add page-break class to every Nth card
            let page_break_class = "";
            if ((idx + 1) % cardsPerPage === 0) page_break_class = "page-break";

            const div = document.createElement("div");
            div.className = `binder-card ${col_class} ${row_class} ${page_break_class}`.trim();
            const rarityLabel = this._settings.rarityLabels[card.rarity] || card.rarity.charAt(0).toUpperCase();
            div.innerHTML = `
                <div class="card-name">${this._escapeHTML(card.name)}</div>
                <div class="card-rarity">${this._escapeHTML(rarityLabel)}</div>
                <div class="card-number">${this._escapeHTML(card.collector_number)}</div>
            `;
            this.binderGrid.appendChild(div);
        }
    }
}