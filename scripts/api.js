// --- Scryfall API and Caching Logic ---

export class CardApi {
    constructor(settings) {
        this.SETS_URL = "https://api.scryfall.com/sets";
        this.CARDS_URL = setCode => `https://api.scryfall.com/cards/search?order=set&q=e%3A${setCode}&unique=prints`;
        this.SET_LIST_CACHE_KEY = "mbp_set_list";
        this.SET_LIST_TIMESTAMP_KEY = "mbp_set_list_timestamp";
        this.CARD_SET_CACHE_PREFIX = "mbp_card_set_";
        this.CARD_SET_TIMESTAMP_PREFIX = "mbp_card_set_timestamp_";
        this.CACHE_MAX_AGE_DAYS = 7;

        this._settings = settings;
    }

    _isQuotaExceeded(err) {
        if (!err) return false;
        // DOMException checks and message fallback for different browsers
        if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
            return err.code === 22 || err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED';
        }
        return /quota/i.test(String(err.message || err));
    }

    _clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            for (const k of keys) {
                if (
                    k === this.SET_LIST_CACHE_KEY ||
                    k === this.SET_LIST_TIMESTAMP_KEY ||
                    k.startsWith(this.CARD_SET_CACHE_PREFIX) ||
                    k.startsWith(this.CARD_SET_TIMESTAMP_PREFIX)
                ) {
                    try { localStorage.removeItem(k); } catch (e) { console.error('mbp: failed to remove cache key', k, e); }
                }
            }
            console.warn('mbp: cleared localStorage cache keys for app');
        } catch (e) {
            console.error('mbp: failed to clear cache', e);
        }
    }

    _saveSetListToCache(data) {
        try {
            localStorage.setItem(this.SET_LIST_CACHE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('mbp: failed to save set list to cache', e);
            if (this._isQuotaExceeded(e)) {
                console.warn('mbp: quota exceeded while saving set list, clearing cache and retrying');
                this._clearAllCache();
                try { localStorage.setItem(this.SET_LIST_CACHE_KEY, JSON.stringify(data)); } catch (e2) { console.error('mbp: retry failed saving set list', e2); }
            }
        }
    }

    _loadSetListFromCache() {
        try {
            return JSON.parse(localStorage.getItem(this.SET_LIST_CACHE_KEY));
        } catch (e) {
            console.error('mbp: failed to load set list from cache', e);
            return null;
        }
    }

    _saveSetListTimestamp() {
        try {
            localStorage.setItem(this.SET_LIST_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) {
            console.error('mbp: failed to save set list timestamp', e);
            if (this._isQuotaExceeded(e)) {
                console.warn('mbp: quota exceeded while saving set list timestamp, clearing cache and retrying');
                this._clearAllCache();
                try { localStorage.setItem(this.SET_LIST_TIMESTAMP_KEY, Date.now().toString()); } catch (e2) { console.error('mbp: retry failed saving set list timestamp', e2); }
            }
        }
    }

    _loadSetListTimestamp() {
        try { return parseInt(localStorage.getItem(this.SET_LIST_TIMESTAMP_KEY), 10) || 0; } catch (e) { console.error('mbp: failed to load set list timestamp', e); return 0; }
    }

    _saveCardSetToCache(setCode, data) {
        const key = this.CARD_SET_CACHE_PREFIX + setCode;
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('mbp: failed to save card set to cache', setCode, e);
            if (this._isQuotaExceeded(e)) {
                console.warn('mbp: quota exceeded while saving card set, clearing entire cache and retrying');
                this._clearAllCache();
                try {
                    localStorage.setItem(key, JSON.stringify(data));
                    console.warn('mbp: cache write succeeded after clearing cache');
                    return;
                } catch (e2) {
                    console.error('mbp: retry failed saving full card set to cache', setCode, e2);
                }
            }
        }
    }

    _loadCardSetFromCache(setCode) {
        try {
            const raw = localStorage.getItem(this.CARD_SET_CACHE_PREFIX + setCode);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return null;
            // Basic validation: ensure items have expected properties
            if (parsed.length === 0) return parsed;
            const item = parsed[0];
            if (!Object.prototype.hasOwnProperty.call(item, 'name') || !Object.prototype.hasOwnProperty.call(item, 'rarity') || !Object.prototype.hasOwnProperty.call(item, 'collector_number')) {
                console.warn('mbp: cached card set items missing expected fields, ignoring cache for', setCode);
                return null;
            }
            return parsed;
        } catch (e) {
            console.error('mbp: failed to load card set from cache', setCode, e);
            return null;
        }
    }

    _saveCardSetTimestamp(setCode) {
        try {
            localStorage.setItem(this.CARD_SET_TIMESTAMP_PREFIX + setCode, Date.now().toString());
        } catch (e) {
            console.error('mbp: failed to save card set timestamp for', setCode, e);
            if (this._isQuotaExceeded(e)) {
                console.warn('mbp: quota exceeded while saving card set timestamp, clearing cache and retrying');
                this._clearAllCache();
                try { localStorage.setItem(this.CARD_SET_TIMESTAMP_PREFIX + setCode, Date.now().toString()); } catch (e2) { console.error('mbp: retry failed saving card set timestamp', setCode, e2); }
            }
        }
    }

    _loadCardSetTimestamp(setCode) {
        try { return parseInt(localStorage.getItem(this.CARD_SET_TIMESTAMP_PREFIX + setCode), 10) || 0; } catch (e) { console.error('mbp: failed to load card set timestamp for', setCode, e); return 0; }
    }

    getSetListTimestamp() {
        return this._loadSetListTimestamp();
    }

    async fetchSet(setCode, { force = false } = {}) {
        // call fetchSetList and then find the indicated setCode among the list and return that set
        const setList = await this.fetchSetList({ force });
        const set = setList.find(s => s.code.toLowerCase() === setCode.toLowerCase());
        if (!set) {
            throw new Error(`Set with code "${setCode}" not found.`);
        }
        return set;
    }

    // Fetch set list from Scryfall or cache
    async fetchSetList(force = false) {
        let sets = this._loadSetListFromCache();
        const ts = this._loadSetListTimestamp();
        const cacheValid = ts && (Date.now() - ts < this.CACHE_MAX_AGE_DAYS * 86400000);

        if (sets && !force && cacheValid) {
            return sets;
        }
        try {
            const resp = await fetch(this.SETS_URL);
            if (!resp.ok) throw new Error("Failed to fetch set list.");
            const json = await resp.json();
            const excludedSetTypes = this._settings?.excludedSetTypes ?? [];
            sets = json.data
                .filter(set =>
                    set.card_count &&
                    set.code &&
                    set.name &&
                    !excludedSetTypes.includes(set.set_type)
                )
                .sort((a, b) => new Date(b.released_at || 0) - new Date(a.released_at || 0));
            this._saveSetListToCache(sets);
            this._saveSetListTimestamp();
            return sets;
        } catch (e) {
            throw new Error(`Could not fetch set list: ${e.message || e} `);
        }
    }

    // Fetch all cards for a set from Scryfall or cache
    async fetchCardsForSet(setCode, force = false) {
        let cards = this._loadCardSetFromCache(setCode);
        const ts = this._loadCardSetTimestamp(setCode);
        const cacheValid = ts && (Date.now() - ts < this.CACHE_MAX_AGE_DAYS * 86400000);

        if (cards && !force && cacheValid) {
            return cards;
        }
        try {
            let url = this.CARDS_URL(setCode);
            cards = [];
            while (url) {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error("Failed to fetch cards.");
                const json = await resp.json();
                cards = cards.concat(json.data);
                url = json.has_more ? json.next_page : null;
            }

            // Reduce the raw Scryfall objects to a minimal payload the UI needs.
            const minimal = cards.map(c => ({
                name: c.name,
                rarity: c.rarity,
                collector_number: c.collector_number
            }));

            this._saveCardSetToCache(setCode, minimal);
            this._saveCardSetTimestamp(setCode);
            return minimal;
        } catch (e) {
            throw new Error(`Could not fetch set cards: ${e.message || e}`);
        }
    }
}