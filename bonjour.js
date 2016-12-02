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
// jshint esnext: true

const express = require('express');
const fs = require('fs');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const {Tracer, ExplicitContext, BatchRecorder, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

// chaining
const roi = require('roi');
const circuitBreaker = require('opossum');

// circuit breaker
const circuitOptions = {
  maxFailures: 5,
  timeout: 1000,
  resetTimeout: 10000
};
const nextService = 'hola';
const circuit = circuitBreaker(roi.get, circuitOptions);
circuit.fallback(() => (`The ${nextService} service is currently unavailable.`));

const chainingOptions = {
  endpoint: 'http://hola:8080/api/hola-chaining'
};

const ctxImpl = new ExplicitContext();
const {HttpLogger} = require('zipkin-transport-http');
const os = require('os');
const app = express();

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

// Create a session-store to be used by both the express-session
// middleware and the keycloak middleware.
const memoryStore = new session.MemoryStore();

app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

app.use(zipkinMiddleware({
  tracer,
  serviceName: 'bonjour' // name of this application
}));

// Configure keycloak based on keycloak.json and the KEYCLOAK_AUTH_SERVER_URL env var
const customKeyCloakConfig = JSON.parse(fs.readFileSync('keycloak.json').toString());
customKeyCloakConfig.authServerUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;

const keycloak = new Keycloak({ scope: 'USERS', store: memoryStore }, customKeyCloakConfig);

app.use(keycloak.middleware({ logout: '/api/logout' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

app.get('/', (req, res) => res.send('Logged out'));

const sayBonjour = () => `Bonjour de ${os.hostname()}`;

app.get('/api/bonjour', (req, resp) => resp.send(sayBonjour()));

app.get('/api/bonjour-secured', keycloak.protect(),
  (req, resp) => resp.send(`This is a Secured resource. You're logged as ${req.kauth.grant.access_token.content.name}`));

app.get('/api/bonjour-chaining', (req, resp) =>
  circuit.fire(chainingOptions).then((response) => {
    resp.set('Access-Control-Allow-Origin', '*');
    resp.send(response);
  }).catch((e) => resp.send(e))
);

app.get('/api/health', (req, resp) => {
  resp.set('Access-Control-Allow-Origin', '*');
  resp.send('I am ok');
});

const server = app.listen(8080, '0.0.0.0', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Bonjour service running at http://%s:%s', host, port);
});
