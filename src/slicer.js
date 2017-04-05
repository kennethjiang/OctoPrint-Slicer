/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */

'use strict';

import '../node_modules/babel-polyfill/dist/polyfill'
import * as THREE from 'three';
import * as THREETK from '3tk';
import { STLViewPort } from './STLViewPort';
import { OverridesViewModel } from './profile_overrides';
import { ModelArranger } from './ModelArranger';
import { CheckerboardMaterial } from './CheckerboardMaterial';
import { find, forEach, endsWith, some, extend } from 'lodash-es';

function isDev() {
    return window.location.hostname == "localhost";
}

if ( ! isDev() ) {
    Raven.config('https://85bd9314656d40da9249aec5a32a2b52@sentry.io/141297', {
        release: '1.1.2',
        ignoreErrors: [
            "Failed to execute 'arc' on 'CanvasRenderingContext2D': The radius provided",
            "Cannot read property 'highlightFill' of undefined",
            "Argument 1 of SVGMatrix.translate is not a finite floating-point value",
            /_jp.*is not a function/,
            "chrome is not defined",
            "You cannot apply bindings multiple times to the same element.",
        ],
    }).install();
}

function SlicerViewModel(parameters) {
    mixpanel.track("App Loaded");

    var self = this;

    self.canvas = document.getElementById( 'slicer-canvas' );

    //check if webGL is present. If not disable Slicer plugin
    if ( ! THREETK.Detector.webgl ) {
        $('#tab_plugin_slicer').empty().append("<h3>Slicer Plugin is disabled because your browser doesn't support WebGL</h3>");
        return;
    }

    // assign the injected parameters, e.g.:
    self.slicingViewModel = parameters[0];
    self.overridesViewModel = parameters[1];
    self.printerStateViewModel = parameters[2];
    self.printerProfilesViewModel = parameters[3];

    self.lockScale = true;
    self.selectedSTLs = {};
    self.newSession = true;


    // Override slicingViewModel.show to surpress default slicing behavior
    self.slicingViewModel.show = function(target, file, force) {
        if (!self.slicingViewModel.enableSlicingDialog() && !force) {
            return;
        }
        mixpanel.track("Load STL");

        $('a[href="#tab_plugin_slicer"]').tab('show');

        self.selectedSTLs[file] = target;
        if (self.newSession) {
            self.addToNewSession();
        } else if (Object.getOwnPropertyNames(self.selectedSTLs).length == 1) {
            $("#plugin-slicer-load-model").modal("show");
        }
    };

    self.addToNewSession = function() {
        self.stlViewPort.removeAllModels();
        self.resetToDefault();
        self.addToExistingSession();
    };

    self.addToExistingSession = function() {
        forEach( Object.getOwnPropertyNames(self.selectedSTLs), function(file) {
            var target = self.selectedSTLs[file];
            self.setSlicingViewModel(target, file);
            self.addSTL(target, file);
            delete self.selectedSTLs[file];
        });

        $("#plugin-slicer-load-model").modal("hide");
    };

    self.resetToDefault = function() {
        self.resetSlicingViewModel();
        self.newSession = true;
        setTransformMode( "translate" );
    }

    self.addSTL = function(target, file) {
        self.newSession = false;
        startLongRunning( function() {
            self.stlViewPort.loadSTL(BASEURL + "downloads/files/" + target + "/" + file);
        });
    }

    self.onModelAdd = function(event) {

        var models = event.models;
        self.stlViewPort.selectModel(models[0]);

        forEach( models, function( model ) {
            self.fixZPosition(model);
        });

        if (self.stlViewPort.models().length > 1) {
            new ModelArranger().arrange(self.stlViewPort.models());
        }
        updateInputVisibility();
    };

    self.onModelDelete = function() {
        if (self.stlViewPort.models().length == 0) {
            self.resetToDefault();
        }
        updateInputVisibility();
    };

    self.onModelSplit = function( event ) {
        forEach( event.to, function( model ) {
            self.fixZPosition(model);
        });

        if ( event.to.length > 0 ) {
            new ModelArranger().arrange( self.stlViewPort.models() );
            self.stlViewPort.selectModel( event.to[0] );
        }

        updateInputVisibility();
    };


    self.updatePrinterBed = function(profileName) {
        if ( profileName) {
            var profile = find(self.printerProfilesViewModel.profiles.items(), function(p) { return p.id == profileName });

            var dim = profile.volume;
            self.BEDSIZE_X_MM = Math.max(dim.width, 0.1); // Safari will error if rectShape has dimensions being 0
            self.BEDSIZE_Y_MM = Math.max(dim.depth, 0.1);
            self.BEDSIZE_Z_MM = Math.max(dim.height, 0.1);
            self.BED_FORM_FACTOR = dim.formFactor;
            if (dim.origin == "lowerleft" ) {
                self.ORIGIN_OFFSET_X_MM = self.BEDSIZE_X_MM/2.0;
                self.ORIGIN_OFFSET_Y_MM = self.BEDSIZE_Y_MM/2.0;
            } else {
                self.ORIGIN_OFFSET_X_MM = 0;
                self.ORIGIN_OFFSET_Y_MM = 0;
            }
        }
        self.drawBedFloor(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM, self.BED_FORM_FACTOR);
        self.drawWalls(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM, self.BEDSIZE_Z_MM, self.BED_FORM_FACTOR);
    }

    self.slicingViewModel.printerProfile.subscribe( self.updatePrinterBed );

    self.BEDSIZE_X_MM = 200;
    self.BEDSIZE_Y_MM = 200;
    self.BEDSIZE_Z_MM = 200;
    self.BED_FORM_FACTOR = "rectangular";
    self.ORIGIN_OFFSET_X_MM = 0;
    self.ORIGIN_OFFSET_Y_MM = 0;

    var CANVAS_WIDTH = 588,
        CANVAS_HEIGHT = 588;


    self.init = function() {

        $('#tab_plugin_slicer > div.translucent-blocker').hide();

        self.slicingViewModel.requestData();

        self.stlViewPort = new STLViewPort(self.canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
        self.stlViewPort.addEventListener( "change", self.onModelChange );
        self.stlViewPort.addEventListener( "add", self.onModelAdd );
        self.stlViewPort.addEventListener( "delete", self.onModelDelete );
        self.stlViewPort.addEventListener( "split", self.onModelSplit );
        self.stlViewPort.init();

        //Walls and Floor
        self.walls = new THREE.Object3D();
        self.floor = new THREE.Object3D();
        self.stlViewPort.scene.add(self.walls);
        self.stlViewPort.scene.add(self.floor);

        self.updatePrinterBed();

        ko.applyBindings(self.slicingViewModel, $('#slicing-settings')[0]);

        // Buttons on the canvas, and their behaviors.
        // TODO: it's not DRY. mix of prez code and logics. need to figure out a better way
        $("#slicer-viewport").empty().append('<div class="report"><span>Got issues or suggestions? <a target="_blank" href="https://github.com/kennethjiang/OctoPrint-Slicer/issues/new">Click here!</a></span></div>\
                  <div class="model">\
                    <button class="rotate disabled" title="Rotate"><img src="'
                        + PLUGIN_BASEURL
                        + 'slicer/static/img/rotate.png"></button>\
                    <button class="scale disabled" title="Scale"><img src="'
                        + PLUGIN_BASEURL
                        + 'slicer/static/img/scale.png"></button>\
                    <button class="remove disabled" title="Remove"><img src="'
                        + PLUGIN_BASEURL
                        + 'slicer/static/img/remove.png"></button>\
                    <button class="more disabled" title="More..."><img src="'
                        + PLUGIN_BASEURL
                        + 'slicer/static/img/more.png"></button>\
                </div>\
                <div class="values rotate">\
                    <div>\
                        <p><span class="axis x">X</span><input type="number" step="any" name="x"><span title="">°</span></p>\
                        <p><span class="axis y">Y</span><input type="number" step="any" name="y"><span title="">°</span></p>\
                        <p><span class="axis z">Z</span><input type="number" step="any" name="z"><span title="">°</span></p>\
                        <p><button id="lay-flat" class="btn"><i class="icon-glass" /><span>&nbsp;Lay flat</span></button></p>\
                        <p><button id="orient" class="btn"><i class="icon-magic" /><span>&nbsp;Optimize</span></button></p>\
                        <span></span>\
                    </div>\
               </div>\
                <div class="values scale">\
                    <div>\
                        <p><span class="axis x">X</span><input type="number" step="0.001" name="x" min="0.001"></p>\
                        <p><span class="axis y">Y</span><input type="number" step="0.001" name="y" min="0.001"></p>\
                        <p><span class="axis z">Z</span><input type="number" step="0.001" name="z" min="0.001"></p>\
                        <p class="checkbox"><label><input type="checkbox" checked>Lock</label></p>\
                        <span></span>\
                    </div>\
               </div>\
               <div class="values more">\
                   <div>\
                       <p><button id="clear" class="btn"><i class="icon-trash" /><span>&nbsp;Clear bed</span></button></p>\
                       <p><button id="split" class="btn"><i class="icon-unlink" /><span>&nbsp;Split into parts</span></button></p>\
                       <span></span>\
                   </div>\
               </div>');
        $("#slicer-viewport").append(self.stlViewPort.renderer.domElement);

        if ( isDev() ) {
            self.stlViewPort.stats = new Stats();
            self.stlViewPort.stats.showPanel( 1 );
            $("#slicer-viewport").append(self.stlViewPort.stats.dom);
        }

        $("#slicer-viewport button.rotate").click(function(event) {
            if (self.stlViewPort.transformControls.getMode() != "rotate") {
                setTransformMode("rotate");
            } else {
                setTransformMode("translate");
            }
            updateInputVisibility();
        });

        $("#slicer-viewport button.scale").click(function(event) {
            if (self.stlViewPort.transformControls.getMode() != "scale") {
                setTransformMode("scale");
            } else {
                setTransformMode("translate");
            }
            updateInputVisibility();
        });

        $("#slicer-viewport button.remove").click(function(event) {
            self.stlViewPort.removeSelectedModel();
        });

        $("#slicer-viewport button.more").click(function(event) {
            if ( $("#slicer-viewport .more.values div").hasClass("show") ) {
                updateInputVisibility();
            } else if (self.stlViewPort.selectedModel()) {
                setTransformMode("translate");
                updateInputVisibility();
                $("#slicer-viewport .more.values div").addClass("show").children('p').addClass("show");
            }
        });

        $("#slicer-viewport button#clear").click(function(event) {
            self.stlViewPort.removeAllModels();
            self.resetToDefault();
        });

        $("#slicer-viewport button#split").click(function(event) {
            startLongRunning( self.stlViewPort.splitSelectedModel );
        });

        $("#slicer-viewport button#lay-flat").click(function(event) {
            startLongRunning( function() {self.stlViewPort.laySelectedModelFlat(true); } );
        });

        $("#slicer-viewport button#orient").click(function(event) {
            startLongRunning( self.stlViewPort.laySelectedModelFlat );
        });

        $("#slicer-viewport .values input").change(function() {
            self.applyValueInputs($(this));
        });

    };

    self.applyValueInputs = function(input) {
        input.blur();
        if(input[0].type == "checkbox") {
            self.lockScale = input[0].checked;
        }
        else if(input[0].type == "number" && !isNaN(parseFloat(input.val()))) {
            input.val(parseFloat(input.val()).toFixed(3));
            var model = self.stlViewPort.selectedModel();

            if (input.closest(".values").hasClass("scale") && self.lockScale) {
                $("#slicer-viewport .scale.values input").val(input.val());
                console.log($("#slicer-viewport .scale.values input[name=\"x\"]").val());
            }

            model.rotation.x =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"x\"]").val());
            model.rotation.y =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"y\"]").val());
            model.rotation.z =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"z\"]").val());
            model.scale.x =  parseFloat($("#slicer-viewport .scale.values input[name=\"x\"]").val())
            model.scale.y =  parseFloat($("#slicer-viewport .scale.values input[name=\"y\"]").val())
            model.scale.z =  parseFloat($("#slicer-viewport .scale.values input[name=\"z\"]").val())
            self.fixZPosition(model);

            self.stlViewPort.recalculateOverhang(model);
        }
    };

    self.fixZPosition = function ( model ) {
        var bedLowMinZ = 0.0;
        var boundaryBox = new THREE.Box3().setFromObject(model);
        boundaryBox.min.sub(model.position);
        boundaryBox.max.sub(model.position);
        model.position.z -= model.position.z + boundaryBox.min.z - bedLowMinZ;
    }

    // callback function when models are changed by TransformControls
    self.onModelChange = function() {
        var model = self.stlViewPort.selectedModel();
        if (model) {
            $("#slicer-viewport .rotate.values input[name=\"x\"]").val((model.rotation.x * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"y\"]").val((model.rotation.y * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"z\"]").val((model.rotation.z * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .scale.values input[name=\"x\"]").val(model.scale.x.toFixed(3)).attr("min", '');
            $("#slicer-viewport .scale.values input[name=\"y\"]").val(model.scale.y.toFixed(3)).attr("min", '');
            $("#slicer-viewport .scale.values input[name=\"z\"]").val(model.scale.z.toFixed(3)).attr("min", '');
            $("#slicer-viewport .scale.values input[type=\"checkbox\"]").checked = self.lockScale;
            self.fixZPosition(model);
        }

        updateInputVisibility();
    };

    // Slicing
    //
    self.tempFiles = {};
    self.removeTempFilesAfterSlicing = function (event) {
        if ($.inArray(event.data.type, ["SlicingDone", "SlicingFailed"]) >= 0 &&
            event.data.payload.stl in self.tempFiles) {
            OctoPrint.files.delete(event.data.payload.stl_location,
                event.data.payload.stl);
            delete self.tempFiles[event.data.payload.stl];
        }
    }

    OctoPrint.socket.onMessage("event", self.removeTempFilesAfterSlicing);

    self.sliceRequestData = function(slicingVM, group) {
        var destinationFilename = slicingVM._sanitize(slicingVM.destinationFilename());

        var destinationExtensions = slicingVM.data[slicingVM.slicer()] && slicingVM.data[slicingVM.slicer()].extensions && slicingVM.data[slicingVM.slicer()].extensions.destination
            ? slicingVM.data[slicingVM.slicer()].extensions.destination
            : ["???"];
        if (!some(destinationExtensions, function(extension) {
            return endsWith(destinationFilename.toLowerCase(), "." + extension.toLowerCase());
        })) {
            destinationFilename = destinationFilename + "." + destinationExtensions[0];
        }
        var groupCenter = new THREE.Vector3(0,0,0);
        if (group) {
            groupCenter = new THREE.Box3().setFromObject(group).center();
        }
        var data = {
            command: "slice",
            slicer: slicingVM.slicer(),
            profile: slicingVM.profile(),
            printerProfile: slicingVM.printerProfile(),
            destination: destinationFilename,
            position: { "x": self.ORIGIN_OFFSET_X_MM + groupCenter.x,
                "y": self.ORIGIN_OFFSET_Y_MM + groupCenter.y}
        };
        extend(data, self.overridesViewModel.toJS());

        if (slicingVM.afterSlicing() == "print") {
            data["print"] = true;
        } else if (slicingVM.afterSlicing() == "select") {
            data["select"] = true;
        }
        return data;
    };

    self.sendSliceRequest = function(target, filename, data) {
        $.ajax({
            url: API_BASEURL + "files/" + target + "/" + filename,
            type: "POST",
            dataType: "json",
            contentType: "application/json; charset=UTF-8",
            data: JSON.stringify(data),
            error: function(jqXHR, textStatus) {
                new PNotify({title: "Slicing failed", text: textStatus, type: "error", hide: false});
            }
        });
    };

    self.slice = function() {
        mixpanel.track("Slice Model");

        var target = self.slicingViewModel.target;
        var sliceRequestData;

        if (self.stlViewPort.onlyOneOriginalModel()) {

            sliceRequestData = self.sliceRequestData(self.slicingViewModel);
            self.sendSliceRequest(self.slicingViewModel.target, self.slicingViewModel.file(), sliceRequestData);

        } else {

            var form = new FormData();
            var group = new THREE.Group();
            forEach(self.stlViewPort.models(), function (model) {
                group.add(model.clone(true));
            });

            sliceRequestData = self.sliceRequestData(self.slicingViewModel, group);

            var tempFilename = self.tempSTLFilename();
            form.append("file", self.blobFromModel(group), tempFilename);
            $.ajax({
                url: API_BASEURL + "files/local",
                type: "POST",
                data: form,
                processData: false,
                contentType: false,
                // On success
                success: function(_) {
                    self.tempFiles[tempFilename] = 1;
                    self.sendSliceRequest(target, tempFilename, sliceRequestData);
                },
                error: function(jqXHR, textStatus) {
                    new PNotify({title: "Slicing failed", text: textStatus, type: "error", hide: false});
                }
            });

        }
    };

    self.blobFromModel = function( model ) {
        var exporter = new THREETK.STLBinaryExporter();
        return new Blob([exporter.parse(model)], {type: "text/plain"});
    };

    self.isPrinting = ko.computed(function () {
        return self.printerStateViewModel.isPrinting() ||
            self.printerStateViewModel.isPaused();
    });

    self.canSliceNow = ko.computed(function () {
        // TODO: We should be checking for same_device here, too.
        return self.slicingViewModel.enableSliceButton() &&
            !self.isPrinting();
    });
    // END: Slicing

    // Helpers for drawing walls and floor
    //
    self.createText = function(font, text, width, depth, parentObj) {
        var textGeometry = new THREE.TextGeometry( text, {
            font: font,
            size: 10,
            height: 0.1,
            material: 0, extrudeMaterial: 1
        });
        var materialFront = new THREE.MeshBasicMaterial( { color: 0x048e06} );
        var materialSide = new THREE.MeshBasicMaterial( { color: 0x8A8A8A} );
        var materialArray = [ materialFront, materialSide ];
        var textMaterial = new THREE.MeshFaceMaterial(materialArray);

        var mesh = new THREE.Mesh( textGeometry, textMaterial );
        textGeometry.computeBoundingBox();
        var textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        var textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
        switch (text) {
            case "Front":
                mesh.position.set(-textWidth/2, -depth/2 - textHeight - 4, 1.0);
                break;
            case "Back":
                mesh.position.set(textWidth/2, depth/2 + textHeight + 4, 1.0);
                mesh.rotation.set(0, 0, Math.PI);
                break;
            case "Left":
                mesh.position.set(-width/2 - textHeight - 4, textWidth/2, 1.0);
                mesh.rotation.set(0, 0, -Math.PI / 2);
                break;
            case "Right":
                mesh.position.set(width/2 + textHeight, -textWidth/2, 1.0);
                mesh.rotation.set(0, 0, Math.PI / 2);
                break;
        }
        parentObj.add(mesh);
    };

    self.drawBedFloor = function ( width, depth, formFactor) {
        var geometry;
        for(var i = self.floor.children.length - 1; i >= 0; i--) {
            var obj = self.floor.children[i];
            self.floor.remove(obj);
        }

        if (formFactor == "circular") {
            geometry = new THREE.CircleGeometry(width/2, 60);
        } else {
            geometry = new THREE.PlaneBufferGeometry(width, depth);
        }
        var material = new CheckerboardMaterial(width/20, depth/20, null, function() { self.stlViewPort.render(); });  // 20mm/checker box
        var mesh = new THREE.Mesh(geometry, material);

        mesh.receiveShadow = true;
        self.floor.add(mesh);

        //Add text to indicate front/back of print bed
        var loader = new THREE.FontLoader();
        loader.load( PLUGIN_BASEURL + "slicer/static/js/optimer_bold.typeface.json", function ( font ) {
            self.createText(font, "Front", width, depth, self.floor);
            self.createText(font, "Back", width, depth, self.floor);
            self.createText(font, "Left", width, depth, self.floor);
            self.createText(font, "Right", width, depth, self.floor);
        } );
    };

    self.drawWalls = function ( width, depth, height, formFactor ) {
        for(var i = self.walls.children.length - 1; i >= 0; i--) {
            var obj = self.walls.children[i];
            self.walls.remove(obj);
        }

        //This material will only make the inside of the cylinder walls visible while allowing the outside to be transparent.
        var wallMaterial = new THREE.MeshBasicMaterial({ color: 0x8888fc, side: THREE.BackSide, transparent: true, opacity: 0.8 });
        var invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false, transparent: false });

        if (formFactor == "circular") {

            var cylGeometry = new THREE.CylinderGeometry(width/2, width/2, self.BEDSIZE_Z_MM, 60, 1, true);
            // Move the walls up to the floor
            cylGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, self.BEDSIZE_Z_MM / 2, 0));
            var wall = new THREE.Mesh(cylGeometry, wallMaterial);
            //rotate the walls so they are upright
            wall.rotation.x = Math.PI / 2;
            self.walls.add(wall);

        } else  {

            var cubeGeometry = new THREE.BoxBufferGeometry( width, height, depth );
            var materials = [
                    wallMaterial,
                    wallMaterial,
                    wallMaterial,
                    wallMaterial,
                    invisibleMaterial,
                    invisibleMaterial,
            ];
            var cubeSidesMaterial = new THREE.MultiMaterial( materials );
            var wall = new THREE.Mesh( cubeGeometry, cubeSidesMaterial );
            wall.position.z = height/2;
            self.walls.add(wall);

        }
    };

    // END: Helpers for drawing walls and floor

    self.resetSlicingViewModel = function() {
        self.slicingViewModel.target = undefined;
        self.slicingViewModel.file(undefined);
        self.slicingViewModel.destinationFilename(undefined);
    };

    self.setSlicingViewModel = function(target, filename) {
        if (!self.slicingViewModel.destinationFilename()) {  // A model is added to an empty bed
            self.slicingViewModel.target = target;
            self.slicingViewModel.file(filename);
            self.slicingViewModel.destinationFilename(self.computeDestinationFilename(filename));
        }
    };

    // Returns the destination filename based on which models are loaded.
    // The destination filename is without the final .gco on it because
    // that will depend on the slicer.
    self.computeDestinationFilename = function(inputFilename) {
        // TODO: For now, just use the first model's name.
        var destinationFilename = inputFilename.substr(0, inputFilename.lastIndexOf("."));
        if (destinationFilename.lastIndexOf("/") != 0) {
            destinationFilename = destinationFilename.substr(destinationFilename.lastIndexOf("/") + 1);
        }
        return destinationFilename;
    };

    self.tempSTLFilename = function() {
        var pos = self.slicingViewModel.file().lastIndexOf(".")
        return [self.slicingViewModel.file().slice(0, pos),
            ".tmp." + (+ new Date()),
            self.slicingViewModel.file().slice(pos)].join('');
    };

    self.init();

    //////////////////////
    // internal functions
    ///////////////////////

    function startLongRunning( func ) {
        $('#tab_plugin_slicer > div.translucent-blocker').show();
        setTimeout( function() {
            func();
            $('#tab_plugin_slicer > div.translucent-blocker').hide();
        }, 1);
    }

    function updateInputVisibility() {
        $('#tab_plugin_slicer > div.translucent-blocker').hide();
        $("#slicer-viewport .values div").removeClass("show")

        if (!self.stlViewPort.selectedModel()) {
            $("#slicer-viewport button").addClass("disabled");
        } else {
            $("#slicer-viewport button").removeClass("disabled");
            switch (self.stlViewPort.transformControls.getMode()) {
                case "rotate":
                    $("#slicer-viewport .rotate.values div").addClass("show").children('p').addClass("show");
                    break;
                case "scale":
                    $("#slicer-viewport .scale.values div").addClass("show").children('p').addClass("show");
                    break;
            }
        }
    }

    function setTransformMode( mode ) {
        switch (mode) {
            case "rotate":
                self.stlViewPort.transformControls.setMode("rotate");
                self.stlViewPort.transformControls.space = "world";
                break;
            case "translate":
                self.stlViewPort.transformControls.setMode("translate");
                self.stlViewPort.transformControls.space = "world";
                self.stlViewPort.transformControls.axis = "XY";
                break;
            case "scale":
                self.stlViewPort.transformControls.setMode("scale");
                self.stlViewPort.transformControls.space = "local";
                self.stlViewPort.transformControls.axis = null;
                break;
        }
    }
}


// view model class, parameters for constructor, container to bind to
OCTOPRINT_VIEWMODELS.push([
    SlicerViewModel,

    // e.g. loginStateViewModel, settingsViewModel, ...
    [ "slicingViewModel", "overridesViewModel", "printerStateViewModel", "printerProfilesViewModel" ],

    // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
    [ "#slicer" ]
]);
