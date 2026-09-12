<script setup lang="ts">
defineProps<{
  title: string;
  code: string;
}>();
</script>

<template>
  <details class="fold">
    <summary>{{ title }}</summary>
    <pre><code>{{ code }}</code></pre>
  </details>
</template>

<style scoped>
.fold {
  margin: 0 0 16px;
  border: 1px solid var(--line);
}

summary {
  padding: 8px 10px;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: "▸ ";
  color: var(--muted);
}

.fold[open] summary::before {
  content: "▾ ";
}

pre {
  margin: 0;
  max-height: 360px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--line);
  background: #f7f7f7;
  overflow: auto;
}

code {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text);
  white-space: pre;
}
</style>
