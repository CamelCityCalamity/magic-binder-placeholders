// --- Utility Functions ---

export class Utils {
    daysAgo(ts) {
        if (!ts) return "";
        const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
        if (days < 1) return "today";
        if (days === 1) return "1 day ago";
        return `${days} days ago`;
    }

    debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
}