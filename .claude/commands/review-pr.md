---
allowed-tools: Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),mcp__github_inline_comment__create_inline_comment
description: Review a pull request with five specialist agents and post the findings
---

Review the pull request identified in: $ARGUMENTS

1. **Read the pull request.** Run `gh pr view <PR_NUMBER> --repo <REPO>` for the title and description, and `gh pr diff <PR_NUMBER> --repo <REPO>` for the changes. Run each as a plain command: no pipes, redirects, heredocs or command substitution, which the permission rules deny. The repository is checked out in the working directory, so read full files there when the diff needs more context.

2. **Run the specialists.** Launch these five agents in one message, so they run in parallel, and wait for all five answers before going on:
   - `code-quality-reviewer`
   - `performance-reviewer`
   - `test-coverage-reviewer`
   - `documentation-accuracy-reviewer`
   - `security-code-reviewer`

   Give each one the PR title, the description and the full diff, and tell it: review only the code this pull request changes; report only noteworthy issues, each with the file path, the line number in the new version of the file, what is wrong and why it matters; and reply "Nothing noteworthy" if there is nothing to report.

3. **Check the findings yourself.** Read the code behind every reported issue. Keep an issue only if you can confirm it in the code, it concerns lines this pull request changed, and a careful senior engineer would want it raised. Drop style preferences, speculation and duplicates.

4. **Post inline comments.** For each issue you kept, call `mcp__github_inline_comment__create_inline_comment` on the line it concerns. Keep each comment short: the problem, why it matters, and a concrete fix.

5. **Always post a summary.** Finish with one top-level comment, `gh pr comment <PR_NUMBER> --repo <REPO> --body "<summary>"`, passing the text directly with `--body`. Start it with `## Claude review`, then give the number of issues raised in each area, or "No noteworthy issues found." when there are none. Post it even when there is nothing to report, so a finished review is always visible on the pull request.
