import client from 'prom-client';

// Prometheus metrics for the API. Prometheus (issue #8) scrapes GET /metrics
// on the internal Docker network; Nginx blocks it from the public.
export const register = new client.Registry();

// Node.js process metrics: CPU, memory, event loop lag, and so on
client.collectDefaultMetrics({ register });

const LABELS = ['method', 'route', 'status'];

const requestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Number of HTTP requests handled by the API',
  labelNames: LABELS,
  registers: [register],
});

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Time taken to handle HTTP requests, in seconds',
  labelNames: LABELS,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// Express resets req.baseUrl when an error leaves a mounted router, which
// happens before "finish" fires. Put this in front of each mounted router so
// the mount path (e.g. "/api/links") is remembered for the route label.
export function rememberMountPath(req, res, next) {
  res.locals.mountPath = req.baseUrl;
  next();
}

// The route pattern, e.g. "/:code" rather than "/aB3x9Kq". Using the real
// path would create a new time series for every short link.
export function routeLabel(req, mountPath = req.baseUrl) {
  if (!req.route) return 'unmatched';
  const path = `${mountPath}${req.route.path}`;
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

// Times every request and counts it once the response has been sent
export function metricsMiddleware(req, res, next) {
  const stopTimer = requestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req, res.locals.mountPath),
      status: String(res.statusCode),
    };
    if (labels.route === '/metrics') return; // ignore Prometheus's own scrapes
    stopTimer(labels);
    requestsTotal.inc(labels);
  });
  next();
}

// GET /metrics in the Prometheus text format
export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}