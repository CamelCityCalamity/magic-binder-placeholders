import { Settings } from './settings.js';
import { BinderUI } from './ui.js';
import { CardApi } from './api.js';

let binderUI;
let cardApi;

// Navigation helpers
function getNavStateFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return { setCode: null, isPrintMode: false };
    const [setCode, mode] = hash.split("/");
    return {
        setCode: setCode || null,
        isPrintMode: mode === "print" ? true : false
    };
}

function setNavState( setCode = null, isPrintMode = false) {
    let hash = "";
    if (setCode) hash = setCode + (isPrintMode ? "/print" : "");
    window.location.hash = hash;
}

// App initialization
async function init() {
    // Construct dependencies after DOM is ready
    const settings = new Settings();
    binderUI = new BinderUI(settings);
    cardApi = new CardApi(settings);

    // Set up event handlers for BinderUI
    binderUI.onSetSelected = async (setCode, setName) => {
        setNavState(setCode);
    };

    binderUI.onEnterPrintMode = () => {
        const { setCode } = getNavStateFromHash();
        setNavState( setCode, true );
    };

    binderUI.onExitPrintMode = () => {
        const { setCode } = getNavStateFromHash();
        setNavState(setCode);
    };

    binderUI.onHome = () => {
        setNavState();
    };

    binderUI.onRefreshSetList = async () => {
        try {
            // Short delay to make it obvious to user it's working.
            await new Promise(resolve => setTimeout(resolve, 500));
            const sets = await cardApi.fetchSetList(true);
            binderUI.loadSetList(sets, Date.now());
        } catch (e) {
            binderUI.showError(e.message || "Failed to refresh set list.");
        }
    };

    binderUI.onRefreshCardList = async () => {
        const { setCode, isPrintMode: print } = getNavStateFromHash();
        if (setCode) {
            try {
                // Short delay to make it obvious to user it's working.
                await new Promise(resolve => setTimeout(resolve, 500));

                const cards = await cardApi.fetchCardsForSet(setCode, true);
                const set = await cardApi.fetchSet(setCode);
                const setName = set.name || setCode;
                binderUI.loadCardList(setCode, setName, cards, print);
            } catch (e) {
                binderUI.showError(e.message || "Failed to refresh card list.");
            }
        }
    };

    window.addEventListener('hashchange', handleNavigation);

    // Initial navigation
    handleNavigation();
}

// Navigation and event listeners
window.addEventListener('DOMContentLoaded', init);

// Navigation handler
async function handleNavigation() {
    const { setCode, isPrintMode: print } = getNavStateFromHash();

    if (!setCode) {
        showSetList();
    } else {
        showCardList(setCode, print);
    }
}

async function showSetList() {
    // Show set list
    try {
        const sets = await cardApi.fetchSetList();
        const timestamp = cardApi.getSetListTimestamp();
        binderUI.loadSetList(sets, timestamp);
    } catch (e) {
        binderUI.showError(e.message || "Failed to load set list.");
    }
}

async function showCardList(setCode, isPrintMode, setName = null) {
    // Show card list for a specific set
    try {
        const cards = await cardApi.fetchCardsForSet(setCode);
        // If no set name, call fetchSet to get it
        if (!setName) {
            const set = await cardApi.fetchSet(setCode);
            setName = set.name || "Unkown Set Name";
        }
        binderUI.loadCardList(setCode, setName, cards, isPrintMode);
    } catch (e) {
        binderUI.showError(e.message || "Failed to load card list.");
    }
}