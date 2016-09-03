#!/bin/bash

docker run -v $(pwd):/app -w /app kennethjiang/octoprint-slicer:latest python setup.py develop #This is in Dockerfile but somehow doesn't seem to work?!!
docker run -p 5000:5000 -v $(pwd):/app kennethjiang/octoprint-slicer:latest
