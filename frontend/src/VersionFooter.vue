<script setup>
// GIT_SHA and BUILD_TIME are passed to the Docker build by CI (see
// frontend/Dockerfile). Local builds without them show "dev".
const sha = import.meta.env.VITE_GIT_SHA || 'dev';
const buildTime = new Date(import.meta.env.VITE_BUILD_TIME || '');

const label = sha === 'dev' ? 'dev build' : `v${sha.slice(0, 7)}`;
const builtAt = Number.isNaN(buildTime.getTime()) ? '' : buildTime.toLocaleString();
</script>

<template>
  <footer
    class="version"
    data-testid="version-footer"
  >
    <span
      data-testid="version-sha"
      :title="sha"
    >{{ label }}</span>
    <span v-if="builtAt">, built {{ builtAt }}</span>
  </footer>
</template>