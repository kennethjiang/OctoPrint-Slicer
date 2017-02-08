FROM kennethjiang/octoprint-with-slicers

ADD . /app
WORKDIR /app
RUN python setup.py develop

WORKDIR /app/data

EXPOSE 5000

CMD ["octoprint",  "--iknowwhatimdoing", "--basedir", "/app/data", "--debug"]
