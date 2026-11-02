const { RE2JS } = require('re2js');

const extractPreviewUrl = (comment, pattern) => {
    if (!pattern || pattern.length > 500) {
        throw new Error('The preview URL pattern must be 1 to 500 characters long.');
    }

    // RE2JS evaluates user-supplied patterns without catastrophic backtracking.
    const regexp = RE2JS.compile(pattern);
    if (regexp.groupCount() < 1) {
        throw new Error('The preview URL pattern needs a capture group.');
    }

    const match = regexp.exec(comment);
    if (!match) return null;

    const candidate = match[1];
    if (!candidate) return null;

    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('The preview URL must be an HTTPS URL without credentials.');
    }

    return url.href;
};

module.exports = { extractPreviewUrl };
