FROM bucharestgold/centos7-nodejs:6.9.5
# The parent image uses ONBUILD to add package.json, run npm install and add bonjour.js
# See https://github.com/ryanj/origin-s2i-nodejs/blob/master/nodejs.org/Dockerfile.onbuild#L65
