#!/bin/bash

docker-compose rm -f
docker-compose pull
docker-compose up --build -d
