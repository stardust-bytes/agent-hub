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
  <div class="flex-1 flex flex-col bg-cyber-bg overflow-hidden">
    <div class="flex items-center gap-2 xl:pl-3 pl-10 px-3 h-[3rem] border-b border-cyber-code-border shrink-0 bg-cyber-dark">
      <HiOutlineChartBar class="w-3 h-3 text-cyber-accent" />
      <span class="text-sm text-cyber-accent font-mono">{{ t('usage.header') }}</span>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
    <div v-if="loading" class="text-cyber-muted text-sm font-mono">⟳ {{ t('chat.loading') }}</div>

    <div v-else-if="error" class="text-red-500 text-sm font-mono">{{ error }}</div>

    <template v-else>
      <div v-if="total && total.requestCount > 0" class="border border-cyber-code-border  p-3">
        <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
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

      <div v-else class="text-cyber-muted text-sm font-mono border border-cyber-code-border  p-3">
        {{ t('usage.empty') }}
      </div>

      <div v-if="sessions.length > 0" class="border border-cyber-code-border ">
        <div class="text-cyber-muted text-sm font-mono px-3 py-2 border-b border-cyber-code-border">
          {{ t('usage.per_session') }}
        </div>
        <table class="w-full text-sm">
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
  </div>
</template>

