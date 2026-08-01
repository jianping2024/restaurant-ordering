import http from 'node:http';
import {
  SYSTEM_LOG_MAX_BYTES,
  demuxDockerLogStream,
} from '@/lib/system-logs/parse-log-text';

const DEFAULT_SOCK = '/var/run/docker.sock';
const DEFAULT_PROJECT = 'mesa-on-prem';
const DEFAULT_SERVICE = 'web';

function dockerSockPath(): string {
  return (process.env.MESA_DOCKER_SOCK || DEFAULT_SOCK).trim() || DEFAULT_SOCK;
}

function dockerRequest(path: string): Promise<{ status: number; body: Buffer }> {
  const socketPath = dockerSockPath();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path,
        method: 'GET',
        headers: { Host: 'docker' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total <= SYSTEM_LOG_MAX_BYTES) chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('docker_timeout'));
    });
    req.end();
  });
}

async function resolveWebContainerId(): Promise<string> {
  const explicit = (process.env.MESA_WEB_LOG_CONTAINER || '').trim();
  if (explicit) return explicit;

  const project = (process.env.MESA_COMPOSE_PROJECT || DEFAULT_PROJECT).trim() || DEFAULT_PROJECT;
  const service = (process.env.MESA_WEB_LOG_SERVICE || DEFAULT_SERVICE).trim() || DEFAULT_SERVICE;
  const filters = encodeURIComponent(
    JSON.stringify({
      label: [
        `com.docker.compose.project=${project}`,
        `com.docker.compose.service=${service}`,
      ],
    }),
  );
  const { status, body } = await dockerRequest(`/containers/json?filters=${filters}`);
  if (status !== 200) {
    throw new Error(`docker_list_failed:${status}`);
  }
  const list = JSON.parse(body.toString('utf8')) as Array<{ Id?: string }>;
  const id = list[0]?.Id;
  if (!id) throw new Error('docker_web_container_not_found');
  return id;
}

/** Read web container logs via Docker Engine API (json-file driver behind the daemon). */
export async function readWebDockerLogs(from: Date, to: Date): Promise<string> {
  const id = await resolveWebContainerId();
  const since = Math.floor(from.getTime() / 1000);
  const until = Math.ceil(to.getTime() / 1000);
  const path =
    `/containers/${encodeURIComponent(id)}/logs` +
    `?stdout=1&stderr=1&timestamps=1&since=${since}&until=${until}`;
  const { status, body } = await dockerRequest(path);
  if (status !== 200) {
    throw new Error(`docker_logs_failed:${status}`);
  }
  return demuxDockerLogStream(body);
}
