/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */

'use strict';
if (window.location.hostname != "localhost") {
    Raven.config('https://85bd9314656d40da9249aec5a32a2b52@sentry.io/141297', {release: '0.9.6'}).install()
}

$(function() {
    function SlicerViewModel(parameters) {
        mixpanel.track("App Loaded");

        var self = this;

        self.canvas = document.getElementById( 'slicer-canvas' );

        //check if webGL is present. If not disable Slicer plugin
        if ( ! Detector.webgl ) {
            $('#tab_plugin_slicer').empty().append("<h3>Slicer Plugin is disabled because your browser doesn't support WebGL</h3>");
            return;
        }

        // assign the injected parameters, e.g.:
        self.slicingViewModel = parameters[0];
        self.overridesViewModel = parameters[1];
        self.printerStateViewModel = parameters[2];
        self.printerProfilesViewModel = parameters[3];

        self.modelManager = new ModelManager(self.slicingViewModel);

        self.lockScale = true;
        self.selectedSTL = undefined;

        // Override slicingViewModel.show to surpress default slicing behavior
        self.slicingViewModel.show = function(target, file, force) {
            if (!self.slicingViewModel.enableSlicingDialog() && !force) {
                return;
            }
            mixpanel.track("Load STL");

            $('a[href="#tab_plugin_slicer"]').tab('show');

            if (self.modelManager.models.length != 0) {
                self.selectedSTL = {target: target, file: file};
                $("#plugin-slicer-load-model").modal("show");
            } else {
                self.addSTL(target, file);
            }
        };

        self.emptyBed = function() {
            self.modelManager.removeAll();
            self.stlViewPort.removeAllModels();

            $("#plugin-slicer-load-model").modal("hide");
        };

        self.addSelectedSTL = function() {
            self.addSTL(self.selectedSTL.target, self.selectedSTL.file);
            self.selectedSTL = undefined;

            $("#plugin-slicer-load-model").modal("hide");
        };

        self.addSTL = function(target, file) {
            self.stlViewPort.loadSTL(BASEURL + "downloads/files/" + target + "/" + file, function(model) {
                self.modelManager.add(model, target, file);
                self.stlViewPort.makeModelActive(model);

                if (self.modelManager.models.length > 1) {
                    new ArrangeModels().arrange(self.modelManager.models, self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM,
                      10 /* mm margin */, 5000 /* milliseconds max */, self.onModelChange, false);
                }
                self.fixZPosition(model);
            });
        };

        self.updatePrinterBed = function(profileName) {
            if ( profileName) {
                var profile = self.printerProfilesViewModel.profiles.items().find(function(p) { return p.id == profileName })
                var volume = profile.volume;
                self.BEDSIZE_X_MM = volume.width;
                self.BEDSIZE_Y_MM = volume.depth;
                self.BEDSIZE_Z_MM = volume.height;
                if ( volume.origin == "lowerleft" ) {
                    self.ORIGIN_OFFSET_X_MM = self.BEDSIZE_X_MM/2.0;
                    self.ORIGIN_OFFSET_Y_MM = self.BEDSIZE_Y_MM/2.0;
                } else {
                    self.ORIGIN_OFFSET_X_MM = 0;
                    self.ORIGIN_OFFSET_Y_MM = 0;
                }
                if ( volume.formFactor == "rectangular" ) {
                    self.drawCubeBuildArea();
                }
                if ( volume.formFactor == "circular" ) {
                    self.drawCylinderBuildArea();
                }
            } else {
                self.drawCubeBuildArea();
            }

            self.stlViewPort.render();
        }

        self.slicingViewModel.printerProfile.subscribe( self.updatePrinterBed );

        self.BEDSIZE_X_MM = 200;
        self.BEDSIZE_Y_MM = 200;
        self.BEDSIZE_Z_MM = 200;
        self.ORIGIN_OFFSET_X_MM = 0;
        self.ORIGIN_OFFSET_Y_MM = 0;

        var CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;


        self.init = function() {

            self.slicingViewModel.requestData();

            self.stlViewPort = new THREE.STLViewPort(self.canvas, CANVAS_WIDTH, CANVAS_HEIGHT, self.onModelChange)
            self.stlViewPort.init();

            //Walls and Floor
            self.walls = new THREE.Object3D();
            self.floor = new THREE.Object3D();
            self.stlViewPort.scene.add(self.walls);
            self.stlViewPort.scene.add(self.floor);

            ko.applyBindings(self.slicingViewModel, $('#slicing-settings')[0]);

            // Buttons on the canvas, and their behaviors.
            // TODO: it's not DRY. mix of prez code and logics. need to figure out a better way
            $("#slicer-viewport").empty().append('<div class="report"><span>Got issues or suggestions? <a target="_blank" href="https://github.com/kennethjiang/OctoPrint-Slicer/issues/new">Click here!</a></span></div>\
                  <div class="model">\
                    <button class="translate disabled" title="Move"><img src="'
                + PLUGIN_BASEURL
                + 'slicer/static/img/translate.png"></button>\
                    <button class="rotate disabled" title="Rotate"><img src="'
                + PLUGIN_BASEURL
                + 'slicer/static/img/rotate.png"></button>\
                    <button class="scale disabled" title="Scale"><img src="'
                + PLUGIN_BASEURL
                + 'slicer/static/img/scale.png"></button>\
                    <button class="remove disabled" title="Remove"><img src="'
                + PLUGIN_BASEURL
                + 'slicer/static/img/remove.png"></button>\
                </div>\
                <div class="values translate">\
                    <div>\
                        <p><span class="axis x">X</span><input type="number" step="any" name="x"><span title="">mm</span></p>\
                        <p><span class="axis y">Y</span><input type="number" step="any" name="y"><span title="">mm</span></p>\
                        <span></span>\
                    </div>\
               </div>\
                <div class="values rotate">\
                    <div>\
                        <p><span class="axis x">X</span><input type="number" step="any" name="x"><span title="">°</span></p>\
                        <p><span class="axis y">Y</span><input type="number" step="any" name="y"><span title="">°</span></p>\
                        <p><span class="axis z">Z</span><input type="number" step="any" name="z"><span title="">°</span></p>\
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
               </div>');

            $("#slicer-viewport").append(self.stlViewPort.renderer.domElement);
            $("#slicer-viewport").append(self.stlViewPort.stats.dom);

            $("#slicer-viewport button.translate").click(function(event) {
                // Set selection mode to translate
                self.stlViewPort.transformControls.setMode("translate");
                self.toggleValueInputs($("#slicer-viewport .translate.values div"));
            });
            $("#slicer-viewport button.rotate").click(function(event) {
                // Set selection mode to rotate
                self.stlViewPort.transformControls.setMode("rotate");
                self.toggleValueInputs($("#slicer-viewport .rotate.values div"));
            });
            $("#slicer-viewport button.scale").click(function(event) {
                // Set selection mode to scale
                self.stlViewPort.transformControls.setMode("scale");
                self.toggleValueInputs($("#slicer-viewport .scale.values div"));
            });
            $("#slicer-viewport button.remove").click(function(event) {
                // Remove the currently selected object.
                self.modelManager.remove( self.stlViewPort.removeActiveModel() );
            });
            $("#slicer-viewport .values input").change(function() {
                self.applyValueInputs($(this));
            });

        };

        self.toggleValueInputs = function(parentDiv) {
            if ( parentDiv.hasClass("show") ) {
                parentDiv.removeClass("show").children('p').removeClass("show");
            } else if (self.stlViewPort.activeModel()) {
                $("#slicer-viewport .values div").removeClass("show");
                parentDiv.addClass("show").children('p').addClass("show");
            }
        };

        self.applyValueInputs = function(input) {
            input.blur();
            if(input[0].type == "checkbox") {
                self.lockScale = input[0].checked;
            }
            else if(input[0].type == "number" && !isNaN(parseFloat(input.val()))) {
                input.val(parseFloat(input.val()).toFixed(3));
                var model = self.stlViewPort.activeModel();

                if (input.closest(".values").hasClass("scale") && self.lockScale) {
                    $("#slicer-viewport .scale.values input").val(input.val());
                    console.log($("#slicer-viewport .scale.values input[name=\"x\"]").val());
                }

                model.position.x =  parseFloat($("#slicer-viewport .translate.values input[name=\"x\"]").val())
                model.position.y =  parseFloat($("#slicer-viewport .translate.values input[name=\"y\"]").val())
                model.rotation.x =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"x\"]").val());
                model.rotation.y =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"y\"]").val());
                model.rotation.z =  THREE.Math.degToRad($("#slicer-viewport .rotate.values input[name=\"z\"]").val());
                model.scale.x =  parseFloat($("#slicer-viewport .scale.values input[name=\"x\"]").val())
                model.scale.y =  parseFloat($("#slicer-viewport .scale.values input[name=\"y\"]").val())
                model.scale.z =  parseFloat($("#slicer-viewport .scale.values input[name=\"z\"]").val())
                self.fixZPosition(model);
                self.stlViewPort.render();
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
            var model = self.stlViewPort.activeModel();
            if (model) {
                $("#slicer-viewport .translate.values input[name=\"x\"]").val(model.position.x.toFixed(3)).attr("min", '');
                $("#slicer-viewport .translate.values input[name=\"y\"]").val(model.position.y.toFixed(3)).attr("min", '');
                $("#slicer-viewport .rotate.values input[name=\"x\"]").val((model.rotation.x * 180 / Math.PI).toFixed(3)).attr("min", '');
                $("#slicer-viewport .rotate.values input[name=\"y\"]").val((model.rotation.y * 180 / Math.PI).toFixed(3)).attr("min", '');
                $("#slicer-viewport .rotate.values input[name=\"z\"]").val((model.rotation.z * 180 / Math.PI).toFixed(3)).attr("min", '');
                $("#slicer-viewport .scale.values input[name=\"x\"]").val(model.scale.x.toFixed(3)).attr("min", '');
                $("#slicer-viewport .scale.values input[name=\"y\"]").val(model.scale.y.toFixed(3)).attr("min", '');
                $("#slicer-viewport .scale.values input[name=\"z\"]").val(model.scale.z.toFixed(3)).attr("min", '');
                $("#slicer-viewport .scale.values input[type=\"checkbox\"]").checked = self.lockScale;
                self.fixZPosition(model);
                self.stlViewPort.render();
            }

            if (!self.stlViewPort.activeModel()) {
                $("#slicer-viewport .values div").removeClass("show")
                $("#slicer-viewport button").addClass("disabled");
            } else {
                $("#slicer-viewport button").removeClass("disabled");
            }
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

        self.sendSliceCommand = function(filename, group) {
            var slicingVM = self.slicingViewModel;

            var destinationFilename = slicingVM._sanitize(slicingVM.destinationFilename());

            var destinationExtensions = slicingVM.data[slicingVM.slicer()] && slicingVM.data[slicingVM.slicer()].extensions && slicingVM.data[slicingVM.slicer()].extensions.destination
                ? slicingVM.data[slicingVM.slicer()].extensions.destination
                : ["???"];
            if (!_.any(destinationExtensions, function(extension) {
                return _.endsWith(destinationFilename.toLowerCase(), "." + extension.toLowerCase());
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
            _.extend(data, self.overridesViewModel.toJS());

            if (slicingVM.afterSlicing() == "print") {
                data["print"] = true;
            } else if (slicingVM.afterSlicing() == "select") {
                data["select"] = true;
            }
            $.ajax({
                url: API_BASEURL + "files/" + slicingVM.target + "/" + filename,
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
            if (self.modelManager.onlyOneOriginalModel()) {
                self.sendSliceCommand(self.slicingViewModel.file());
            } else {
                var form = new FormData();
                var group = new THREE.Group();
                _.forEach(self.modelManager.models, function (model) {
                    group.add(model.clone(true));
                });

                var tempFilename = self.modelManager.tempSTLFilename();
                form.append("file", self.blobFromModel(group), tempFilename);
                $.ajax({
                    url: API_BASEURL + "files/local",
                    type: "POST",
                    data: form,
                    processData: false,
                    contentType: false,
                    // On success
                    success: function(data) {
                        self.tempFiles[tempFilename] = 1;
                        self.sendSliceCommand(tempFilename, group);
                    },
                    error: function(jqXHR, textStatus) {
                        new PNotify({title: "Slicing failed", text: textStatus, type: "error", hide: false});
                    }
                });
            }
        };

        self.blobFromModel = function( model ) {
            var exporter = new THREE.STLBinaryExporter();
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

        self.drawCubeBuildArea = function() {
            self.drawBedFloor(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM);
            self.drawWalls(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM, self.BEDSIZE_Z_MM);
        }

        self.drawCylinderBuildArea = function() {
            for(var i = self.floor.children.length - 1; i >= 0; i--) {
                var obj = self.floor.children[i];
                self.floor.remove(obj);
            }
            for(var i = self.walls.children.length - 1; i >= 0; i--) {
                var obj = self.walls.children[i];
                self.walls.remove(obj);
            }

            var segments = self.BEDSIZE_X_MM / 20;
            var bedRadius = self.BEDSIZE_X_MM / 2;
            var geometry = new THREE.CircleGeometry(bedRadius, 60);
            var material = new CheckerboardMaterial(segments, segments, null, function() { self.stlViewPort.render(); });
            var circle = new THREE.Mesh(geometry, material);
            circle.receiveShadow = true;
            self.floor.add(circle);

            var cylGeometry = new THREE.CylinderGeometry(bedRadius, bedRadius, self.BEDSIZE_Z_MM, 60, 1, true);
            //This material will only make the inside of the cylinder walls visible while allowing the outside to be transparent.
            var wallMaterial = new THREE.MeshBasicMaterial({ color: 0x8888fc, side: THREE.BackSide, transparent: true, opacity: 0.5 });
            // Move the walls up to the floor
            cylGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, self.BEDSIZE_Z_MM / 2, 0));
            var wall = new THREE.Mesh(cylGeometry, wallMaterial);
            //rotate the walls so they are upright
            wall.rotation.x = Math.PI / 2;
            self.walls.add(wall);

            //Add text to indicate front of print bed
            (new THREE.FontLoader()).load( PLUGIN_BASEURL + "slicer/static/js/optimer_bold.typeface.json", function ( font ) {
                self.createText(font, "Front", bedRadius * 2, bedRadius * 2, self.floor);
                self.stlViewPort.render();
            } );
        }

        self.drawBedFloor = function ( width, depth, segments ) {
            for(var i = self.floor.children.length - 1; i >= 0; i--) {
                var obj = self.floor.children[i];
                self.floor.remove(obj);
            }
            var xSegments = segments || self.BEDSIZE_X_MM / 20;
            var ySegments = segments || self.BEDSIZE_Y_MM / 20;

            var geometry = new THREE.PlaneBufferGeometry(width, depth);
            var material = new CheckerboardMaterial(xSegments, ySegments, null, function() { self.stlViewPort.render(); });
            var mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            self.floor.add(mesh);

            //Add text to indicate front/back of print bed
            (new THREE.FontLoader()).load( PLUGIN_BASEURL + "slicer/static/js/optimer_bold.typeface.json", function ( font ) {
                self.createText(font, "Front", width, depth, self.floor);
                self.createText(font, "Back", width, depth, self.floor);
                self.createText(font, "Left", width, depth, self.floor);
                self.createText(font, "Right", width, depth, self.floor);
                self.stlViewPort.render();
            } );
        };

        self.drawWalls = function ( width, depth, height ) {
            for(var i = self.walls.children.length - 1; i >= 0; i--) {
                var obj = self.walls.children[i];
                self.walls.remove(obj);
            }

            var wall1 = self.rectShape(width, height, 0x8888fc);
            wall1.rotation.x = Math.PI / 2;
            wall1.position.set(0, depth/2, height/2);
            self.walls.add(wall1);

            var wall2 = self.rectShape(height, depth, 0x8888dc);
            wall2.rotation.y = Math.PI / 2;
            wall2.position.set(-width/2, 0, height/2);
            self.walls.add(wall2);

            var wall3 = self.rectShape(width, height, 0x8888fc);
            wall3.rotation.x = -Math.PI / 2;
            wall3.position.set(0, -depth/2, height/2);
            self.walls.add(wall3);

            var wall4 = self.rectShape(height, depth, 0x8888dc);
            wall4.rotation.y = -Math.PI / 2;
            wall4.position.set(width/2, 0, height/2);
            self.walls.add(wall4);
        };

        self.rectShape = function ( rectLength, rectWidth, color ) {
            var rectShape = new THREE.Shape();
            rectShape.moveTo(-rectLength/2,-rectWidth/2);
            rectShape.lineTo(-rectLength/2, rectWidth/2);
            rectShape.lineTo(rectLength/2, rectWidth/2);
            rectShape.lineTo(rectLength/2, -rectWidth/2);
            rectShape.lineTo(-rectLength/2, -rectWidth/2);
            var rectGeom = new THREE.ShapeGeometry(rectShape);
            return new THREE.Mesh(rectGeom, new THREE.MeshBasicMaterial({ color: color }));
        };
        // END: Helpers for drawing walls and floor

        self.init();
    }

    function ModelManager(slicingViewModel) {
        var self = this;
        self.slicingViewModel = slicingViewModel;
        self.models = [];

        self.add = function(model, target, filename) {
            self.models.push(model);
            self.setSlicingViewModel(target, filename);
        };

        self.remove = function(model) {
            _.remove(self.models, model);
            self.resetSlicingViewModel();
        };

        self.removeAll = function() {
            self.models = [];
            self.resetSlicingViewModel();
        };

        self.resetSlicingViewModel = function() {
            if (self.models.length == 0 && self.slicingViewModel.destinationFilename()) { // Last model is removed from bed
                self.slicingViewModel.target = undefined;
                self.slicingViewModel.file(undefined);
                self.slicingViewModel.destinationFilename(undefined);
            }
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

        self.onlyOneOriginalModel = function() {
            return self.models.length == 1  &&
                self.models[0].position.x == 0.0 &&
                self.models[0].position.y == 0.0 &&
                self.models[0].rotation.x == 0.0 &&
                self.models[0].rotation.y == 0.0 &&
                self.models[0].rotation.z == 0.0 &&
                self.models[0].scale.x == 1.0 &&
                self.models[0].scale.y == 1.0 &&
                self.models[0].scale.z == 1.0
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        SlicerViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        [ "slicingViewModel", "overridesViewModel", "printerStateViewModel", "printerProfilesViewModel" ],

        // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
        [ "#slicer" ]
    ]);
});
