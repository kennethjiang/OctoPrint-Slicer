FROM kennethjiang/octoprint-with-slicers

ADD . /app
WORKDIR /app
RUN python setup.py develop

RUN if [ ! -f /app/data/config.yaml ]; then cp /data/config.yaml /app/data/; fi
WORKDIR /app/data
RUN if [ ! -f /app/data/config.yaml ]; then cp /data/config.yaml /app/data/; fi
EXPOSE 5000

CMD ["octoprint",  "--iknowwhatimdoing", "--basedir", "/app/data", "--debug"]
