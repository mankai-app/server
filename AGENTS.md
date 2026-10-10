# Package Manager

- Use `bun` exclusively. Do not use `npm`, `yarn`, `pnpm`, or any other package manager.
- When adding or removing packages, use the Bun CLI (`bun add` / `bun remove`) instead of editing `package.json` directly.

# Naming Conventions

- When defining a server function, add the `Fn` suffix to its name (e.g., `createUserFn`, `deletePostFn`).

# Writing Style

- Do not use semicolons in any text except code.

# Styling

- **Avoid inline styles.** If a component needs custom styling, create a `.module.scss` file.
- **SCSS nesting:** Structure SCSS classes to mirror the DOM/div hierarchy. Use nested class selectors instead of flat BEM-style naming.
- **CSS variables:** Always use CSS variables for `font-size` and `color`. If a needed variable doesn't exist in `styles.css`, create it there first.
- **Global form controls:** `button`, `select`, `input`, and `textarea` have global styles in `styles.css`. When styling these elements, only add the necessary overrides—do not duplicate or redefine global styles.
- **Font weight:** Use only `bold` or `normal` for `font-weight`. Do not use numeric values (e.g., `400`, `600`, `700`).
- **Transitions:** Use `0.15s ease` for all interactive transitions (`:hover`, `:focus`, `:active`). Only use `0.3s ease` for progress bar fills and large positional animations (e.g., sidebar slide). Always declare a `transition` on any element that changes `color`, `background-color`, `border-color`, or `opacity` on state change — missing transitions cause jarring visual snaps.

# Accessibility and Testing

- Do not add accessibility features or make accessibility-specific changes.
- Tests are not required, do not add or run tests.

# Notifications

- The app provides a global notification system via `NotificationProvider` (mounted in `src/routes/__root.tsx`). Do **not** mount it more than once.
- To show a notification, call `useNotification()` and use one of `notify.success()`, `notify.failed()`, or `notify.warning()`. Each takes a `message` string and an optional `{ title?, duration? }`:
  - `notify.success("Saved!")`
  - `notify.failed("Could not save.", { title: "Error" })`
  - `notify.warning("This action cannot be undone.")`
- Default auto-dismiss durations: `success` 4000ms, `warning` 5000ms, `failed` 6000ms. Pass `duration: 0` to keep the notification until the user dismisses it.
- Prefer `notify.success` / `notify.failed` / `notify.warning` over inline error state or `alert()` for user-facing feedback.
