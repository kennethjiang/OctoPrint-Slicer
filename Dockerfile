FROM mrwyss/octoprint:latest

RUN apt-get update && apt-get install -y cura-engine

ADD . /app
RUN cd /app && python setup.py develop
WORKDIR /app/data
CMD ["octoprint",  "--iknowwhatimdoing", "--basedir" ,"/app/data"]
