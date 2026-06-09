# Chat Input Progress Bar Loading

## Summary

Add an indeterminate scrolling-dots progress bar animation to the chat input area in `ChatPanel.vue` when SSE streaming is active. The dots appear below the input row (inside the `bg-cyber-dark` container, above the model selector/mode toggle) and play while `streaming === true`.

## Motivation

When the user sends a message and waits for the SSE stream to respond, the input becomes disabled and shows a "◼ Dừng" (Stop) button — but there is no visual indicator of *activity* at the input level. The scrollable message area may be far down, so glancing at the input area gives no feedback about whether streaming is in progress. A scrolling dots animation provides a clear, terminal-style "alive" indicator.

## Design

### Position

Below the `<form>` row (input + stop button), inside the `bg-cyber-dark` container, before the model selector / mode toggle row.

### Visibility

`v-if="streaming"` — animated dots render only when the SSE stream is active.

### Visual spec

| Property | Value |
|---|---|
| Dot count | 8 |
| Dot size | 4px × 4px (`w-1 h-1`) |
| Dot shape | `rounded-full` |
| Dot color | `bg-cyber-accent` (`#3B82F6`) |
| Gap | 4px (`gap-1`) |
| Animation | Opacity oscillation per dot, staggered 0.15s offset, 1.2s loop |
| Opacity range | 0.2 (dim) ↔ 1.0 (bright) |
| Container | `flex items-center`, left-aligned, `px-3 pb-3` padding |

### Animation keyframe

```
dot-pulse:
  0%, 100% → opacity: 0.2
  50%      → opacity: 1.0
```

Applied with `animation: dot-pulse 1.2s ease-in-out infinite` and staggered `animation-delay` values.

## Implementation

### Files changed

1. **`frontend/tailwind.config.ts`** — add `dot-pulse` keyframe + animation entry
2. **`frontend/src/components/ChatPanel.vue`** — add dots template block (inside the `bg-cyber-dark` div, after the `<form>`, before the outer `<div class="flex items-center justify-between ...">`)
3. **`frontend/src/locales/vi.json`** and **`frontend/src/locales/en.json`** — no changes needed (no new UI text)

### Template structure

```html
<!-- inside the bg-cyber-dark container, after </form> -->
<div v-if="streaming" class="flex items-center gap-1 px-3 pb-3">
  <div v-for="i in 8" :key="i"
    class="w-1 h-1 bg-cyber-accent rounded-full animate-dot-pulse"
    :style="{ animationDelay: `${(i - 1) * 0.15}s` }"
  />
</div>
```

### Tailwind config addition

```ts
keyframes: {
  'dot-pulse': {
    '0%, 100%': { opacity: '0.2' },
    '50%': { opacity: '1' },
  },
},
animation: {
  'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
},
```

## Edge cases

- **Abort/stop**: `streaming` is set to `false` in the `finally` block of `submit()`, so dots disappear when the user clicks Stop.
- **Stream error**: Same `finally` block handles this — dots disappear.
- **No model selected / empty input**: `submit()` returns early before `streaming` is set to `true`; dots never appear.
- **Rapid sends**: Each `submit()` call sets `streaming = true` at entry and `streaming = false` at exit (finally). Since input is disabled while streaming, no second send can occur.
