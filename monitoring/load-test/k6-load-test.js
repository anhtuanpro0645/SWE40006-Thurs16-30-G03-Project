import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL;
const LINKS = 5;

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

export function setup() {
  if (!BASE_URL) {
    throw new Error('Set BASE_URL, for example: -e BASE_URL=http://<server>');
  }
  const codes = [];
  for (let i = 0; i < LINKS; i++) {
    const res = http.post(
      `${BASE_URL}/api/links`,
      JSON.stringify({ url: `https://example.com/load-test-${i}` }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (res.status === 201) {
      codes.push(res.json('code'));
    }
  }
  if (codes.length === 0) {
    throw new Error('Could not create any short links (rate limited or server down?)');
  }
  return { codes };
}

export default function (data) {
  const code = data.codes[Math.floor(Math.random() * data.codes.length)];

  const res = http.get(`${BASE_URL}/${code}`, { redirects: 0 });
  check(res, { 'redirect (302)': (r) => r.status === 302 });

  if (Math.random() < 0.1) {
    http.get(`${BASE_URL}/health`);
  }

  sleep(0.2);
}
