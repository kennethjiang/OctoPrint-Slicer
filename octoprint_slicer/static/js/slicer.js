/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */

'use strict';
$(function() {
    function SlicerViewModel(parameters) {
        var self = this;
        self.canvas = document.getElementById( 'slicer-canvas' );
	self.stlFiles = [];

        //check if webGL is present. If not disable Slicer plugin
        try {
            var ctx = self.canvas.getContext('webgl') || self.canvas.getContext('experimental-webgl');
            var exts = ctx.getSupportedExtensions();
        }
        catch (e) {
            $('#tab_plugin_slicer').empty().append("<h3>Slicer Plugin is disabled because your browser doesn't support WebGL</h3>");
            return;
        }

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        // self.settingsViewModel = parameters[1];
        self.slicingViewModel = parameters[0];
        self.basicOverridesViewModel = parameters[1];
        self.advancedOverridesViewModel = parameters[2];
        self.printerStateViewModel = parameters[3];

        self.lockScale = true;

	// Returns the destination filename based on which models are loaded.
	// The destination filename is without the final .gco on it because
	// that will depend on the slicer.
	self.computeDestinationFilename = function(inputFilenames) {
	    // TODO: For now, just use the first model's name.
	    var destinationFilename = inputFilenames[0].substr(0, inputFilenames[0].lastIndexOf("."));
	    if (destinationFilename.lastIndexOf("/") != 0) {
                destinationFilename = destinationFilename.substr(destinationFilename.lastIndexOf("/") + 1);
	    }
	    return destinationFilename;
	}

        // Override slicingViewModel.show to surpress default slicing behavior
        self.slicingViewModel.show = function(target, file, force) {
	    self.stlFiles.push({target: target, file: file, force: force});
	    if (self.stlFiles.length == 1) {
		// This is the first model.
		self.slicingViewModel.requestData();
		self.slicingViewModel.target = target;
		self.slicingViewModel.file(file); // TODO: Do we need to fix this?
		self.slicingViewModel.printerProfile(self.slicingViewModel.printerProfiles.currentProfile());
		self.stlModified = false;
	    } else {
	    	self.stlModified = true;
	    }
	    self.slicingViewModel.destinationFilename(
		self.computeDestinationFilename(
		    _.map(self.stlFiles, function(m) {
			return m.file;
		    })));
            $('a[href="#tab_plugin_slicer"]').tab('show');
            self.loadSTL(target, file, force, self.stlFiles[self.stlFiles.length-1]);
        };

        // Print bed size
        self.BEDSIZE_X_MM = 200;
        self.BEDSIZE_Y_MM = 200;
        self.BEDSIZE_Z_MM = 200;
        self.ORIGIN_OFFSET_X_MM = 0;
        self.ORIGIN_OFFSET_Y_MM = 0;

        self.updatePrinterProfile = function(printerProfile) {
            if (! self.printerProfiles) {
                $.ajax({
                    url: API_BASEURL + "printerprofiles",
                    type: "GET",
                    dataType: "json",
                    success: function(data) {
                        self.printerProfiles = data;
                        self.updatePrinterBed(printerProfile);
                    }
                });
            } else {
                self.updatePrinterBed(printerProfile);
            }
        }

        self.slicingViewModel.printerProfile.subscribe( self.updatePrinterProfile );

        self.updatePrinterBed = function(printerProfile) {
            if ( self.printerProfiles && printerProfile ) {
                var dim = self.printerProfiles.profiles[printerProfile].volume
                self.BEDSIZE_X_MM = dim.width;
                self.BEDSIZE_Y_MM = dim.depth;
                self.BEDSIZE_Z_MM = dim.height;
                if ( self.printerProfiles.profiles[printerProfile]["volume"]["origin"] == "lowerleft" ) {
                    self.ORIGIN_OFFSET_X_MM = self.BEDSIZE_X_MM/2.0;
                    self.ORIGIN_OFFSET_Y_MM = self.BEDSIZE_Y_MM/2.0;
                } else {
                    self.ORIGIN_OFFSET_X_MM = 0;
                    self.ORIGIN_OFFSET_Y_MM = 0;
                }
            }
            self.drawBedFloor(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM);
            self.drawWalls(self.BEDSIZE_X_MM, self.BEDSIZE_Y_MM, self.BEDSIZE_Z_MM);
        }

        var CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;

        self.effectController = {
            metalness: 0.5,
	    roughness: 0.5,
	    modelInactiveColor: new THREE.Color("#60715b"),
	    modelActiveColor: new THREE.Color("#34bf0d"),
	    ambientLightColor: new THREE.Color("#2b2b2b"),
	    directionalLightColor: new THREE.Color("#ffffff"),
        };

        self.init = function() {
            self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 5000 );
            self.camera.up.set( 0, 0, 1 );
            self.camera.position.set( -100, -200, 250 );
            self.scene = new THREE.Scene();

            // Lights
            var ambientLight = new THREE.AmbientLight( self.effectController.ambientLightColor );  // 0.2
            self.scene.add( ambientLight );
            var directionalLight = new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
            directionalLight.position.set( 100, 100, 500 );
            self.scene.add( directionalLight );
            var directionalLight2= new THREE.DirectionalLight(self.effectController.directionalLightColor, 1.0);
            directionalLight2.position.set( 100, 100, -500);
            self.scene.add( directionalLight2);

            //Walls and Floor
            self.walls = new THREE.Object3D();
            self.floor = new THREE.Object3D();
            self.scene.add(self.walls);
            self.scene.add(self.floor);

            self.renderer = new THREE.WebGLRenderer( { canvas: self.canvas, antialias: true } );
            self.renderer.setClearColor( 0xd8d8d8 );
            self.renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
            self.renderer.setPixelRatio( window.devicePixelRatio );

            self.renderer.gammaInput = true;
            self.renderer.gammaOutput = true;

            $("#slicer-viewport").empty().append('<div class="model">\
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
                    <button class="arrange" title="Arrange"><img src="'
                + PLUGIN_BASEURL
                + 'slicer/static/img/arrange.png"></button>\
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

            $("#slicer-viewport").append(self.renderer.domElement);
            self.orbitControls = new THREE.OrbitControls(self.camera, self.renderer.domElement);
            self.orbitControls.enableDamping = true;
            self.orbitControls.dampingFactor = 0.25;
            self.orbitControls.enablePan = false;
            self.orbitControls.addEventListener("change", self.render);

            self.transformControls = new THREE.TransformControls(self.camera, self.renderer.domElement);
            self.transformControls.space = "world";
            //self.transformControls.setAllowedTranslation("XY");
            //self.transformControls.setRotationDisableE(true);
            self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) )
            self.transformControls.addEventListener("change", self.render);
            self.transformControls.addEventListener("mouseDown", self.startTransform);
            self.transformControls.addEventListener("mouseUp", self.endTransform);
            self.transformControls.addEventListener("change", self.updateTransformInputs);
            self.transformControls.addEventListener("objectChange", function (e) {self.stlModified = true});
            self.scene.add(self.transformControls);
            self.updatePrinterBed();

            $("#slicer-viewport button.translate").click(function(event) {
                // Set selection mode to translate
                self.transformControls.setMode("translate");
                self.toggleValueInputs($("#slicer-viewport .translate.values div"));
            });
            $("#slicer-viewport button.rotate").click(function(event) {
                // Set selection mode to rotate
                self.transformControls.setMode("rotate");
                self.toggleValueInputs($("#slicer-viewport .rotate.values div"));
            });
            $("#slicer-viewport button.scale").click(function(event) {
		// Set selection mode to scale
		self.transformControls.setMode("scale");
                self.toggleValueInputs($("#slicer-viewport .scale.values div"));
            });
            $("#slicer-viewport button.arrange").click(function(event) {
              var rectangles = [];
              for (var i = 0; i < self.stlFiles.length; i++ ) {
                var model = self.stlFiles[i].model;
                var smallestRectangle = {"name": i};
                for (var rotation = 0; rotation < THREE.Math.degToRad(90); rotation += THREE.Math.degToRad(15)) {
                  var modelClone = model.clone(true);
                  modelClone.rotation.z += rotation;
                  var modelBox = new THREE.Box3().setFromObject(modelClone);
                  var width = modelBox.max.x - modelBox.min.x;
                  var height = modelBox.max.y - modelBox.min.y;
                  if (!smallestRectangle.hasOwnProperty("prerotation") ||
                      width * height < smallestRectangle.width * smallestRectangle.height) {
                    // If the width and height are similar enough, round up the smaller and make it a square.
                    if (width/height < 1.05 && width/height > 1 / 1.05) {
                      smallestRectangle["width"] = Math.max(width, height);
                      smallestRectangle["height"] = Math.max(width, height);
                    } else {
                      smallestRectangle["width"] = width;
                      smallestRectangle["height"] = height;
                    }
                    smallestRectangle["prerotation"] = rotation;
                  }
                }
                rectangles.push(smallestRectangle);
              }


	      // Set selection mode to scale
/*                {name:0, width: 7, height: 10},
                {name:1, width: 7, height: 10},
                {name:2, width: 7, height: 10},
                {name:3, width: 7, height: 10},
                {name:4, width: 3, height: 3}
                ];*/
              /*var rectangles = [];
              for (var i=1; i < 8; i++) {
                rectangles.push({"name": i, "width":i, "height":i});
                }*/
              var best;
              var tries = 0;
              var start = performance.now();
              RectanglePacker.pack(
                  rectangles, function(x) {
                    tries++;
                    // Success.  But is it best?
                    if (!best) {
                      best = x;
                    } else if (Math.max(x.width, x.height) < Math.max(best.width, best.height)) {
                      best = x;
                    } else {
                      // Count rotations.
                      var bestRotationCount = 0;
                      for (var i in best.placements) {
                        bestRotationCount += best.placements[i].rotations ? 1 : 0;
                      }
                      var rotationCount = 0;
                      for (var i in x.placements) {
                        rotationCount += x.placements[i].rotations ? 1 : 0;
                      }
                      if (rotationCount < bestRotationCount) {
                        best = x;
                      }
                    }
                    //console.log(x.rectangleGrid.gridToString(x.width, x.height, 1, "  ", function(y) { return y.name; }));
                    //console.log(x.placements);
                });
              console.log(performance.now() - start);
              console.log(tries);
              //console.log(best.rectangleGrid.gridToString(best.width, best.height, 1, "  ", function(y) { return y.name; }));
              console.log(best.placements);
              // Now apply the best to the existing models.
              for (var i = 0; i < self.stlFiles.length; i++ ) {
                var model = self.stlFiles[i].model;
                model.rotation.z += rectangles[i].prerotation + THREE.Math.degToRad(best.placements[i].rotation);
                var modelBox = new THREE.Box3().setFromObject(model);
                // i is also the name.  The RectanglePacker assumes
                // the back left corner is 0,0.  x cross y is reversed
                // from the platform.
                var width = modelBox.max.x - modelBox.min.x;
                var height = modelBox.max.y - modelBox.min.y;
                model.position.x += (best.placements[i].x - best.width/2 + best.placements[i].x + width - best.width/2)/2 - modelBox.center().x;
                model.position.y += (-best.placements[i].y + best.height/2 - best.placements[i].y - height + best.height/2)/2 - modelBox.center().y;
              }
              self.updateTransformInputs();
              self.render();
            });
            $("#slicer-viewport button.remove").click(function(event) {
		// Remove the currently selected object.
                self.removeSTL();
            });
            $("#slicer-viewport .values input").change(function() {
                self.applyChange($(this));
            });

            ko.applyBindings(self.slicingViewModel, $('#slicing-settings')[0]);

            window.addEventListener( 'keydown', function ( event ) {
                switch ( event.keyCode ) {
                    case 17: // Ctrl
                        self.transformControls.setRotationSnap(null);
                        break;
                }
            });

            window.addEventListener( 'keyup', function ( event ) {
                switch ( event.keyCode ) {
                    case 17: // Ctrl
                        self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) );
                        break;
                }
            });

	    self.canvas.addEventListener("click", function(e) {
		var rect = self.canvas.getBoundingClientRect();
		var x = (e.clientX - rect.left) / rect.width;
		var y = (e.clientY - rect.top) / rect.height;

		var pointerVector = new THREE.Vector2();
		pointerVector.set((x*2) - 1, -(y*2) + 1);
		var ray = new THREE.Raycaster();
		ray.setFromCamera(pointerVector, self.camera);

		// Clicking should cycle through the stlFiles if there are multiple under the cursor.
		var foundActiveStlFile = false;
		var nextPointedStlFile = undefined;
		var firstPointedStlFile = undefined;
		for (var i = 0; i < self.stlFiles.length; i++) {
		    var stlFile = self.stlFiles[i];
		    var intersections = ray.intersectObjects( [stlFile.model], true );
		    if (!intersections[0]) {
			continue;
		    }
		    if (!firstPointedStlFile) {
			firstPointedStlFile = stlFile;
		    }
		    if (foundActiveStlFile && !nextPointedStlFile) {
			nextPointedStlFile = stlFile;
		    }
		    if (self.isStlFileActive(stlFile)) {
			foundActiveStlFile = true;
		    }
		}
		if (nextPointedStlFile) {
		    self.setStlFileActive(nextPointedStlFile);
		} else if (firstPointedStlFile) {
		    self.setStlFileActive(firstPointedStlFile);
		}
	    });
        };

	self.isStlFileActive = function(stlFile) {
	    return stlFile.model.children[0].material.color.equals(self.effectController.modelActiveColor);
	};

	self.setStlFileActive = function(stlFile) {
            // Sets one file active and inactivates all the others.
	    var newActiveStl = false;
	    _.forEach(self.stlFiles, function (otherStlFile) {
		if (otherStlFile == stlFile) {
		    if (!self.isStlFileActive(otherStlFile)) {
			otherStlFile.model.children[0].material.color.copy(self.effectController.modelActiveColor);
			newActiveStl = true;
		    }
		} else {
		    otherStlFile.model.children[0].material.color.copy(self.effectController.modelInactiveColor);
		}
	    });
	    if (newActiveStl) {
		self.transformControls.attach(stlFile.model);
		//self.transformControls.setMode("rotate");
		self.updateTransformInputs();
	    }
            if (!stlFile) {
                $("#slicer-viewport .values div").removeClass("show")
                $("#slicer-viewport button").addClass("disabled");
            } else {
                $("#slicer-viewport button").removeClass("disabled");
            }
            self.render();
	};

        self.removeSTL = function() {
            // Remove all active STL files.
            var firstRemoved;
            for (var i = 0; i < self.stlFiles.length; i++) {
                var stlFile = self.stlFiles[i];
                if (self.isStlFileActive(stlFile)) {
                    self.scene.remove(stlFile.model);
                    firstRemoved = i;
                }
                if (self.transformControls.object == stlFile.model) {
                    self.transformControls.detach();
                }
            };
            _.remove(self.stlFiles, function (stlFile) {
                return self.isStlFileActive(stlFile);
            });
            if (firstRemoved < self.stlFiles.length) {
                self.setStlFileActive(self.stlFiles[firstRemoved]);
            } else if (0 < self.stlFiles.length) {
                self.setStlFileActive(self.stlFiles[0]);
            } else {
                self.setStlFileActive();
            }
            self.render();
        };

        self.loadSTL = function(target, file, force, stlFile) {
            var loader = new THREE.STLLoader();
            return loader.load(BASEURL + "downloads/files/" + target + "/" + file, function ( geometry ) {
                var material = new THREE.MeshStandardMaterial({
		    color: self.effectController.modelInactiveColor,  // We'll mark it active below.
		    shading: THREE.SmoothShading,
		    side: THREE.DoubleSide,
		    metalness: self.effectController.metalness,
		    roughness: self.effectController.roughness });

                // center model's origin
                var stlModel = new THREE.Mesh( geometry, material );
                var center = new THREE.Box3().setFromObject(stlModel).center()
                var model = new THREE.Object3D();
                model.add(stlModel);
                stlModel.position.copy(center.negate());
		stlFile['model'] = model;
		self.setStlFileActive(stlFile);
                self.scene.add(model);
                self.render();
            });
        };

        self.toggleValueInputs = function(parentDiv) {
            if ( parentDiv.hasClass("show") ) {
                parentDiv.removeClass("show").children('p').removeClass("show");
            } else if (self.transformControls.object) {
                $("#slicer-viewport .values div").removeClass("show");
                parentDiv.addClass("show").children('p').addClass("show");
            }
        };

        self.applyChange = function(input) {
            input.blur();
            if(input[0].type == "checkbox") {
                self.lockScale = input[0].checked;
            }
            else if(input[0].type == "number" && !isNaN(parseFloat(input.val()))) {
                self.stlModified = true;
                input.val(parseFloat(input.val()).toFixed(3));
                var model = self.transformControls.object;

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
                self.render();
            }
        };

        self.startTransform = function () {
            // Disable orbit controls
            self.orbitControls.enabled = false;
        };

        self.endTransform = function () {
            // Enable orbit controls
            self.orbitControls.enabled = true;
        };

        self.updateTransformInputs = function () {
            var model = self.transformControls.object;
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
            }
            self.render();
        };

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
                    mesh.position.set(-textWidth/2.0, -depth/2.0, 1.0);
                    break;
                case "Back":
                    mesh.position.set(-textWidth/2.0, depth/2.0-textHeight, 1.0);
                    break;
                case "Left":
                    mesh.position.set(-width/2.0, -textHeight/2, 1.0);
                    break;
                case "Right":
                    mesh.position.set(width/2.0-textWidth, -textHeight/2, 1.0);
                    break;
            }
            parentObj.add(mesh);
        };

        self.drawBedFloor = function ( width, depth, segments ) {
            for(var i = self.floor.children.length - 1; i >= 0; i--) {
                 var obj = self.floor.children[i];
                 self.floor.remove(obj);
            }

            segments = segments || 20;
            var geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
            var materialEven = new THREE.MeshBasicMaterial({color: 0xccccfc});
            var materialOdd = new THREE.MeshBasicMaterial({color: 0x444464});
            var materials = [materialEven, materialOdd];
            for (var x = 0; x < segments; x++) {
              for (var y = 0; y < segments; y++) {
                var i = x * segments + y;
                var j = 2 * i;
                geometry.faces[ j ].materialIndex = geometry.faces[ j + 1 ].materialIndex = (x + y) % 2;
              }
            }
            var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
            mesh.receiveShadow = true;
            self.floor.add(mesh);

            //Add text to indicate front/back of print bed
            var loader = new THREE.FontLoader();
            loader.load( PLUGIN_BASEURL + "slicer/static/js/optimer_bold.typeface.json", function ( font ) {
                self.createText(font, "Front", width, depth, self.floor);
                self.createText(font, "Back", width, depth, self.floor);
                self.createText(font, "Left", width, depth, self.floor);
                self.createText(font, "Right", width, depth, self.floor);
                self.render();
            } );
        };

        self.drawWalls = function ( width, depth, height ) {
            for(var i = self.walls.children.length - 1; i >= 0; i--) {
                 var obj = self.walls.children[i];
                 self.walls.remove(obj);
            }

            var wall1 = self.rectShape( width, height, 0x8888fc );
            wall1.rotation.x = Math.PI / 2;
            wall1.position.set(0, depth/2, height/2);
            self.walls.add(wall1);

            var wall2 = self.rectShape( height, depth, 0x8888dc );
            wall2.rotation.y = Math.PI / 2;
            wall2.position.set(-width/2, 0, height/2);
            self.walls.add(wall2);

            var wall3 = self.rectShape( width, height, 0x8888fc );
            wall3.rotation.x = -Math.PI / 2;
            wall3.position.set(0, -depth/2, height/2);
            self.walls.add(wall3);

            var wall4 = self.rectShape( height, depth, 0x8888dc );
            wall4.rotation.y = -Math.PI / 2;
            wall4.position.set(width/2, 0, height/2);
            self.walls.add(wall4);
        }

        self.rectShape = function ( rectLength, rectWidth, color ) {
            var rectShape = new THREE.Shape();
            rectShape.moveTo( -rectLength/2,-rectWidth/2 );
            rectShape.lineTo( -rectLength/2, rectWidth/2 );
            rectShape.lineTo( rectLength/2, rectWidth/2 );
            rectShape.lineTo( rectLength/2, -rectWidth/2 );
            rectShape.lineTo( -rectLength/2, -rectWidth/2 );
            var rectGeom = new THREE.ShapeGeometry( rectShape );
            return new THREE.Mesh( rectGeom, new THREE.MeshBasicMaterial( { color: color } ) ) ;
        }

        self.fixZPosition = function ( model ) {
            var bedLowMinZ = 0.0;
            var boundaryBox = new THREE.Box3().setFromObject(model);
            boundaryBox.min.sub(model.position);
            boundaryBox.max.sub(model.position);
            model.position.z -= model.position.z + boundaryBox.min.z - bedLowMinZ;
        }

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
            _.extend(data, self.basicOverridesViewModel.toJS());
            _.extend(data, self.advancedOverridesViewModel.toJS());

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
	    if (!self.stlModified) {
		self.sendSliceCommand(self.slicingViewModel.file());
	    } else {
		var form = new FormData();
		var extensionPosition = self.slicingViewModel.file().lastIndexOf(".")
		var newFilename = self.computeDestinationFilename(
		    _.map(self.stlFiles, function(m) {
			return m.file;
		    })) +
		    ".tmp." + (+ new Date()) +
		    self.slicingViewModel.file().substring(extensionPosition);
		var group = new THREE.Group();
		_.forEach(self.stlFiles, function (stlFile) {
		    var modelCopy = stlFile.model.clone(true);
		    group.add(modelCopy);
		});
		form.append("file", self.blobFromModel(group), newFilename);
		$.ajax({
                    url: API_BASEURL + "files/local",
                    type: "POST",
                    data: form,
                    processData: false,
                    contentType: false,
                    // On success
                    success: function(data) {
			self.tempFiles[newFilename] = 1;
			self.sendSliceCommand(newFilename, group);
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

        self.render = function() {
            self.orbitControls.update();
            self.transformControls.update();
            self.renderer.render( self.scene, self.camera );
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

        self.init();
        self.render();
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        SlicerViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        [ "slicingViewModel", "basicOverridesViewModel", "advancedOverridesViewModel", "printerStateViewModel" ],

        // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
        [ "#slicer" ]
    ]);
});
