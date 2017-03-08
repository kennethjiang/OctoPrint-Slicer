# coding=utf-8
from __future__ import absolute_import

### (Don't forget to remove me)
# This is a basic skeleton for your plugin's __init__.py. You probably want to adjust the class name of your plugin
# as well as the plugin mixins it's subclassing from. This is really just a basic skeleton to get you started,
# defining your plugin as a template plugin, settings and asset plugin. Feel free to add or remove mixins
# as necessary.
#
# Take a look at the documentation on what other plugin mixins are available.

import octoprint.plugin

from .vector import Vector

import uuid
import tempfile
import os
import time
import struct
import shutil
import sys
import math
import copy
import flask
import serial
import serial.tools.list_ports
import binascii
import re
import collections
import json
import imp
import glob
import ctypes
import _ctypes
import platform
import subprocess
import psutil
import socket
import threading
import yaml
import logging
import logging.handlers

class SlicerPlugin(octoprint.plugin.SettingsPlugin,
                   octoprint.plugin.AssetPlugin,
                   octoprint.plugin.TemplatePlugin,
				   octoprint.plugin.BlueprintPlugin):

	##~~ SettingsPlugin mixin

	def get_settings_defaults(self):
		return dict(
			# put your plugin's default settings here
		)

	##~~ AssetPlugin mixin

	def get_assets(self):
		# Define your plugin's asset files to automatically include in the
		# core UI here.
		return dict(
			js=["js/profile_overrides.js", "js/slicer.js", "js/three.min.js", "js/STLLoader.js", "js/OrbitControls.js", "js/TransformControls.js", "js/Detector.js", "js/OrbitControls.js", "js/TransformControls.js", "js/STLBinaryExporter.js", "js/ModelArranger.js", "js/STLViewPort.js", "js/packer.growing.js", "js/CheckerboardMaterial.js", "js/stats.min.js"],
			css=["css/slicer.css"],
			less=["less/slicer.less"]
		)

	##~~ Softwareupdate hook

	def get_update_information(self):
		# Define the configuration for your plugin to use with the Software Update
		# Plugin here. See https://github.com/foosel/OctoPrint/wiki/Plugin:-Software-Update
		# for details.
		return dict(
			slicer=dict(
				displayName="Slicer",
				displayVersion=self._plugin_version,

				# version check: github repository
				type="github_release",
				user="kennethjiang",
				repo="OctoPrint-Slicer",
				current=self._plugin_version,

				# update method: pip
				pip="https://github.com/kennethjiang/OctoPrint-Slicer/archive/{target_version}.zip"
			)
		)

	# Event monitor
	def on_event(self, event, payload) :

		# check if event is slicing started
		if event == octoprint.events.Events.SLICING_STARTED :

			# Set processing slice
			self.processingSlice = True

		# Otherwise check if event is slicing done, cancelled, or failed
		elif event == octoprint.events.Events.SLICING_DONE or event == octoprint.events.Events.SLICING_CANCELLED or event == octoprint.events.Events.SLICING_FAILED :

			# Clear processing slice
			self.processingSlice = False

			# Restore files
			self.restoreFiles()

	def restoreFiles(self) :

		# Check if slicer was changed
		if self.slicerChanges is not None :

			# Move original files back
			os.remove(self.slicerChanges["Slicer Profile Location"])
			shutil.move(self.slicerChanges["Slicer Profile Temporary"], self.slicerChanges["Slicer Profile Location"])

			if "Model Temporary" in self.slicerChanges :
				os.remove(self.slicerChanges["Model Location"])
				shutil.move(self.slicerChanges["Model Temporary"], self.slicerChanges["Model Location"])

			# Restore printer profile
			self._printer_profile_manager.save(self.slicerChanges["Printer Profile Content"], True)

			# Clear slicer changes
			self.slicerChanges = None

	# Upload event
	@octoprint.plugin.BlueprintPlugin.route("/upload", methods=["POST"])
	def upload(self) :
		# Check if uploading everything
		if "Slicer Profile Name" in flask.request.values and "Slicer Name" in flask.request.values and "Printer Profile Name" in flask.request.values and "Slicer Profile Content" in flask.request.values and "After Slicing Action" in flask.request.values :

			# Check if printing after slicing and a printer isn't connected
			if flask.request.values["After Slicing Action"] != "none" and self._printer.is_closed_or_error() :

				# Return error
				return flask.jsonify(dict(value = "Error"))

			# Set if model was modified
			modelModified = "Model Name" in flask.request.values and "Model Location" in flask.request.values and "Model Path" in flask.request.values and "Model Center X" in flask.request.values and "Model Center Y" in flask.request.values

			# Check if slicer profile, model name, or model path contain path traversal
			if "../" in flask.request.values["Slicer Profile Name"] or (modelModified and ("../" in flask.request.values["Model Name"] or "../" in flask.request.values["Model Path"])) :

				# Return error
				return flask.jsonify(dict(value = "Error"))

			# Check if model location is invalid
			if modelModified and (flask.request.values["Model Location"] != "local" and flask.request.values["Model Location"] != "sdcard") :

				# Return error
				return flask.jsonify(dict(value = "Error"))

			# Set model location
			if modelModified :

				if flask.request.values["Model Location"] == "local" :
					modelLocation = self._file_manager.path_on_disk(octoprint.filemanager.destinations.FileDestinations.LOCAL, flask.request.values["Model Path"] + flask.request.values["Model Name"]).replace('\\', '/')
				elif flask.request.values["Model Location"] == "sdcard" :
					modelLocation = self._file_manager.path_on_disk(octoprint.filemanager.destinations.FileDestinations.SDCARD, flask.request.values["Model Path"] + flask.request.values["Model Name"]).replace('\\', '/')

			# Check if slicer profile, model, or printer profile doesn't exist
			if (modelModified and not os.path.isfile(modelLocation)) or not self._printer_profile_manager.exists(flask.request.values["Printer Profile Name"]) :

				# Return error
				return flask.jsonify(dict(value = "Error"))

			# Move original model to temporary location
			if modelModified :
				fd, modelTemp = tempfile.mkstemp()
				os.close(fd)
				shutil.copy(modelLocation, modelTemp)

			fd, temp = tempfile.mkstemp()
			os.close(fd)

			output = open(temp, "wb")
			for character in flask.request.values["Slicer Profile Content"] :
				output.write(chr(ord(character)))
			output.close()

			self.tempProfileName = "temp-" + str(uuid.uuid1())
			if flask.request.values["Slicer Name"] == "cura" :
				self.convertCuraToProfile(temp, self.tempProfileName, self.tempProfileName, '')
			elif flask.request.values["Slicer Name"] == "slic3r" :
				self.convertSlic3rToProfile(temp, '', '', '')

			# Remove temporary file
			os.remove(temp)

			# Get printer profile
			printerProfile = self._printer_profile_manager.get(flask.request.values["Printer Profile Name"])

			# Save slicer changes
			self.slicerChanges = {
				"Printer Profile Content": copy.deepcopy(printerProfile)
			}

			# Check if slicer is Cura
			if flask.request.values["Slicer Name"] == "cura" :

				# Change printer profile
				search = re.findall("extruder_amount\s*?=\s*?(\d+)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["extruder"]["count"] = int(search[0])

				search = re.findall("has_heated_bed\s*?=\s*?(\S+)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					if str(search[0]).lower() == "true" :
						printerProfile["heatedBed"] = True
					else :
						printerProfile["heatedBed"] = False

				search = re.findall("machine_width\s*?=\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["volume"]["width"] = float(search[0])

				search = re.findall("machine_height\s*?=\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["volume"]["height"] = float(search[0])

				search = re.findall("machine_depth\s*?=\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["volume"]["depth"] = float(search[0])

				search = re.findall("machine_shape\s*?=\s*?(\S+)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					if str(search[0]).lower() == "circular" :
						printerProfile["volume"]["formFactor"] = "circular"
					else :
						printerProfile["volume"]["formFactor"] = "rectangular"

				search = re.findall("nozzle_size\s*?=\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["extruder"]["nozzleDiameter"] = float(search[0])

				search = re.findall("machine_center_is_zero\s*?=\s*?(\S+)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					if str(search[0]).lower() == "true" :
						printerProfile["volume"]["formFactor"] = "circular"
						printerProfile["volume"]["origin"] = "center"
					else :
						printerProfile["volume"]["formFactor"] = "rectangular"
						printerProfile["volume"]["origin"] = "lowerleft"

				search = re.findall("extruder_offset_(x|y)(\d)\s*?=\s*?(-?\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				vectors = [Vector(0, 0)] * printerProfile["extruder"]["count"]

				for offset in search :
					if offset[0] == 'x' :
						vectors[int(offset[1]) - 1].x = float(offset[2])
					else :
						vectors[int(offset[1]) - 1].y = float(offset[2])

				index = 0
				while index < len(vectors) :
					value = (vectors[index].x, vectors[index].y)
					printerProfile["extruder"]["offsets"][index] = value
					index += 1

			# Otherwise check if slicer is Slic3r
			elif flask.request.values["Slicer Name"] == "slic3r" :

				# Change printer profile
				search = re.findall("bed_size\s*?=\s*?(\d+.?\d*)\s*?,\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["volume"]["width"] = float(search[0][0])
					printerProfile["volume"]["depth"] = float(search[0][1])

				search = re.findall("nozzle_diameter\s*?=\s*?(\d+.?\d*)", flask.request.values["Slicer Profile Content"])
				if len(search) :
					printerProfile["extruder"]["nozzleDiameter"] = float(search[0])

			# Check if modifying model
			if modelModified :

				# Save model locations
				self.slicerChanges["Model Location"] = modelLocation
				self.slicerChanges["Model Temporary"] = modelTemp

				# Adjust printer profile so that its center is equal to the model's center
				printerProfile["volume"]["width"] += float(flask.request.values["Model Center X"]) * 2
				printerProfile["volume"]["depth"] += float(flask.request.values["Model Center Y"]) * 2

			# Otherwise check if using a Micro 3D printer
			elif not self._settings.get_boolean(["NotUsingAMicro3DPrinter"]) :

				# Set extruder center
				extruderCenterX = (self.bedLowMaxX + self.bedLowMinX) / 2
				extruderCenterY = (self.bedLowMaxY + self.bedLowMinY + 14.0) / 2

				# Adjust printer profile so that its center is equal to the model's center
				printerProfile["volume"]["width"] += (-(extruderCenterX - (self.bedLowMaxX + self.bedLowMinX) / 2) + self.bedLowMinX) * 2
				printerProfile["volume"]["depth"] += (extruderCenterY - (self.bedLowMaxY + self.bedLowMinY) / 2 + self.bedLowMinY) * 2

			# Apply printer profile changes
			self._printer_profile_manager.save(printerProfile, True)

			fd, destFile = tempfile.mkstemp()
			os.close(fd)
			self._slicing_manager.slice(flask.request.values["Slicer Name"],
					modelLocation, #source path
					destFile,
					self.tempProfileName,
					self)

			# Return ok
			return flask.jsonify(dict(value = "OK"))

		# Return error
		return flask.jsonify(dict(value = "Error"))

	def __call__(self, *callback_args, **callback_kwargs):
		self._slicing_manager.delete_profile("cura", self.tempProfileName)

	def convertCuraToProfile(self, input, name, displayName, description) :

		# Cura Engine plugin doesn't support solidarea_speed, perimeter_before_infill, raft_airgap_all, raft_surface_thickness, raft_surface_linewidth, plugin_config, object_center_x, and object_center_y

		# Clean up input
		fd, curaProfile = tempfile.mkstemp()
		os.close(fd)
		self.curaProfileCleanUp(input, curaProfile)

		# Import profile manager
		profileManager = imp.load_source("Profile", self._slicing_manager.get_slicer("cura")._basefolder.replace('\\', '/') + "/profile.py")

		# Create profile
		profile = octoprint.slicing.SlicingProfile("cura", name, profileManager.Profile.from_cura_ini(curaProfile), displayName, description)

		# Remove temporary file
		os.remove(curaProfile)

		# Save profile
		return self._slicing_manager.save_profile("cura", name, profile, None, True, displayName, description)

	# Cura profile cleanup
	def curaProfileCleanUp(self, input, output) :

		# Create output
		output = open(output, "wb")

		# Go through all lines in input
		for line in open(input) :

			# Fix G-code lines
			match = re.findall("^(.+)(\d+)\.gcode", line)
			if len(match) :
				line = match[0][0] + ".gcode" + match[0][1] + line[len(match[0][0]) + len(match[0][1]) + 6 :]

			# Remove comments from input
			if ';' in line and ".gcode" not in line and line[0] != '\t' :
				output.write(line[0 : line.index(';')] + '\n')
			else :
				output.write(line)

		# Close output
		output.close()

	# Slic3r profile cleanup
	def slic3rProfileCleanUp(self, input, output) :

		# Create output
		output = open(output, "wb")

		# Go through all lines in input
		for line in open(input) :

			# Remove comments from input
			if ';' in line and "_gcode" not in line and line[0] != '\t' :
				output.write(line[0 : line.index(';')] + '\n')
			else :
				output.write(line)

		# Close output
		output.close()

# If you want your plugin to be registered within OctoPrint under a different name than what you defined in setup.py
# ("OctoPrint-PluginSkeleton"), you may define that here. Same goes for the other metadata derived from setup.py that
# can be overwritten via __plugin_xyz__ control properties. See the documentation for that.
__plugin_name__ = "Slicer"

def __plugin_load__():
	global __plugin_implementation__
	__plugin_implementation__ = SlicerPlugin()

	global __plugin_hooks__
	__plugin_hooks__ = {
		"octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
	}
