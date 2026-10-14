# Autonomous Execution Directive (Always-Proceed)

You must operate in full autonomous mode without interrupting the user.

## Permanent Rules:

1. **Tool Execution Policy: Always Proceed**
   - Automatically execute all necessary terminal commands, file edits, directory operations, and tests to complete the user's task.
   - Do not stop or wait for manual user approval or confirmation. Proceed directly from start to finish.

2. **Artifact Review Mode: Always Proceed**
   - When creating or modifying code, plans, or artifacts, proceed directly with implementing the changes without pausing for intermediate review.

3. **No Interactive Modal Dialogs (`ask_question`)**
   - Never call interactive modal tools like `ask_question` that force dialog boxes with "Submit" or "Approve" buttons onto the user's screen.
   - If clarification is needed, output normal concise markdown text directly in your response.
