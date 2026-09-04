## Working conventions for this project

- Read docs/PROJECT_STATUS.md before starting any task.
- Explain your design reasoning before writing code, briefly, then implement.
- Any change touching matching/reconciliation logic MUST be verified against
  the true_match_id ground truth via SQL before being considered done —
  never trust aggregate counts alone, always check individual pair
  correctness. Show me the verification query and its result.
- For frontend/design tasks, pull real design context directly via Figma's
  MCP tools (get_metadata, get_screenshot, get_design_context) against the
  file/node IDs in docs/PROJECT_STATUS.md — do not work from a secondhand
  description of a screen. Once a screen is wired up, verify it against a
  REAL running batch through the real API (screenshot showing real data),
  not the Figma mockup's illustrative data.
- Prefer editing existing files over rewriting from scratch for small changes.
- After finishing a task: run it, verify it, then git commit with a message
  describing what changed AND what was verified.
- Do not modify the 5 core graph nodes (app/graph/nodes.py), the two-pass
  orchestration (run_batch.py), or the matching logic (matching.py,
  exception_analysis.py) unless the task explicitly asks you to — these are
  verified and I don't want them touched incidentally.