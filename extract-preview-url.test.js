const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractPreviewUrl } = require('./extract-preview-url');

const defaultPattern = '\\[Visit Preview\\]\\((https://[^)\\s]+)\\)';

test('extracts the HTTPS preview URL from a Vercel comment', () => {
    const comment = 'Ready: [Visit Preview](https://feature.example.vercel.app/path?a=1)';
    assert.equal(
        extractPreviewUrl(comment, defaultPattern),
        'https://feature.example.vercel.app/path?a=1'
    );
});

test('supports a custom pattern with a capture group', () => {
    assert.equal(
        extractPreviewUrl('Preview: https://preview.example.com', 'Preview: (https://\\S+)'),
        'https://preview.example.com/'
    );
});

test('rejects patterns without a capture group and unsafe URLs', () => {
    assert.throws(() => extractPreviewUrl('https://example.com', 'https://example.com'));
    assert.throws(() => extractPreviewUrl('Preview: javascript:alert(1)', 'Preview: (\\S+)'));
    const credentialUrl = new URL('https://example.com');
    credentialUrl.username = 'user';
    credentialUrl.password = 'pass';
    assert.throws(() => extractPreviewUrl(`Preview: ${credentialUrl}`, 'Preview: (\\S+)'));
});

test('handles a nested quantifier pattern without catastrophic backtracking', () => {
    assert.equal(extractPreviewUrl('a'.repeat(2000) + '!', '((a+)+)$'), null);
});
