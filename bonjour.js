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
const session = require('express-session');
const swagger = require('swagger-express');
const zipkin = require('./lib/zipkin');
const api = require('./lib/api');

const app = express();

app.use(swagger.init(app, {
  apiVersion: '1.0',
  swaggerVersion: '1.0',
  basePath: 'http://localhost:3000',
  swaggerURL: '/',
  swaggerJSON: '/api-docs.json',
  swaggerUI: './public/swagger',
  info: {
    title: 'Bonjour microservices application',
    description: 'Operations that can be invoked in the bonjour microservices'
  },
  apis: ['./lib/api.js']
}));

// Create a session-store to be used by both the express-session
// middleware and the keycloak middleware.
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Use our zipkin integration
app.use(zipkin);

/**
 * @swagger
 * resourcePath: /api
 * prettyPrint: true
 */

app.use('/api', api.secure(memoryStore));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// default route (should be swagger)
app.get('/', (req, res) => res.send('Logged out'));

const server = app.listen(8080, '0.0.0.0', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Bonjour service running at http://%s:%s', host, port);
});
