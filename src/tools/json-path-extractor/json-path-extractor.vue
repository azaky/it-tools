<script setup lang="ts">
import JSON5 from 'json5';
import { Plus, Trash } from '@vicons/tabler';
import { useStorage } from '@vueuse/core';
import { useValidation } from '@/composable/validation';

const rawJson = useStorage('json-path-extractor:input', '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}], "meta": {"count": 2}}');
const outputs = ref<{ id: number; path: string }[]>([{ id: 1, path: '' }]);
let nextId = 2;

const parsedJson = computed(() => {
  try {
    return JSON5.parse(rawJson.value);
  }
  catch {
    return null;
  }
});

const rawJsonValidation = useValidation({
  source: rawJson,
  rules: [
    {
      validator: (v: string) => v === '' || JSON5.parse(v),
      message: 'Provided JSON is not valid.',
    },
  ],
});

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) {
    return obj;
  }
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
    }
    else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    }
    else {
      return undefined;
    }
  }
  return current;
}

function getNextKeys(obj: unknown, currentInput: string): { key: string; fullPath: string; isObject: boolean }[] {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  let target: unknown = obj;
  let partial = currentInput;

  if (currentInput.includes('.')) {
    const lastDot = currentInput.lastIndexOf('.');
    const parentPath = currentInput.slice(0, lastDot);
    partial = currentInput.slice(lastDot + 1);
    target = getNestedValue(obj, parentPath);
  }

  if (!target || typeof target !== 'object') {
    return [];
  }

  const keys = Array.isArray(target)
    ? target.map((_, i) => String(i))
    : Object.keys(target);

  return keys
    .filter(key => key.startsWith(partial) && key !== partial)
    .map((key) => {
      const val = Array.isArray(target) ? (target as unknown[])[Number(key)] : (target as Record<string, unknown>)[key];
      return {
        key,
        fullPath: currentInput.includes('.')
          ? currentInput.slice(0, currentInput.lastIndexOf('.') + 1) + key
          : key,
        isObject: val !== null && typeof val === 'object',
      };
    });
}

function formatInput() {
  if (!rawJson.value.trim()) {
    return;
  }
  try {
    const parsed = JSON5.parse(rawJson.value);
    rawJson.value = JSON.stringify(parsed, null, 2);
  }
  catch { /* noop */ }
}

function minifyInput() {
  if (!rawJson.value.trim()) {
    return;
  }
  try {
    const parsed = JSON5.parse(rawJson.value);
    rawJson.value = JSON.stringify(parsed);
  }
  catch { /* noop */ }
}

function addOutput() {
  outputs.value.push({ id: nextId++, path: '' });
}

function removeOutput(id: number) {
  if (outputs.value.length > 1) {
    outputs.value = outputs.value.filter(o => o.id !== id);
  }
}

function getOutputValue(path: string): string {
  if (!parsedJson.value) {
    return '';
  }
  const value = getNestedValue(parsedJson.value, path);
  if (value === undefined) {
    return '// Path not found';
  }
  return JSON.stringify(value, null, 2);
}

const focusedOutputId = ref<number | null>(null);
const activeIndex = ref(-1);

function getSuggestions(path: string) {
  if (!parsedJson.value) {
    return [];
  }
  return getNextKeys(parsedJson.value, path);
}

function selectSuggestion(output: { id: number; path: string }, suggestion: { fullPath: string; isObject: boolean }) {
  output.path = suggestion.isObject ? `${suggestion.fullPath}.` : suggestion.fullPath;
  activeIndex.value = -1;
  if (!suggestion.isObject) {
    focusedOutputId.value = null;
  }
}

function handlePathKeydown(e: KeyboardEvent, output: { id: number; path: string }) {
  const suggestions = getSuggestions(output.path);
  if (!suggestions.length) {
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, suggestions.length - 1);
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  }
  else if (e.key === 'Enter' || e.key === 'Tab') {
    if (activeIndex.value >= 0 && activeIndex.value < suggestions.length) {
      e.preventDefault();
      selectSuggestion(output, suggestions[activeIndex.value]);
    }
  }
  else if (e.key === 'Escape') {
    focusedOutputId.value = null;
  }
}

function handlePathFocus(id: number) {
  focusedOutputId.value = id;
  activeIndex.value = -1;
}

function handlePathBlur() {
  setTimeout(() => {
    focusedOutputId.value = null;
  }, 150);
}

watch(() => outputs.value.map(o => o.path), () => {
  activeIndex.value = -1;
}, { deep: true });
</script>

<template>
  <div>
    <div mb-3 flex gap-2>
      <c-button @click="formatInput()">
        Format
      </c-button>
      <c-button @click="minifyInput()">
        Minify
      </c-button>
    </div>

    <n-form-item
      label="Input JSON"
      :feedback="rawJsonValidation.message"
      :validation-status="rawJsonValidation.status"
    >
      <c-input-text
        v-model:value="rawJson"
        placeholder="Paste your JSON here..."
        rows="15"
        multiline
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        monospace
        raw-text
      />
    </n-form-item>

    <div mb-3 flex items-center justify-between>
      <n-h3 style="margin: 0">
        Outputs
      </n-h3>
      <c-button @click="addOutput()">
        <n-icon :component="Plus" mr-1 />
        Add path
      </c-button>
    </div>

    <div v-for="output in outputs" :key="output.id" mb-4>
      <c-card>
        <div mb-3 flex items-center gap-2>
          <div relative flex-1>
            <n-input
              v-model:value="output.path"
              placeholder="e.g. users.0.name"
              font-mono
              @focus="handlePathFocus(output.id)"
              @blur="handlePathBlur()"
              @keydown="(e: KeyboardEvent) => handlePathKeydown(e, output)"
            />
            <div
              v-if="focusedOutputId === output.id && getSuggestions(output.path).length > 0"
              class="suggestions-dropdown"
            >
              <div
                v-for="(suggestion, i) in getSuggestions(output.path)"
                :key="suggestion.fullPath"
                class="suggestion-item"
                :class="{ active: i === activeIndex }"
                @mousedown.prevent="selectSuggestion(output, suggestion)"
              >
                <span>{{ suggestion.key }}</span>
                <span v-if="suggestion.isObject" class="suggestion-arrow">›</span>
              </div>
            </div>
          </div>
          <c-button v-if="outputs.length > 1" @click="removeOutput(output.id)">
            <n-icon :component="Trash" />
          </c-button>
        </div>
        <textarea-copyable :value="getOutputValue(output.path)" language="json" />
      </c-card>
    </div>
  </div>
</template>

<style lang="less" scoped>
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--n-color, #fff);
  border: 1px solid var(--n-border, #e0e0e6);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 6px 12px;
  cursor: pointer;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover,
  &.active {
    background: var(--primary-color, #18a058);
    color: #fff;
  }
}

.suggestion-arrow {
  opacity: 0.6;
  margin-left: 8px;
}
</style>
