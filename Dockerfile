FROM mrwyss/octoprint:latest
ADD . /app
RUN cd /app && python setup.py develop
WORKDIR /app/data
CMD ["octoprint",  "--iknowwhatimdoing", "--basedir" ,"/app/data"]
