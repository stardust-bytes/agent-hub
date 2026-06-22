<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getUsage, getUsageSessions } from '../api/usage';
import type { UsageTotal, SessionUsage } from '../api/usage';

const { t } = useI18n();

const total = ref<UsageTotal | null>(null);
const sessions = ref<SessionUsage[]>([]);
const loading = ref(true);
const error = ref('');

function formatNum(n: number): string {
  return n.toLocaleString('vi-VN');
}

async function fetchData() {
  loading.value = true;
  error.value = '';
  try {
    const [totalData, sessionsData] = await Promise.all([
      getUsage(),
      getUsageSessions(),
    ]);
    total.value = totalData;
    sessions.value = sessionsData;
  } catch {
    error.value = t('chat.error.unreachable');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="flex-1 flex flex-col bg-background overflow-hidden">
    <div class="flex-1 overflow-y-auto mx-auto max-w-5xl px-6 py-6 w-full space-y-4">
    <div v-if="loading" class="text-muted-foreground text-sm font-sans">⟳ {{ t('chat.loading') }}</div>

    <div v-else-if="error" class="text-danger text-sm font-sans">{{ error }}</div>

    <template v-else>
      <div v-if="total && total.requestCount > 0" class="border border-border rounded-lg p-3 bg-surface">
        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <span class="text-muted-foreground font-sans">{{ t('usage.total_prompt') }}:</span>
          <span class="text-foreground text-right font-sans">{{ formatNum(total.promptTokens) }}</span>
          <span class="text-muted-foreground font-sans">{{ t('usage.total_completion') }}:</span>
          <span class="text-foreground text-right font-sans">{{ formatNum(total.completionTokens) }}</span>
          <span class="border-t border-border pt-1 text-muted-foreground font-sans">{{ t('usage.total_all') }}:</span>
          <span class="border-t border-border pt-1 text-primary text-right font-sans">{{ formatNum(total.totalTokens) }}</span>
          <span class="text-muted-foreground font-sans">{{ t('usage.total_requests') }}:</span>
          <span class="text-foreground text-right font-sans">{{ formatNum(total.requestCount) }}</span>
        </div>
      </div>

      <div v-else class="text-muted-foreground text-sm font-sans border border-border rounded-lg p-3 bg-surface">
        {{ t('usage.empty') }}
      </div>

      <div v-if="sessions.length > 0" class="border border-border rounded-lg overflow-hidden bg-surface">
        <div class="text-muted-foreground text-sm font-sans px-3 py-2 border-b border-border">
          {{ t('usage.per_session') }}
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-muted-foreground border-b border-border">
              <th class="text-left px-3 py-1.5 font-sans">{{ t('usage.session') }}</th>
              <th class="text-left px-3 py-1.5 font-sans">{{ t('usage.model') }}</th>
              <th class="text-right px-3 py-1.5 font-sans">{{ t('usage.prompt') }}</th>
              <th class="text-right px-3 py-1.5 font-sans">{{ t('usage.completion') }}</th>
              <th class="text-right px-3 py-1.5 font-sans">{{ t('usage.total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.sessionId" class="border-b border-border last:border-b-0 hover:bg-muted">
              <td class="px-3 py-1.5 text-foreground font-sans truncate max-w-[120px]">{{ s.sessionTitle }}</td>
              <td class="px-3 py-1.5 text-muted-foreground font-sans">{{ s.modelName }}</td>
              <td class="px-3 py-1.5 text-right font-sans text-foreground">{{ formatNum(s.promptTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-sans text-foreground">{{ formatNum(s.completionTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-sans text-primary">{{ formatNum(s.totalTokens) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    </div>
  </div>
</template>

