FROM ryanj/centos7-nodejs:6.4.0

ENV ENABLE_ZIPKIN false
ENV ZIPKIN_SERVER_URL http://zipkin-query:9411
