<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { HiOutlineChartBar } from 'vue-icons-plus/hi';
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
  <div class="flex flex-col gap-4 p-4">
    <div class="flex items-center gap-2 text-cyber-cyan text-sm font-mono mb-2">
      <HiOutlineChartBar class="w-4 h-4" />
      <span>{{ t('usage.header') }}</span>
    </div>

    <div v-if="loading" class="text-cyber-muted text-xs font-mono">⟳ {{ t('chat.loading') }}</div>

    <div v-else-if="error" class="text-red-500 text-xs font-mono">{{ error }}</div>

    <template v-else>
      <div v-if="total && total.requestCount > 0" class="border border-cyber-code-border rounded p-3">
        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <span class="text-cyber-muted font-mono">{{ t('usage.total_prompt') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.promptTokens) }}</span>
          <span class="text-cyber-muted font-mono">{{ t('usage.total_completion') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.completionTokens) }}</span>
          <span class="border-t border-cyber-code-border pt-1 text-cyber-muted font-mono">{{ t('usage.total_all') }}:</span>
          <span class="border-t border-cyber-code-border pt-1 text-cyber-cyan text-right font-mono">{{ formatNum(total.totalTokens) }}</span>
          <span class="text-cyber-muted font-mono">{{ t('usage.total_requests') }}:</span>
          <span class="text-cyber-text text-right font-mono">{{ formatNum(total.requestCount) }}</span>
        </div>
      </div>

      <div v-else class="text-cyber-muted text-xs font-mono border border-cyber-code-border rounded p-3">
        {{ t('usage.empty') }}
      </div>

      <div v-if="sessions.length > 0" class="border border-cyber-code-border rounded">
        <div class="text-cyber-muted text-xs font-mono px-3 py-2 border-b border-cyber-code-border">
          {{ t('usage.per_session') }}
        </div>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-cyber-muted border-b border-cyber-code-border">
              <th class="text-left px-3 py-1.5 font-mono">{{ t('usage.session') }}</th>
              <th class="text-left px-3 py-1.5 font-mono">{{ t('usage.model') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.prompt') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.completion') }}</th>
              <th class="text-right px-3 py-1.5 font-mono">{{ t('usage.total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.sessionId" class="border-b border-cyber-code-border last:border-b-0 hover:bg-cyber-row">
              <td class="px-3 py-1.5 text-cyber-text font-mono truncate max-w-[120px]">{{ s.sessionTitle }}</td>
              <td class="px-3 py-1.5 text-cyber-muted font-mono">{{ s.modelName }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-text">{{ formatNum(s.promptTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-text">{{ formatNum(s.completionTokens) }}</td>
              <td class="px-3 py-1.5 text-right font-mono text-cyber-cyan">{{ formatNum(s.totalTokens) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
