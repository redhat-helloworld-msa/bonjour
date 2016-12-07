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
const express = require('express');
const router = express.Router();

const { Tracer, ExplicitContext, BatchRecorder, ConsoleRecorder } = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

const { HttpLogger } = require('zipkin-transport-http');
const ctxImpl = new ExplicitContext();

let recorder;
if (process.env.ZIPKIN_SERVER_URL === undefined) {
  console.log('No ZIPKIN_SERVER_URL defined. Printing zipkin traces to console.');
  recorder = new ConsoleRecorder();
} else {
  recorder = new BatchRecorder({
    logger: new HttpLogger({
      endpoint: process.env.ZIPKIN_SERVER_URL + '/api/v1/spans'
    })
  });
}

const tracer = new Tracer({
  recorder,
  ctxImpl // this would typically be a CLSContext or ExplicitContext
});

router.use(zipkinMiddleware({
  tracer,
  serviceName: 'bonjour' // name of this application
}));

module.exports = exports = router;