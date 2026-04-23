import { prisma } from './prisma';

const DEFAULTS: Record<string, string> = {
  call_timeout_minutes: '3',
  call_mode: 'broadcast', // broadcast | sequential
  call_retry_on_timeout: 'false',
  call_max_partners: '0', // 0 = unlimited
};

export async function getConfig(key: string): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? '';
}

export async function getCallConfig(): Promise<{
  timeoutMs: number;
  mode: 'broadcast' | 'sequential';
  retryOnTimeout: boolean;
  maxPartners: number;
}> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });

  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;

  return {
    timeoutMs: Number(map.call_timeout_minutes) * 60 * 1000,
    mode: map.call_mode as 'broadcast' | 'sequential',
    retryOnTimeout: map.call_retry_on_timeout === 'true',
    maxPartners: Number(map.call_max_partners),
  };
}
