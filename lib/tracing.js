/**
 * JBoss, Home of Professional Open Source
 * Copyright 2016, Red Hat, Inc. and/or its affiliates, and individual
 * contributors by the @authors tag. See the copyright.txt in the
 * distribution for a full listing of individual contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const opentracing = require('opentracing');
const jaeger = require('jaeger-client');

// zipkin native tracing, zipkin does not implement OpenTracing yet
const { Tracer, ExplicitContext, BatchRecorder } = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
const { HttpLogger } = require('zipkin-transport-http');

const SERVICE_NAME = 'bonjour';

function init (express) {
  if (process.env.TRACING_SYSTEM === 'zipkin') {
    console.log('Using Zipkin native tracing');
    zipkinNativeTracing(express);
    return;
  }

  // if zipkin is not used follows OpenTracing configuration
  openTracingInterceptor(express);

  if (process.env.TRACING_SYSTEM === 'jaeger') {
    console.log('Using Jaeger tracer');
    const tracerConfig = {
      serviceName: SERVICE_NAME,
      reporter: {
        flushIntervalMs: 1000,
        agentHost: process.env.JAEGER_SERVER_URL,
        agentPort: 6832
      },
      sampler: {
        type: 'const',
        param: 1
      }
    };

    const jaegerTracer = jaeger.initTracer(tracerConfig);
    opentracing.initGlobalTracer(jaegerTracer);
    return;
  }

  console.log('Using Noop tracer');
  opentracing.initGlobalTracer(opentracing.tracer);
}

function zipkinNativeTracing (express) {
  const recorder = new BatchRecorder({
    logger: new HttpLogger({
      endpoint: process.env.ZIPKIN_SERVER_URL + '/api/v1/spans'
    })
  });

  const ctxImpl = new ExplicitContext();
  const tracer = new Tracer({
    recorder,
    ctxImpl // this would typically be a CLSContext or ExplicitContext
  });

  express.use(zipkinMiddleware({
    tracer,
    serviceName: SERVICE_NAME
  }));
}

function openTracingInterceptor (express) {
  express.use((req, res, next) => {
    // do not trace health endpoint
    if (req.url.indexOf('health') === -1) {
      const serverSpan = opentracing.globalTracer().startSpan(req.method, {
        childOf: opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, req.headers)
      });

      serverSpan.setTag(opentracing.Tags.COMPONENT, 'node-js');
      serverSpan.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_SERVER);
      serverSpan.setTag(opentracing.Tags.HTTP_URL, 'http://' + req.headers.host + req.url);
      serverSpan.setTag(opentracing.Tags.HTTP_METHOD, req.method);

      res.on('finish', () => {
        serverSpan.setTag(opentracing.Tags.HTTP_METHOD, res.statusCode);
        if (res.statusCode >= 500) {
          serverSpan.setTag(opentracing.Tags.ERROR, true);
        }
        serverSpan.finish();
      });
    }

    next();
  });
}

module.exports = {
  init
};
