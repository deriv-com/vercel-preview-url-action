const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require('@octokit/action');

const cancelAction = async () => {
    if (core.getInput('GITHUB_TOKEN')) {
        const octokit = new Octokit();

        await octokit.actions.cancelWorkflowRun({
            ...github.context.repo,
            run_id: github.context.runId,
        });

        // Wait a maximum of 1 minute for the action to be cancelled.
        await new Promise(resolve => setTimeout(resolve, 60000));
    }

    // If no GitHub token or timeout has passed, fail action.
    process.exit(1);
};

const runAction = async () => {
    const { payload } = github.context;
    const { comment } = payload;

    if (!comment) {
        console.log('Action triggered on non-comment event.');
        await cancelAction();
    }

    const vercel_bot_name = core.getInput('vercel_bot_name');

    if (comment.user.login !== vercel_bot_name) {
        console.log('Comment did not originate from Vercel bot.', {
            vercel_bot_name,
        });
        await cancelAction();
    }

    const cancel_on_strings = core.getInput('cancel_on_strings').split(',');

    if (cancel_on_strings.some(word => comment.body.includes(word))) {
        console.log('Comment contained a word that should cancel the action.', {
            cancel_on_strings,
            comment: comment.body,
        });
        await cancelAction();
    }

    // Safely create and validate the regular expression
    const preview_url_pattern = core.getInput('preview_url_regexp');
    let preview_url_regexp;

    try {
        // Validate the regex pattern is not empty and has reasonable length
        if (!preview_url_pattern || preview_url_pattern.length > 500) {
            throw new Error('Invalid regex pattern: empty or too long');
        }

        // Check for potentially dangerous patterns that could cause ReDoS
        const dangerousPatterns = [
            /(\.\*){2,}/, // Multiple .* patterns
            /(\.\+){2,}/, // Multiple .+ patterns
            /(\([^)]*\*[^)]*\)){2,}/, // Nested quantifiers
            /(\([^)]*\+[^)]*\)){2,}/, // Nested quantifiers with +
        ];

        if (dangerousPatterns.some(pattern => pattern.test(preview_url_pattern))) {
            throw new Error('Potentially dangerous regex pattern detected');
        }

        preview_url_regexp = new RegExp(preview_url_pattern);
    } catch (error) {
        console.log('Invalid or unsafe regular expression pattern.', {
            pattern: preview_url_pattern,
            error: error.message,
        });
        await cancelAction();
    }

    // Execute regex with timeout protection
    let regex_matches;
    try {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Regex execution timeout')), 1000);
        });

        const regexPromise = new Promise((resolve) => {
            resolve(comment.body.match(preview_url_regexp));
        });

        regex_matches = await Promise.race([regexPromise, timeoutPromise]);
    } catch (error) {
        console.log('Regex execution failed or timed out.', {
            error: error.message,
            comment: comment.body,
        });
        await cancelAction();
    }

    if (!regex_matches) {
        console.log("Unable to find a preview URL in comment's body.", {
            comment: comment.body,
        });
        await cancelAction();
    }

    const vercel_preview_url = regex_matches[1];

    if (vercel_preview_url) {
        console.log('Found preview URL.', { vercel_preview_url });
        core.setOutput('vercel_preview_url', vercel_preview_url);
        process.exit(0);
    } else {
        console.log(
            'The regular expression is in an invalid format. Please ensure the first capture group caputures the preview URL.'
        );
        process.exit(1);
    }
};

runAction();
