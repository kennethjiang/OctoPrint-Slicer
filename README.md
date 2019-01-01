*Note: This project is no longer maintained. The latest Cura versions have excellent support to directly slice and send gcode to OctoPrint, and hence render this plugin largely obsolete.*

*If you are interested in taking over the ownership of this plugin, please PM me.*

# OctoPrint Slicer

Slicer plugin offers useful features that OctoPrint's built-in slicer doesn't have:

- Rotate, scale, and move STL models.
- Slice multiple STLs at a time. Split 1 STL into unconnected parts.
- Circular print bed support (do you have a delta printer?).
- High-light overhang areas. Automatically orient the model for better result ("lay flat").
- Slice based on Cura profiles you upload to OctoPrint.
- Customizable slicing settings, including Basic (layer height, bed temperature ...) and Advanced (print speed, start/end G-code ...).
- Slic3r support (when Slic3r plugin is installed).
- More is coming...

![Slicer plugin screenshot](/docs/screenshot1.png?raw=true "Slicer Screen Shot")
![Slicer plugin screenshot](/docs/screenshot2.png?raw=true "Slicer Screen Shot")
![Slicer plugin screenshot](/docs/screenshot3.png?raw=true "Slicer Screen Shot")
![Slicer plugin screenshot](/docs/screenshot4.png?raw=true "Slicer Screen Shot")


## Setup

Install via the bundled [Plugin Manager](https://github.com/foosel/OctoPrint/wiki/Plugin:-Plugin-Manager)
or manually using this URL:

    https://github.com/kennethjiang/OctoPrint-Slicer/archive/master.zip

## Contribute

Are you a proud developer? Do you want to pitch in? I have made it as easy as 1-2-3:

1. [Install Docker](https://docs.docker.com/engine/installation/). Make sure [Docker compose](https://docs.docker.com/compose/) is also installed.

1. Clone OctoPrint-Slicer and run it

```bash
git clone https://github.com/kennethjiang/OctoPrint-Slicer.git
cd OctoPrint-Slicer
docker-compose up
```

1. Open [http://localhost:5000/](http://localhost:5000/) in your browser

## Thanks
![BrowserStack](https://lh4.googleusercontent.com/wyCKLuED8i1E6mvA8Moiwd5VSq2jXHXPOel85bqnW-rUU_tXBr0c1aSIhY7SHH1jKTaf7AF7vA=s50-h50-e365 "BrowserStack") BrowserStack generously sponsors a free license so that I can test Slicer Plugin on different browsers/versions.

