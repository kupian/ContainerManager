#! /bin/bash

containers=$(docker ps -aq)
for container in $containers; do
    docker kill $container
    docker rm $container
done