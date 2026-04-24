import qrcode from 'qrcode';
import chalk from 'chalk';
import { setFeishuCredentials } from '../config/settings.js';

const ACCOUNTS_URLS: Record<string, string> = {
  feishu: 'https://accounts.feishu.cn/open-apis/authen/v1/sdk_register',
  lark: 'https://accounts.larksuite.com/open-apis/authen/v1/sdk_register',
};

interface BeginResult {
  device_code: string;
  qr_url: string;
  user_code: string;
  interval: number;
  expire_in: number;
}

interface RegisterResult {
  app_id: string;
  app_secret: string;
  domain: string;
  open_id?: string;
}

async function postRegistration(baseUrl: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function initRegistration(domain: string): Promise<void> {
  const baseUrl = ACCOUNTS_URLS[domain] || ACCOUNTS_URLS.feishu;
  const res = await postRegistration(baseUrl, { action: 'init' });
  const methods = (res.supported_auth_methods as string[]) || [];

  if (!methods.includes('client_secret')) {
    throw new Error(`Feishu registration environment does not support client_secret auth. Supported: ${methods.join(', ')}`);
  }
}

async function beginRegistration(domain: string): Promise<BeginResult> {
  const baseUrl = ACCOUNTS_URLS[domain] || ACCOUNTS_URLS.feishu;
  const res = await postRegistration(baseUrl, {
    action: 'begin',
    archetype: 'PersonalAgent',
    auth_method: 'client_secret',
    request_user_info: 'open_id',
  });

  const deviceCode = res.device_code as string;
  if (!deviceCode) {
    throw new Error('Feishu registration did not return a device_code');
  }

  let qrUrl = (res.verification_uri_complete as string) || '';
  if (qrUrl.includes('?')) {
    qrUrl += '&from=feishu-agent&tp=feishu-agent';
  } else {
    qrUrl += '?from=feishu-agent&tp=feishu-agent';
  }

  return {
    device_code: deviceCode,
    qr_url: qrUrl,
    user_code: (res.user_code as string) || '',
    interval: (res.interval as number) || 5,
    expire_in: (res.expire_in as number) || 600,
  };
}

async function pollRegistration(
  deviceCode: string,
  interval: number,
  expireIn: number,
  domain: string,
  onWaiting: () => void
): Promise<RegisterResult | null> {
  const deadline = Date.now() + expireIn * 1000;
  let currentDomain = domain;
  let pollCount = 0;

  while (Date.now() < deadline) {
    const baseUrl = ACCOUNTS_URLS[currentDomain] || ACCOUNTS_URLS.feishu;

    try {
      const res = await postRegistration(baseUrl, {
        action: 'poll',
        device_code: deviceCode,
        tp: 'ob_app',
      });

      pollCount++;
      if (pollCount === 1 || pollCount % 6 === 0) {
        onWaiting();
      }

      // Domain auto-detection
      const userInfo = (res.user_info as Record<string, unknown>) || {};
      const tenantBrand = userInfo.tenant_brand as string;
      if (tenantBrand === 'lark' && currentDomain !== 'lark') {
        currentDomain = 'lark';
      }

      // Success
      if (res.client_id && res.client_secret) {
        return {
          app_id: res.client_id as string,
          app_secret: res.client_secret as string,
          domain: currentDomain,
          open_id: userInfo.open_id as string,
        };
      }

      // Terminal errors
      const error = res.error as string;
      if (error === 'access_denied') {
        console.log('\n❌ Registration denied by user.');
        return null;
      }
      if (error === 'expired_token') {
        console.log('\n❌ QR code expired. Please try again.');
        return null;
      }
    } catch {
      // Network error, retry
    }

    await new Promise(resolve => setTimeout(resolve, interval * 1000));
  }

  console.log('\n❌ Registration timed out.');
  return null;
}

async function renderQrTerminal(url: string): Promise<boolean> {
  try {
    const qrString = await qrcode.toString(url, {
      type: 'terminal',
      small: true,
    });
    console.log(qrString);
    return true;
  } catch {
    return false;
  }
}

export async function qrRegisterFeishu(
  domain: string = 'feishu',
  timeoutSeconds: number = 300
): Promise<RegisterResult | null> {
  console.log('\n📱 Feishu / Lark Bot Registration');
  console.log('-'.repeat(40));

  try {
    process.stdout.write('  Connecting to Feishu / Lark...');
    await initRegistration(domain);
    const begin = await beginRegistration(domain);
    console.log(' done.\n');

    const qrUrl = begin.qr_url;
    const rendered = await renderQrTerminal(qrUrl);

    if (rendered) {
      console.log(`\n  Scan the QR code above, or open this URL:\n  ${qrUrl}`);
    } else {
      console.log(`  Open this URL in Feishu / Lark on your phone:\n\n  ${qrUrl}\n`);
    }
    console.log();

    const result = await pollRegistration(
      begin.device_code,
      begin.interval,
      Math.min(begin.expire_in, timeoutSeconds),
      domain,
      () => process.stdout.write('.')
    );

    if (result) {
      console.log(`\n✅ Bot created successfully!`);
      console.log(`   App ID: ${result.app_id}`);
      console.log(`   Domain: ${result.domain}`);
    }

    return result;
  } catch (error) {
    console.log(`\n❌ Registration failed: ${error}`);
    return null;
  }
}

export async function setupFeishuWithQR(): Promise<boolean> {
  const result = await qrRegisterFeishu();

  if (result) {
    setFeishuCredentials(result.app_id, result.app_secret);
    console.log(chalk.green('✓ Feishu credentials saved to .env'));
    return true;
  }

  return false;
}
