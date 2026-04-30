---
name: No Claude co-author line in commits
description: User does not want the "Co-Authored-By: Claude" trailer added to git commits
type: feedback
---

When creating commits, do NOT add the `Co-Authored-By: Claude ...` trailer. Just commit with the regular message — no Claude attribution.

**Why:** User explicitly said "no claude coauthor" when preparing to push. Likely doesn't want it visible in team git history.

**How to apply:** Strip the standard Co-Authored-By Claude line from any commit message you draft for this user. Confirm before adding any other trailers.
