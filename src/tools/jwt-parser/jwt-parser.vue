<script setup lang="ts">
import type { lib } from 'crypto-js';
import { HmacSHA256, HmacSHA384, HmacSHA512, enc } from 'crypto-js';
import { decodeJwt } from './jwt-parser.service';
import { useValidation } from '@/composable/validation';
import { isNotThrowing } from '@/utils/boolean';
import { withDefaultOnError } from '@/utils/defaults';
import { useCopy } from '@/composable/copy';

const rawJwt = ref(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
);

const showSignatureChecker = ref(false);
const secret = ref('your-256-bit-secret');
const keyType = ref<'hmac' | 'rsa' | 'ec'>('hmac');
const hmacAlgorithm = ref<'HS256' | 'HS384' | 'HS512'>('HS256');

const decodedJWT = computed(() =>
  withDefaultOnError(() => decodeJwt({ jwt: rawJwt.value }), { header: [], payload: [] }),
);

const sections = [
  { key: 'header', title: 'Header' },
  { key: 'payload', title: 'Payload' },
] as const;

const jwtValidation = useValidation({
  source: rawJwt,
  rules: [
    {
      validator: value => value.length > 0 && isNotThrowing(() => decodeJwt({ jwt: rawJwt.value })),
      message: 'Invalid JWT',
    },
  ],
});

const parsedHeader = computed(() => {
  try {
    const parts = rawJwt.value.split('.');
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(atob(parts[0]));
  }
  catch {
    return null;
  }
});

const detectedAlgorithm = computed(() => parsedHeader.value?.alg ?? null);

const _isHmacAlgo = computed(() => ['HS256', 'HS384', 'HS512'].includes(detectedAlgorithm.value ?? ''));

const signatureResult = computed(() => {
  if (!showSignatureChecker.value || !jwtValidation.isValid) {
    return null;
  }
  return withDefaultOnError(() => verifySignature(), null);
});

const keyValidation = useValidation({
  source: secret,
  rules: [
    {
      validator: value => value.length > 0,
      message: 'Key must not be empty',
    },
  ],
});

function verifySignature(): { valid: boolean; expectedSignature: string } {
  const parts = rawJwt.value.split('.');
  const signingInput = `${parts[0]}.${parts[1]}`;

  if (keyType.value === 'hmac') {
    const algoMap: Record<string, (msg: string, key: string) => lib.WordArray> = {
      HS256: HmacSHA256,
      HS384: HmacSHA384,
      HS512: HmacSHA512,
    };
    const hashFn = algoMap[hmacAlgorithm.value];
    const result = hashFn(signingInput, secret.value);
    return {
      valid: result.toString(enc.Base64url) === parts[2],
      expectedSignature: result.toString(enc.Base64url),
    };
  }

  return { valid: false, expectedSignature: `${keyType.value} verification not yet implemented` };
}

const { copy: _copySecret } = useCopy({ source: secret });
</script>

<template>
  <div flex flex-col gap-4>
    <c-card>
      <c-input-text v-model:value="rawJwt" label="JWT to decode" :validation="jwtValidation" placeholder="Put your token here..." rows="5" multiline raw-text autofocus mb-3 />

      <n-table v-if="jwtValidation.isValid">
        <tbody>
          <template v-for="section of sections" :key="section.key">
            <th colspan="2" class="table-header">
              {{ section.title }}
            </th>
            <tr v-for="{ claim, claimDescription, friendlyValue, value } in decodedJWT[section.key]" :key="claim + value">
              <td class="claims" style="vertical-align: top;">
                <span font-bold>
                  {{ claim }}
                </span>
                <span v-if="claimDescription" ml-2 op-70>
                  ({{ claimDescription }})
                </span>
              </td>
              <td style="word-wrap: break-word;word-break: break-all;">
                <span>{{ value }}</span>
                <span v-if="friendlyValue" ml-2 op-70>
                  ({{ friendlyValue }})
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </n-table>
    </c-card>

    <c-card v-if="jwtValidation.isValid">
      <div mb-3 flex items-center justify-between>
        <span text-lg font-bold>Signature verification</span>
        <n-switch v-model:value="showSignatureChecker" size="small" />
      </div>

      <template v-if="showSignatureChecker">
        <c-select
          v-model:value="keyType"
          label="Key type"
          placeholder="Select key type..."
          :options="[
            { label: 'HMAC (shared secret)', value: 'hmac' },
            { label: 'RSA (public key)', value: 'rsa' },
            { label: 'EC (public key)', value: 'ec' },
          ]"
          mb-3
        />

        <c-select
          v-if="keyType === 'hmac'"
          v-model:value="hmacAlgorithm"
          label="HMAC algorithm"
          placeholder="Select algorithm..."
          :options="[
            { label: 'HS256', value: 'HS256' },
            { label: 'HS384', value: 'HS384' },
            { label: 'HS512', value: 'HS512' },
          ]"
          mb-3
        />

        <c-input-text
          v-model:value="secret"
          :label="keyType === 'hmac' ? 'Shared secret' : 'Public key (PEM)'"
          :validation="keyValidation"
          :placeholder="keyType === 'hmac' ? 'Enter your shared secret...' : '-----BEGIN PUBLIC KEY-----\n...'"
          :rows="keyType === 'hmac' ? 1 : 5"
          :multiline="keyType !== 'hmac'"
          raw-text
          clearable
          mb-3
        />

        <div v-if="keyValidation.isValid && signatureResult" flex flex-col gap-3>
          <n-card :bordered="false" :class="signatureResult.valid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
            <div flex items-center gap-2>
              <n-icon v-if="signatureResult.valid" size="24" color="#22c55e">
                <IconCheck />
              </n-icon>
              <n-icon v-else size="24" color="#ef4444">
                <IconX />
              </n-icon>
              <span text-lg font-bold :class="signatureResult.valid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                {{ signatureResult.valid ? 'Signature is valid' : 'Signature is invalid' }}
              </span>
            </div>
          </n-card>

          <div v-if="detectedAlgorithm" text-sm op-70>
            Detected algorithm: <code font-bold>{{ detectedAlgorithm }}</code>
            <span v-if="keyType === 'hmac' && detectedAlgorithm !== hmacAlgorithm" ml-1 text-red-500>
              (mismatch with selected {{ hmacAlgorithm }})
            </span>
          </div>
        </div>
      </template>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.table-header {
  text-align: center;
}
</style>
