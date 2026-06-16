import { Key } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.jwt-signature-checker.title'),
  path: '/jwt-signature-checker',
  description: translate('tools.jwt-signature-checker.description'),
  keywords: [
    'jwt',
    'signature',
    'verify',
    'checker',
    'hmac',
    'hs256',
    'hs384',
    'hs512',
    'rsa',
    'public key',
    'token',
    'validate',
  ],
  component: () => import('./jwt-signature-checker.vue'),
  icon: Key,
});
