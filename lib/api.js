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

const os = require('os');

const express = require('express');
const router = express.Router();

// chaining
const roi = require('roi');
const circuitBreaker = require('opossum');

// authorized routes
const Keycloak = require('keycloak-connect');

// business logic
const sayBonjour = () => `Bonjour de ${os.hostname()}`;

/**
 * @swagger
 * path: /bonjour
 * operations:
 *   -  httpMethod: GET
 *      summary: Gets the greeting from this API
 *      notes: It's in French!!!
 *      nickname: howdy
 *      consumes:
 *        - text/html
 *        - text/json
 *      produces:
 *        - text/plain
 */
router.get('/bonjour', (req, resp) => resp.send(sayBonjour()));

// health route
router.get('/health', (req, resp) => {
  resp.set('Access-Control-Allow-Origin', '*');
  resp.send('I am ok');
});

// circuit breaker
const circuitOptions = {
  maxFailures: 5,
  timeout: 1000,
  resetTimeout: 10000
};

const nextService = 'ola';
function fallback () {
  return `The ${nextService} service is currently unavailable.`;
}

const circuit = circuitBreaker(roi.get, circuitOptions);
circuit.fallback(fallback);

router.get('/bonjour-chaining', (req, resp) =>
  circuit.fire({endpoint: `http://${nextService}:8080/api/${nextService}-chaining`}).then((response) => {
    resp.set('Access-Control-Allow-Origin', '*');
    resp.send(response);
  }).catch((e) => resp.send(e))
);

router.secure = (store) => {
  // Configure keycloak based on keycloak.json and the KEYCLOAK_AUTH_SERVER_URL env var
  const fs = require('fs');
  const customKeyCloakConfig = JSON.parse(fs.readFileSync(`${__dirname}/keycloak.json`).toString());
  customKeyCloakConfig.authServerUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;
  const keycloak = new Keycloak({ scope: 'USERS', store }, customKeyCloakConfig);

  // add a secured route
  router.get('/bonjour-secured', keycloak.protect(),
    (req, resp) => resp.send(`This is a Secured resource. You're logged as ${req.kauth.grant.access_token.content.name}`));

  // add a logout route
  router.use(keycloak.middleware({ logout: '/logout' }));
  return router;
};

module.exports = exports = router;
