<script setup lang="ts">
import type { lib } from 'crypto-js';
import { HmacSHA256, HmacSHA384, HmacSHA512, enc } from 'crypto-js';
import * as forge from 'node-forge';
import { useValidation } from '@/composable/validation';
import { isNotThrowing } from '@/utils/boolean';
import { withDefaultOnError } from '@/utils/defaults';
import { useCopy } from '@/composable/copy';

const rawJwt = ref(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
);

const secret = ref('your-256-bit-secret');
const keyType = ref<'hmac' | 'rsa' | 'ec'>('hmac');
const hmacAlgorithm = ref<'HS256' | 'HS384' | 'HS512'>('HS256');

const parsedHeader = computed(() => {
  try {
    const parts = rawJwt.value.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[0]));
  } catch {
    return null;
  }
});

const detectedAlgorithm = computed(() => parsedHeader.value?.alg ?? null);

const signatureResult = computed(() =>
  withDefaultOnError(() => verifySignature(), null),
);

const validation = useValidation({
  source: rawJwt,
  rules: [
    {
      validator: value => {
        const parts = value.split('.');
        return parts.length === 3 && parts.every(p => p.length > 0);
      },
      message: 'JWT must have exactly 3 parts (header.payload.signature)',
    },
    {
      validator: value => {
        const parts = value.split('.');
        return parts.every(p => {
          try {
            atob(p);
            return true;
          } catch {
            return false;
          }
        });
      },
      message: 'JWT parts must be valid base64url-encoded strings',
    },
  ],
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

function verifySignature(): { valid: boolean; expectedSignature: string; actualSignature: string } {
  const parts = rawJwt.value.split('.');
  const signingInput = `${parts[0]}.${parts[1]}`;
  const actualSignature = parts[2];

  let expectedSignature: string;

  if (keyType.value === 'hmac') {
    const algoMap = {
      HS256: HmacSHA256,
      HS384: HmacSHA384,
      HS512: HmacSHA512,
    };
    const hashFn = algoMap[hmacAlgorithm.value];
    const result: lib.WordArray = hashFn(signingInput, secret.value);
    expectedSignature = result.toString(enc.Base64url);
  } else if (keyType.value === 'rsa') {
    const publicKey = forge.pki.publicKeyFromPem(secret.value);
    const md = forge.md.sha256.create();
    md.update(signingInput, 'utf8');
    const signatureBytes = forge.util.decode64(actualSignature.replace(/-/g, '+').replace(/_/g, '/'));
    expectedSignature = publicKey.sign(md) ? 'verified' : 'failed';
    return {
      valid: publicKey.verify(md, forge.util.decode64(actualSignature.replace(/-/g, '+').replace(/_/g, '/'))),
      expectedSignature: 'N/A (RSA signature verification)',
      actualSignature,
    };
  } else {
    return {
      valid: false,
      expectedSignature: 'EC not yet implemented',
      actualSignature,
    };
  }

  return {
    valid: expectedSignature === actualSignature,
    expectedSignature,
    actualSignature,
  };
}

const { copy: copySecret } = useCopy({ source: secret });
</script>

<template>
  <div flex flex-col gap-4>
    <c-input-text
      v-model:value="rawJwt"
      label="JWT token"
      :validation="validation"
      placeholder="Paste your JWT token here..."
      rows="3"
      multiline
      raw-text
      autofocus
    />

    <c-select
      v-model:value="keyType"
      label="Key type"
      placeholder="Select key type..."
      :options="[
        { label: 'HMAC (shared secret)', value: 'hmac' },
        { label: 'RSA (public key)', value: 'rsa' },
        { label: 'EC (public key)', value: 'ec' },
      ]"
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
    />

    <div v-if="validation.isValid && keyValidation.isValid && signatureResult" flex flex-col gap-3>
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

      <div v-if="detectedAlgorithm" op-70 text-sm>
        Detected algorithm from token header: <code font-bold>{{ detectedAlgorithm }}</code>
        <span v-if="keyType === 'hmac' && detectedAlgorithm !== hmacAlgorithm" text-red-500>
          (mismatch with selected {{ hmacAlgorithm }})
        </span>
      </div>
    </div>
  </div>
</template>
