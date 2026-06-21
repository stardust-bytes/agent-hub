<template>
  <TransitionRoot :show="open" as="template" @after-leave="query = ''">
    <Dialog as="div" class="relative z-[60]" @close="close">
      <TransitionChild as="template"
        enter="duration-150 ease-out" enter-from="opacity-0" enter-to="opacity-100"
        leave="duration-100 ease-in" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-foreground/40" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4 pt-[15vh]">
        <TransitionChild as="template"
          enter="duration-150 ease-out" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100"
          leave="duration-100 ease-in" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
          <DialogPanel class="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-elevated shadow-xl">
            <Combobox @update:model-value="onSelect">
              <div class="flex items-center gap-2 border-b border-border px-4">
                <HiSearch class="h-4 w-4 shrink-0 text-muted-foreground" />
                <ComboboxInput
                  class="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder-muted-foreground"
                  :placeholder="t('palette.placeholder')"
                  autocomplete="off"
                  @change="query = $event.target.value"
                />
              </div>
              <ComboboxOptions static class="max-h-80 overflow-y-auto py-2">
                <div v-if="filteredNav.length === 0 && filteredActions.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                  {{ t('palette.empty') }}
                </div>
                <template v-if="filteredNav.length">
                  <div class="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('palette.section.navigate') }}</div>
                  <ComboboxOption v-for="item in filteredNav" :key="item.key" :value="item" v-slot="{ active }" as="template">
                    <li :class="['mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm', active ? 'bg-primary/10 text-primary' : 'text-foreground']">
                      <component :is="item.icon" v-if="item.icon && typeof item.icon !== 'string'" class="h-4 w-4 shrink-0" />
                      <span class="truncate">{{ item.label }}</span>
                    </li>
                  </ComboboxOption>
                </template>
                <template v-if="filteredActions.length">
                  <div class="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('palette.section.actions') }}</div>
                  <ComboboxOption v-for="item in filteredActions" :key="item.key" :value="item" v-slot="{ active }" as="template">
                    <li :class="['mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm', active ? 'bg-primary/10 text-primary' : 'text-foreground']">
                      <span class="truncate">{{ item.label }}</span>
                    </li>
                  </ComboboxOption>
                </template>
              </ComboboxOptions>
            </Combobox>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Dialog, DialogPanel, TransitionRoot, TransitionChild,
  Combobox, ComboboxInput, ComboboxOptions, ComboboxOption,
} from '@headlessui/vue'
import { HiSearch } from 'vue-icons-plus/hi'
import type { Component } from 'vue'
import { navGroups } from '../config/navigation'
import { useUiStore } from '../stores/ui'

interface PaletteEntry {
  key: string
  label: string
  icon?: Component | string
  run: () => void
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()
const router = useRouter()
const ui = useUiStore()
const query = ref('')

function close() { emit('update:open', false) }

const navEntries = computed<PaletteEntry[]>(() =>
  navGroups.flatMap(g => g.items).map(item => ({
    key: 'nav:' + item.name,
    label: t(item.labelKey),
    icon: item.icon,
    run: () => router.push(item.path),
  })),
)

const actionEntries = computed<PaletteEntry[]>(() => [
  { key: 'act:theme', label: t('palette.action.toggleTheme'), run: () => ui.toggleTheme() },
  { key: 'act:lang', label: t('palette.action.toggleLang'), run: () => {
      const next = locale.value === 'vi' ? 'en' : 'vi'
      locale.value = next
      localStorage.setItem('workspace.lang', next)
    } },
])

function match(label: string): boolean {
  return label.toLowerCase().includes(query.value.trim().toLowerCase())
}

const filteredNav = computed(() => navEntries.value.filter(e => match(e.label)))
const filteredActions = computed(() => actionEntries.value.filter(e => match(e.label)))

function onSelect(entry: PaletteEntry | null) {
  if (!entry) return
  entry.run()
  close()
}
</script>
