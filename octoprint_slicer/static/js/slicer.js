/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
$(function() {
    function SlicerViewModel(parameters) {
        var self = this;

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        // self.settingsViewModel = parameters[1];
        self.slicingViewModel = parameters[0];
        self.basicOverridesViewModel = parameters[1];
        self.advancedOverridesViewModel = parameters[2];

        // Override slicingViewModel.show to surpress default slicing behavior
        self.slicingViewModel.show = function(target, file, force) {
            self.slicingViewModel.requestData();
            self.slicingViewModel.target = target;
            self.slicingViewModel.file(file);
            self.slicingViewModel.destinationFilename(self.slicingViewModel.file().substr(0, self.slicingViewModel.file().lastIndexOf(".")));
            self.slicingViewModel.printerProfile(self.slicingViewModel.printerProfiles.currentProfile());

            $('a[href="#tab_plugin_slicer"]').tab('show');
            self.loadSTL(target, file, force);
        };

        var CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588,

            BEDSIZE_X_MM = 200,
            BEDSIZE_Y_MM = 200,
            BEDSIZE_Z_MM = 200;


        self.init = function() {
            self.container = document.getElementById( 'slicer-canvas' );

            self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 5000 );
            self.camera.up.set( 0, 0, 1 );
            self.camera.position.set( -100, -200, 250 );
            self.scene = new THREE.Scene();
            self.drawBedFloor(BEDSIZE_X_MM, BEDSIZE_Y_MM);
            self.drawWalls(BEDSIZE_X_MM, BEDSIZE_Y_MM, BEDSIZE_Z_MM);

            // Lights
            self.scene.add( new THREE.AmbientLight(0xffffff, 1.0) );
            var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.8 );
            directionalLight.castShadow = true;
            directionalLight.position.set( 0, 0, 500 );
            self.scene.add( directionalLight );

            self.renderer = new THREE.WebGLRenderer( { antialias: true } );
            self.renderer.setClearColor( 0xd8d8d8 );
            self.renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
            self.renderer.shadowMapEnabled = true;
            self.renderer.setPixelRatio( window.devicePixelRatio );

            self.renderer.gammaInput = true;
            self.renderer.gammaOutput = true;

            $("#slicer-viewport").empty().append(`
                    <div class="model">
                    <button class="rotate" title="Rotate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/rotate.png"></button>
                    </div>
                    <div class="values rotate">
                    <div>
                    <p><span class="axis x">X</span><input type="number" step="any" name="x" min=""><span title="">°</span></p>
                    <p><span class="axis y">Y</span><input type="number" step="any" name="y" min=""><span title="">°</span></p>
                    <p><span class="axis z">Z</span><input type="number" step="any" name="z" min=""><span title="">°</span></p>
                    <span></span>
                    </div>
                    </div>
                    `);

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
            self.scene.add(self.transformControls);

            $("#slicer-viewport button.rotate").click(function(event) {
                // Set selection mode to rotate
                self.transformControls.setMode("rotate");
                $("#slicer-viewport button.rotate").removeClass("disabled");
                $("#slicer-viewport .values div").removeClass("show")
                    $("#slicer-viewport .rotate.values div").addClass("show").children('p').addClass("show");
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

        };

        self.loadSTL = function(target, file) {
            if (self.model) {
                self.scene.remove(self.model);
                self.transformControls.detach();
            }

            var loader = new THREE.STLLoader();
            loader.load(BASEURL + "downloads/files/" + target + "/" + file, function ( geometry ) {
                var material = new THREE.MeshPhongMaterial({color: 0xff5533, specular: 0xff5533});
                self.model = new THREE.Mesh( geometry, material );
                self.model.castShadow = true;

                self.scene.add( self.model );
                self.transformControls.attach(self.model);
                self.transformControls.setMode("rotate");
                self.updateTransformInputs();
                self.render();
            } );
        };

        self.applyChange = function(input) {
            input.blur();
            if(!isNaN(parseFloat(input.val()))) {
                input.val(parseFloat(input.val()).toFixed(3));
                var model = self.transformControls.object;

                if (input.closest(".values").hasClass("rotate")) {
                    switch(input.attr("name")) {
                        case "x":
                            model.rotation.x = THREE.Math.degToRad(parseFloat(input.val()));
                            break;
                        case "y":
                            model.rotation.y = THREE.Math.degToRad(parseFloat(input.val()));
                            break;
                        case "z":
                            model.rotation.z = THREE.Math.degToRad(parseFloat(input.val()));
                            break;
                    }
                }
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
            $("#slicer-viewport .rotate.values input[name=\"x\"]").val((model.rotation.x * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"y\"]").val((model.rotation.y * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"z\"]").val((model.rotation.z * 180 / Math.PI).toFixed(3)).attr("min", '');
            self.fixZPosition(model);
            self.render();
        };

        self.drawBedFloor = function ( width, depth, segments ) {
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
            self.scene.add(mesh);
        };

        self.drawWalls = function ( width, depth, height ) {
            var wall1 = self.rectShape( depth, height, 0x8888fc );
            wall1.rotation.x = Math.PI / 2;
            wall1.position.set(0, depth/2, height/2);
            self.scene.add(wall1);

            var wall2 = self.rectShape( width, height, 0x8888dc );
            wall2.rotation.y = Math.PI / 2;
            wall2.position.set(-width/2, 0, height/2);
            self.scene.add(wall2);

            var wall3 = self.rectShape( depth, height, 0x8888fc );
            wall3.rotation.x = -Math.PI / 2;
            wall3.position.set(0, -depth/2, height/2);
            self.scene.add(wall3);

            var wall4 = self.rectShape( width, height, 0x8888dc );
            wall4.rotation.y = -Math.PI / 2;
            wall4.position.set(width/2, 0, height/2);
            self.scene.add(wall4);
        }

        self.rectShape = function ( rectLength, rectWidth, color ) {
            var rectShape = new THREE.Shape();
            rectShape.moveTo( -rectLength/2,-rectWidth/2 );
            rectShape.lineTo( -rectLength/2, rectWidth/2 );
            rectShape.lineTo( rectLength/2, rectWidth/2 );
            rectShape.lineTo( rectLength/2, -rectWidth/2 );
            rectShape.lineTo( -rectLength/2, -rectWidth/2 );
            var rectGeom = new THREE.ShapeGeometry( rectShape );
            return new THREE.Mesh( rectGeom, new THREE.MeshBasicMaterial( { color } ) ) ;
        }

        self.fixZPosition = function ( model ) {
            var bedLowMinZ = 0.0;
            var boundaryBox = new THREE.Box3().setFromObject(model);
            boundaryBox.min.sub(model.position);
            boundaryBox.max.sub(model.position);
            model.position.z -= model.position.z + boundaryBox.min.z - bedLowMinZ;
        }

        self.slice = function() {
            var form = new FormData();
            form.append("file", self.blobFromModel(self.model), self.slicingViewModel.file());
            $.ajax({
                url: API_BASEURL + "files/local",
                type: "POST",
                data: form,
                processData: false,
                contentType: false,
                // On success
                success: function(data) {
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

                    var data = {
                        command: "slice",
                        slicer: slicingVM.slicer(),
                        profile: slicingVM.profile(),
                        printerProfile: slicingVM.printerProfile(),
                        destination: destinationFilename,
                    };
                    _.extend(data, self.basicOverridesViewModel.toJS());
                    _.extend(data, self.advancedOverridesViewModel.toJS());

                    if (slicingVM.afterSlicing() == "print") {
                        data["print"] = true;
                    } else if (slicingVM.afterSlicing() == "select") {
                        data["select"] = true;
                    }

                    $.ajax({
                        url: API_BASEURL + "files/" + slicingVM.target + "/" + slicingVM.file(),
                        type: "POST",
                        dataType: "json",
                        contentType: "application/json; charset=UTF-8",
                        data: JSON.stringify(data)
                    });
                }
            });
        };

        self.blobFromModel = function( model ) {
    	    var exporter = new THREE.STLBinaryExporter();
    	    return new Blob([exporter.parse(model)], {type: "text/plain"});
        }

        self.render = function() {
            self.orbitControls.update();
            self.transformControls.update();
            self.renderer.render( self.scene, self.camera );
        };

        self.init();
        self.render();
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        SlicerViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        [ "slicingViewModel", "basicOverridesViewModel", "advancedOverridesViewModel" ],

        // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
        [ "#slicer" ]
    ]);
});
