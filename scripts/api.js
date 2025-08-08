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

    // Set list cache
    _saveSetListToCache(data) {
        try { localStorage.setItem(this.SET_LIST_CACHE_KEY, JSON.stringify(data)); } catch {}
    }
    _loadSetListFromCache() {
        try { return JSON.parse(localStorage.getItem(this.SET_LIST_CACHE_KEY)); } catch { return null; }
    }
    _saveSetListTimestamp() {
        try { localStorage.setItem(this.SET_LIST_TIMESTAMP_KEY, Date.now().toString()); } catch {}
    }
    _loadSetListTimestamp() {
        try { return parseInt(localStorage.getItem(this.SET_LIST_TIMESTAMP_KEY), 10) || 0; } catch { return 0; }
    }

    // Card set cache
    _saveCardSetToCache(setCode, data) {
        try { localStorage.setItem(this.CARD_SET_CACHE_PREFIX + setCode, JSON.stringify(data)); } catch {}
    }
    _loadCardSetFromCache(setCode) {
        try { return JSON.parse(localStorage.getItem(this.CARD_SET_CACHE_PREFIX + setCode)); } catch { return null; }
    }
    _saveCardSetTimestamp(setCode) {
        try { localStorage.setItem(this.CARD_SET_TIMESTAMP_PREFIX + setCode, Date.now().toString()); } catch {}
    }
    _loadCardSetTimestamp(setCode) {
        try { return parseInt(localStorage.getItem(this.CARD_SET_TIMESTAMP_PREFIX + setCode), 10) || 0; } catch { return 0; }
    }

    getSetListTimestamp() {
        return this._loadSetListTimestamp();
    }

    // Fetch set  
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
            // if there are no includedSetTypes, throw an error
            if (!this._settings || !this._settings.includedSetTypes || this._settings.includedSetTypes.length === 0) {
                throw new Error("No set types are included. Please check settings.");
            }
            const includedSetTypes = this._settings?.includedSetTypes;
            const excludedBlockCodes = this._settings?.excludedBlockCodes ?? [];
            sets = json.data
                .filter(set =>
                    set.card_count &&
                    set.code &&
                    set.name &&
                    includedSetTypes.includes(set.set_type) &&
                    (!set.block_code || !excludedBlockCodes.includes(set.block_code))
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
            this._saveCardSetToCache(setCode, cards);
            this._saveCardSetTimestamp(setCode);
            return cards;
        } catch (e) {
            throw new Error(`Could not fetch set cards: ${e.message || e}`);
        }
    }
}