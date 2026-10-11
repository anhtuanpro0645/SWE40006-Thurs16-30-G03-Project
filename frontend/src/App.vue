<script setup>
import { onMounted, ref } from 'vue';

const longUrl = ref('');
const loading = ref(false);
const error = ref('');
const result = ref(null);
const copied = ref(false);

// The Clipboard API only works on HTTPS or localhost
const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard && window.isSecureContext;

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

async function shorten() {
  error.value = '';
  result.value = null;
  copied.value = false;
  loading.value = true;
  try {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = body.error || `Something went wrong (HTTP ${res.status})`;
      return;
    }
    result.value = body;
  } catch {
    error.value = 'Could not reach the server. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function copyShortUrl() {
  try {
    await navigator.clipboard.writeText(result.value.shortUrl);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <main class="page">
    <header>
      <h1>G03 Link Shortener</h1>
      <p class="tagline">
        Paste a long link, get a short one.
      </p>
    </header>

    <form
      class="card shorten-form"
      novalidate
      @submit.prevent="shorten"
    >
      <label for="long-url">Long URL</label>
      <div class="row">
        <input
          id="long-url"
          v-model="longUrl"
          type="url"
          placeholder="https://example.com/a/very/long/link"
          autocomplete="off"
          required
          data-testid="url-input"
        >
        <button
          type="submit"
          :disabled="loading || !longUrl.trim()"
          data-testid="shorten-button"
        >
          {{ loading ? 'Shortening...' : 'Shorten' }}
        </button>
      </div>

      <p
        v-if="error"
        class="error"
        role="alert"
        data-testid="error-message"
      >
        {{ error }}
      </p>

      <div
        v-if="result"
        class="result"
        data-testid="result"
      >
        <span class="label">Your short link</span>
        <div class="row">
          <a
            :href="result.shortUrl"
            target="_blank"
            rel="noopener"
            data-testid="short-url"
          >{{ result.shortUrl }}</a>
          <button
            v-if="canCopy"
            type="button"
            class="secondary"
            @click="copyShortUrl"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p
          class="original"
          :title="result.originalUrl"
        >
          Goes to {{ result.originalUrl }}
        </p>
      </div>
    </form>

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
