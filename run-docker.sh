#!/bin/sh
docker stop ip-update-1
docker rm ip-update-1
docker run -d --name ip-update-1 ip-update