// --- Application Settings ---

export class Settings {
    constructor() {
        // Defaults
        this.rarityLabels = {
            mythic: "M",
            rare: "R",
            uncommon: "U",
            common: "C",
            special: "S",
            bonus: "B",
            promo: "P",
            token: "T",
            land: "L"
        };
        
        this.includedSetTypes = [
            "core",
            "expansion",
            "masters",
            "draft_innovation",
            "commander",
            "alchemy",
            "funny",
            "starter",
            "box"
        ];
        
        this.excludedBlockCodes = [
            "htr"
        ];

        // UI-persisted settings (defaults)
        this.margins = {
            top: 0.16,
            right: 0.16,
            bottom: 0.16,
            left: 0.16
        };

        this.rarityCounts = {
            mythic: 1,
            rare: 1,
            uncommon: 1,
            common: 1
        };

        this.grid = {
            columns: 4,
            rows: 4
        };

        this._storageKey = 'magic-binders-user-settings-v1';
        this._loadFromStorage();
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data !== 'object' || !data) return;
            if (data.margins) this.margins = { ...this.margins, ...data.margins };
            if (data.rarityCounts) this.rarityCounts = { ...this.rarityCounts, ...data.rarityCounts };
            if (data.grid) this.grid = { ...this.grid, ...data.grid };
        } catch (e) {
            // Ignore errors, use defaults
        }
    }

    saveSettings() {
        const data = {
            margins: this.margins,
            rarityCounts: this.rarityCounts,
            grid: this.grid
        };
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(data));
        } catch (e) {
            // Ignore errors
        }
    }
}