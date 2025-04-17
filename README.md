# steering-interface
 
**TODO (next actions):** 
- refactor types to be domain-driven
- side-by-side add summary of differences
- add pending features to comparison view
- in comparison view, subtle highlight the differences in the steered response

**SMALL FIXES:**
- stream response?
- animate feature clustering?
- tooltip to try enhancing your response? (prompt controls from chat)
- brainstorm ways to deprioritize controls panel
    - experiment with graying out chat vs controls panel?
    - summary version in chat so you can close controls panel?
    - show top 2 features / cluster and allow user to show more?
- show feature editor always to prompt user to edit
- comparison view width to be a larger breakpoint than parent div
- handle steering feature to 0 (don't want to show as an active steer)
- if cancel steering, update the activations in whichever tab where they were modified
- paginated search / show more?

## LOG
- `04-09`: implement side-by-side steering comparison
- `04-16`: implement auto-steer toggle, add loading types
