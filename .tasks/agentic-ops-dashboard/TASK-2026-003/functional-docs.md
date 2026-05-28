# Agentic Ops Dashboard

## Overview

This update improves the everyday dashboard experience without changing the
workspace rules behind it. The dashboard is now easier to scan, the interface
can switch between English and Spanish from the page itself, and live task
changes are surfaced more clearly so important movement does not get lost in a
full-screen refresh feeling.

The governed resource area keeps the same safety boundaries as before. What
changed is the clarity of the shell around it: labels, prompts, warnings, and
guidance now follow the selected language while workspace content stays true to
its original source.

## What Was Implemented

- A refreshed workspace shell with clearer hierarchy around the current state,
  selected task, and governed resource area.
- A visible English and Spanish switcher in the dashboard itself.
- Immediate language switching without leaving the current view.
- Remembered language preference when the dashboard is reloaded or reopened in
  the same browser.
- Stronger live update feedback through changed-task highlighting and visible
  board movement when a task changes status.
- Translated warnings, empty states, labels, confirmations, and operational
  guidance across the main dashboard surfaces.

## How To Use The Bilingual Shell

### Change the language

- Use the language control in the top area of the dashboard.
- Choose English or Espanol.
- The change happens immediately on the current screen.
- You do not need to open a settings page or manually reload the dashboard.
- If you already have a task selected, the dashboard keeps that context instead
  of resetting your place.

### Use the main workspace view

- The top shell summarizes the current workspace, selected task, and live
  activity.
- The task board groups work by lifecycle stage so it is easier to see what is
  being explored, planned, implemented, completed, archived, or kept in sandbox
  iteration.
- Selecting a task opens its detail view so you can inspect its status,
  artifacts, and explicit relations.
- The governed resource area remains available for resource actions, now with
  prompts and warnings shown in the selected language.

### What the dashboard translates

The dashboard translates its own shell, including:

- section titles
- buttons and action labels
- empty states
- dashboard-owned status labels
- warnings and confirmations
- resource action prompts
- supporting operational guidance

## Realtime Change Highlighting

The dashboard still updates while it is open, but it now makes those updates
easier to notice and easier to follow.

- If a task changes after the dashboard has already loaded, that task is
  highlighted so the change stands out.
- If a task moves from one workflow stage to another, the board shows that
  movement instead of feeling like a full page refresh.
- The first load does not mark every task as changed. Highlighting is reserved
  for updates that happen after the dashboard is already on screen.
- Once you open a changed task, the highlight is cleared because the dashboard
  treats that change as acknowledged.
- If no live update has happened yet, the dashboard simply shows that it is
  waiting for the first realtime event.

## What Stays Untranslated

The dashboard only translates the interface around your work. It does not
rewrite content that comes directly from the repository.

The following stay exactly as authored:

- task IDs such as `TASK-2026-003`
- file and folder names
- paths
- raw artifact contents and previews
- text written inside workspace artifacts or repository files
- other source-authored values that belong to the workspace, not the shell

This is intentional. The dashboard changes the language of the shell, not the
language of your source material.

## Persistence Behavior

The dashboard remembers your language choice in the same browser so you do not
need to set it every time.

- If you switch to Spanish, the dashboard reopens in Spanish.
- If you switch to English, it reopens in English.
- Changing language does not interrupt the current task you are viewing.
- If there is no saved preference, or the saved value cannot be used, the
  dashboard falls back safely to English.

## Notable Edge Cases

- If the browser cannot save preferences, the language can still change for the
  current session but may not be remembered later.
- Older sessions that only stored the locale locally may need one normal reload
  before the cookie-backed preference is fully established.
- If a translation entry is missing, the dashboard falls back safely instead of
  rewriting workspace content.
- Large files, folders, and content without inline preview support remain
  limited-preview or read-only surfaces and are not translated.
- Switching languages does not change task data, workspace files, or the safety
  rules behind governed resource actions.

## Summary

The dashboard is now easier to scan, easier to operate in English or Spanish,
and better at surfacing live changes without changing the underlying meaning of
workspace content. Language selection is immediate, remembered, and limited to
the dashboard shell so source-authored material stays untouched.