FROM ubuntu

RUN apt-get update && apt-get install -y --no-install-recommends \
    python-pip \
    python-dev \
    git \
    build-essential \
    libav-tools \
    avrdude \
    curl \
    cura-engine \
    vim

RUN apt-get clean \
    && rm -rf /tmp/* /var/tmp/*  \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip setuptools

WORKDIR /octoprint
RUN git clone https://github.com/foosel/OctoPrint.git /octoprint
RUN pip install -r requirements.txt
RUN python setup.py install

ADD . /app
RUN cd /app && python setup.py develop
WORKDIR /app/data

EXPOSE 5000

CMD ["octoprint",  "--iknowwhatimdoing", "--basedir", "/app/data", "--debug"]
