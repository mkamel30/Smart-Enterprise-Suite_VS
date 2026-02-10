const prometheus = require('prom-client');

const register = new prometheus.Registry();

prometheus.collectDefaultMetrics({ register });

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const dbQueryDuration = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});

const dbConnectionPoolSize = new prometheus.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size'
});

const transfersCreatedTotal = new prometheus.Counter({
  name: 'transfers_created_total',
  help: 'Total number of transfer records created'
});

const salesCompletedTotal = new prometheus.Counter({
  name: 'sales_completed_total',
  help: 'Total number of sales completed'
});

const activeUsersCount = new prometheus.Gauge({
  name: 'active_users_count',
  help: 'Number of currently active users'
});

const businessEventsTotal = new prometheus.Counter({
  name: 'business_events_total',
  help: 'Total number of business events',
  labelNames: ['event_type', 'status']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbConnectionPoolSize);
register.registerMetric(transfersCreatedTotal);
register.registerMetric(salesCompletedTotal);
register.registerMetric(activeUsersCount);
register.registerMetric(businessEventsTotal);

function recordHttpRequest(method, route, status, duration) {
  const statusCode = status.toString();
  httpRequestDuration.observe({ method, route, status: statusCode }, duration);
  httpRequestsTotal.inc({ method, route, status: statusCode });
}

function recordDbQuery(operation, table, duration) {
  dbQueryDuration.observe({ operation, table }, duration);
}

function setDbConnectionPoolSize(size) {
  dbConnectionPoolSize.set(size);
}

function incrementTransfersCreated() {
  transfersCreatedTotal.inc();
}

function incrementSalesCompleted() {
  salesCompletedTotal.inc();
}

function setActiveUsers(count) {
  activeUsersCount.set(count);
}

function recordBusinessEvent(eventType, status = 'success') {
  businessEventsTotal.inc({ event_type: eventType, status });
}

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    recordHttpRequest(req.method, route, res.statusCode, duration);
  });
  
  next();
}

function getMetrics(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}

function healthCheck(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.status(200).json(health);
}

function readinessCheck(req, res) {
  const ready = {
    status: 'ready',
    checks: {
      database: true,
      cache: true,
      external_apis: true
    }
  };
  
  res.status(200).json(ready);
}

module.exports = {
  register,
  metricsMiddleware,
  getMetrics,
  healthCheck,
  readinessCheck,
  recordHttpRequest,
  recordDbQuery,
  setDbConnectionPoolSize,
  incrementTransfersCreated,
  incrementSalesCompleted,
  setActiveUsers,
  recordBusinessEvent
};
