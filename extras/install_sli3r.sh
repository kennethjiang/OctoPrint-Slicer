#!/bin/sh

echo "Shell script created by Javier Martínez Arrieta for Slic3r installation\n"
version=1.2.9
echo "The installation of Slic3r takes a long time. PLease be patient"
cd $HOME
echo "Installing required libraries and dependencies..."
apt-get update && apt-get -y install git libboost-system-dev libboost-thread-dev git-core build-essential libgtk2.0-dev libwxgtk2.8-dev libwx-perl libmodule-build-perl libnet-dbus-perl cpanminus libextutils-cbuilder-perl gcc-4.7 g++-4.7 libwx-perl libperl-dev
cpanm AAR/Boost-Geometry-Utils-0.06.tar.gz Math::Clipper Math::ConvexHull Math::ConvexHull::MonotoneChain Math::Geometry::Voronoi Math::PlanePath Moo IO::Scalar Class::XSAccessor Growl::GNTP XML::SAX::ExpatXS PAR::Packer
echo "Cloning Slic3r repository..."
git clone https://github.com/alexrj/Slic3r.git
cd Slic3r
git checkout $version
echo "Building and testing Scli3r..."
perl Build.PL
echo "If everything was installed properly,you should be able to run Slic3r with the command ./slic3r.pl"
