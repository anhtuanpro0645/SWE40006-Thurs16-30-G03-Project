<script setup>
import { onMounted, ref } from 'vue';

// Shows whether the API and database are reachable. This proves the whole
// chain works: browser -> Nginx -> Express -> PostgreSQL.
const apiStatus = ref('checking');

onMounted(async () => {
  try {
    const res = await fetch('/health');
    const body = await res.json();
    apiStatus.value = res.ok && body.db === 'ok' ? 'ok' : 'down';
  } catch {
    apiStatus.value = 'down';
  }
});
</script>

<template>
  <main class="page">
    <header>
      <h1>G03 Link Shortener</h1>
      <p class="tagline">
        Paste a long link, get a short one.
      </p>
    </header>

    <section class="card">
      <p>Link shortening is coming soon.</p>
    </section>

    <p
      class="status"
      :class="apiStatus"
      data-testid="api-status"
    >
      <span
        class="dot"
        aria-hidden="true"
      />
      <span v-if="apiStatus === 'checking'">Checking API...</span>
      <span v-else-if="apiStatus === 'ok'">API and database are up</span>
      <span v-else>API or database is unreachable</span>
    </p>
  </main>
</template>
