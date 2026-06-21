<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-background">
    <div v-if="status === 'loading'" class="text-primary font-sans text-sm">
      {{ t('oauth.callback.loading') }}
    </div>
    <div v-else-if="status === 'success'" class="text-success font-sans text-sm">
      {{ t('oauth.callback.success') }}
    </div>
    <div v-else class="flex flex-col items-center gap-3">
      <div class="text-danger font-sans text-sm">{{ t('oauth.callback.error', { msg: errorMsg }) }}</div>
      <router-link v-if="showBackLink" to="/connectors"
        class="text-primary font-sans text-sm rounded-lg border border-primary/30 px-2.5 py-1 transition-colors duration-150 hover:bg-primary/10">
        {{ t('oauth.callback.back') }}
      </router-link>
      <button v-else @click="handleClose"
        class="text-muted-foreground font-sans text-sm rounded-lg border border-input px-2.5 py-1 transition-colors duration-150 hover:bg-muted hover:text-primary">
        {{ t('oauth.callback.close') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { confirmOAuth } from '../api/connectors'

const { t } = useI18n()
const route = useRoute()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMsg = ref('')
const showBackLink = ref(false)

onMounted(async () => {
  const state = route.query.state as string | undefined
  const code = route.query.code as string | undefined

  if (!state || !code) {
    status.value = 'error'
    errorMsg.value = t('oauth.callback.missing_params')
    showBackLink.value = !window.opener
    return
  }

  try {
    await confirmOAuth(state, code)
    status.value = 'success'
    if (window.opener) {
      window.opener.location.reload()
      setTimeout(() => window.close(), 500)
    } else {
      showBackLink.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : t('connectors.oauth_confirm_failed')
    showBackLink.value = !window.opener
  }
})

function handleClose() {
  if (window.opener) {
    window.close()
  } else {
    showBackLink.value = true
  }
}
</script>
