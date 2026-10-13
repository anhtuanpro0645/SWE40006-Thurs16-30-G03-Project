<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  code: { type: String, required: true },
});

const stats = ref(null);
const notFound = ref(false);
const error = ref('');

const shortUrl = computed(() => `${window.location.origin}/${props.code}`);

// Longest bar = 100% width, the others are scaled to it
const maxPerDay = computed(() => Math.max(1, ...(stats.value?.clicksPerDay ?? []).map((d) => d.clicks)));

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

onMounted(async () => {
  try {
    const res = await fetch(`/api/links/${encodeURIComponent(props.code)}/stats`);
    if (res.status === 404) {
      notFound.value = true;
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stats.value = await res.json();
  } catch {
    error.value = 'Could not load the statistics. Please try again.';
  }
});
</script>

<template>
  <section class="stats">
    <p>
      <a href="/">&larr; Shorten another link</a>
    </p>

    <p
      v-if="notFound"
      class="card error"
      data-testid="stats-not-found"
    >
      No short link with the code {{ code }} exists.
    </p>
    <p
      v-else-if="error"
      class="card error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="!stats"
      class="card"
    >
      Loading statistics...
    </p>

    <template v-else>
      <div class="card">
        <span class="label">Short link</span>
        <a
          :href="shortUrl"
          class="short-link"
        >{{ shortUrl }}</a>
        <p class="original">
          Goes to {{ stats.originalUrl }}
        </p>
        <p class="original">
          Created {{ formatDate(stats.createdAt) }}
        </p>
      </div>

      <div class="card total">
        <span class="label">Total clicks</span>
        <span
          class="big-number"
          data-testid="stats-total"
        >{{ stats.totalClicks }}</span>
      </div>

      <div class="card">
        <span class="label">Clicks per day (last 30 days, UTC)</span>
        <p
          v-if="stats.clicksPerDay.length === 0"
          class="empty"
        >
          No clicks yet.
        </p>
        <ul
          v-else
          class="bars"
          data-testid="stats-days"
        >
          <li
            v-for="day in stats.clicksPerDay"
            :key="day.date"
          >
            <span class="bar-label">{{ day.date }}</span>
            <span class="bar-track">
              <span
                class="bar"
                :style="{ width: `${(day.clicks / maxPerDay) * 100}%` }"
              />
            </span>
            <span class="bar-value">{{ day.clicks }}</span>
          </li>
        </ul>
      </div>

      <div class="two-col">
        <div class="card">
          <span class="label">Top referrers</span>
          <p
            v-if="stats.topReferrers.length === 0"
            class="empty"
          >
            No clicks yet.
          </p>
          <ol
            v-else
            class="top-list"
            data-testid="stats-referrers"
          >
            <li
              v-for="item in stats.topReferrers"
              :key="item.name"
            >
              <span>{{ item.name }}</span><span>{{ item.clicks }}</span>
            </li>
          </ol>
        </div>

        <div class="card">
          <span class="label">Top browsers</span>
          <p
            v-if="stats.topBrowsers.length === 0"
            class="empty"
          >
            No clicks yet.
          </p>
          <ol
            v-else
            class="top-list"
            data-testid="stats-browsers"
          >
            <li
              v-for="item in stats.topBrowsers"
              :key="item.name"
            >
              <span>{{ item.name }}</span><span>{{ item.clicks }}</span>
            </li>
          </ol>
        </div>
      </div>
    </template>
  </section>
</template>