/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
$(function() {
    function PositionConverter() {
        self = this;

        self.threejsToPrinter = function( vector3 ) {
            // X -> -X, Z -> Y, Y -> Z
            return THREE.Vector3( -vector3.x, vector3.z, vector3.y );
        };

        self.printerToThreejs = function( vector3 ) {
            // X -> -X, Z -> Y, Y -> Z
            return THREE.Vector3( -vector3.x, vector3.z, vector3.y );
        };

    };

    function RotationConverter() {
        self = this;

        self.threejsToPrinter = function( euler ) {
            return {
                x: THREE.Math.radToDeg(euler.x - 3 * Math.PI / 2),
                y: THREE.Math.radToDeg(euler.y),
                z: THREE.Math.radToDeg(euler.z - Math.PI)
            };
        };

        self.printerToThreejs = function( x, y, z ) {
            return new THREE.Vector3(
                    THREE.Math.degToRad(x) + 3 * Math.PI / 2,
                    THREE.Math.degToRad(y),
                    THREE.Math.degToRad(z) + Math.PI);
        };

    };


    function SlicerViewModel(parameters) {
        var self = this;

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        // self.settingsViewModel = parameters[1];
        self.slicingViewModel = parameters[0];

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
            self.models = [];
            self.posConverter = new PositionConverter();
            self.rotConverter = new RotationConverter();

            self.container = document.getElementById( 'slicer-canvas' );

            self.camera = new THREE.PerspectiveCamera( 55, 1.0, 0.1, 5000 );
            self.camera.position.set( 200, 200, 100 );
            self.scene = new THREE.Scene();
            self.drawBedFloor(BEDSIZE_X_MM, BEDSIZE_Y_MM);
            self.drawWalls(BEDSIZE_X_MM, BEDSIZE_Z_MM, BEDSIZE_Y_MM);

            // Lights
            self.scene.add( new THREE.AmbientLight(0xffffff, 1.0) );
            var dirLight = new THREE.DirectionalLight(0xF8F81F, 1);
            dirLight.position.set(0, 500, 500);
            self.scene.add(dirLight);

            // renderer

            self.renderer = new THREE.WebGLRenderer( { antialias: true } );
            self.renderer.setClearColor( 0xd8d8d8 );
            self.renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
            self.renderer.setPixelRatio( window.devicePixelRatio );

            self.renderer.gammaInput = true;
            self.renderer.gammaOutput = true;

            $("#slicer-viewport").empty().append(`
                    <div class="model">
                    <button class="translate disabled" title="Translate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/translate.png"></button>
                    <button class="rotate" title="Rotate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/rotate.png"></button>
                    <button class="scale" title="Scale"><img src="` + PLUGIN_BASEURL + `slicer/static/img/scale.png"></button>
                    </div>
                    <div class="values translate">
                    <div>
                    <p><span class="axis x">X</span><input type="number" step="any" name="x" min=""><span title="">mm</span></p>
                    <p><span class="axis y">Y</span><input type="number" step="any" name="y" min=""><span title="">mm</span></p>
                    <span></span>
                    </div>
                    </div>
                    <div class="values rotate">
                    <div>
                    <p><span class="axis x">X</span><input type="number" value="0.0" step="any" name="x" min=""><span title="">°</span></p>
                    <p><span class="axis y">Y</span><input type="number" value="0.0" step="any" name="y" min=""><span title="">°</span></p>
                    <p><span class="axis z">Z</span><input type="number" value="0.0" step="any" name="z" min=""><span title="">°</span></p>
                    <span></span>
                    </div>
                    </div>
                    `);

            $("#slicer-viewport").append(self.renderer.domElement);
            self.orbitControls = new THREE.OrbitControls(self.camera, self.renderer.domElement);
            self.orbitControls.enablePan = true;
            self.orbitControls.addEventListener("change", self.render);
            // How far you can dolly in and out ( PerspectiveCamera only )
            self.orbitControls.minDistance = 50;
            self.orbitControls.maxDistance = 1000;

            self.transformControls = new THREE.TransformControls(self.camera, self.renderer.domElement);
            self.transformControls.space = "world";
            self.transformControls.setAllowedTranslation("XZ");
            self.transformControls.setRotationDisableE(true);
            self.transformControls.setRotationSnap( THREE.Math.degToRad( 15 ) )
            self.transformControls.addEventListener("change", self.render);
            self.transformControls.addEventListener("mouseDown", self.startTransform);
            self.transformControls.addEventListener("mouseUp", self.endTransform);
            self.transformControls.addEventListener("change", self.updateTransformInputs);
            self.scene.add(self.transformControls);

            $("#slicer-viewport button.translate").click(function(event) {
                // Set selection mode to translate
                self.transformControls.setMode("translate");
                $("#slicer-viewport button.translate").removeClass("disabled");
                $("#slicer-viewport .values div").removeClass("show")
                    $("#slicer-viewport .translate.values div").addClass("show").children('p').addClass("show");
            });
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

        self.loadSTL = function(target, file, force=true) {
            if (force) {
                self.models.forEach((model) => {
                    self.scene.remove(model);
                });
            }

            var loader = new THREE.STLLoader();
            loader.load(BASEURL + "downloads/files/" + target + "/" + file, function ( geometry ) {
                var material = new THREE.MeshPhongMaterial( { color: 0xF8F81F, specular: 0xF8F81F, shininess: 20, morphTargets: true, vertexColors: THREE.FaceColors, shading: THREE.FlatShading } );
                var mesh = new THREE.Mesh( geometry, material );
                self.setModelRotation(mesh);
                self.models.push(mesh);

                self.scene.add( mesh );
                self.transformControls.attach(mesh);
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
                    self.setModelRotation( model );
                } else if (input.closest(".values").hasClass("translate")) {
                    switch(input.attr("name")) {
                        case "x":
                            model.position.x = -parseFloat(input.val()); // X in model is -X in three.js
                            break;
                        case "y":
                            model.position.z = parseFloat(input.val()); // Z in model is Y in three.js
                            break;
                    }
                }
                self.fixZPosition(model);
                self.render();
            }
        };

        self.setModelRotation = function( model ) {
            model.rotation.setFromVector3( self.rotConverter.printerToThreejs(
                        parseFloat($('.values.rotate input[name="x"]').val()),
                        parseFloat($('.values.rotate input[name="y"]').val()),
                        parseFloat($('.values.rotate input[name="z"]').val()) ) );
        }

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
            var rotation = self.rotConverter.threejsToPrinter( model.rotation );
            $("#slicer-viewport .translate.values input[name=\"x\"]").val((model.position.x.toFixed(3) == 0 ? 0 : -model.position.x).toFixed(3)).attr("min", ''); // X in Model is -X in three.js
            $("#slicer-viewport .translate.values input[name=\"y\"]").val(model.position.z.toFixed(3)).attr("min", ''); // Z in model is Y in three.js
            $("#slicer-viewport .rotate.values input[name=\"x\"]").val(rotation.x.toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"y\"]").val(rotation.y.toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"z\"]").val(rotation.z.toFixed(3)).attr("min", '');
            self.fixZPosition(model);
            self.render();
        };

        self.drawBedFloor = function ( lengthX, lengthZ, segments ) {
            segments = segments || 20;
            var geometry = new THREE.PlaneGeometry(lengthX, lengthZ, segments, segments);
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
            mesh.rotation.x = -Math.PI / 2;
            mesh.receiveShadow = true;
            self.scene.add(mesh);
        };

        self.drawWalls = function ( lengthX, lengthZ, lengthY ) {
            var wall1 = self.rectShape( lengthZ, lengthY, 0x8888fc );
            wall1.rotation.y = - Math.PI / 2;
            wall1.position.set(lengthX/2, lengthY/2, 0);
            self.scene.add(wall1);

            var wall1 = self.rectShape( lengthZ, lengthY, 0x8888fc );
            wall1.rotation.y = Math.PI / 2;
            wall1.position.set(-lengthX/2, lengthY/2, 0);
            self.scene.add(wall1);

            var wall2 = self.rectShape( lengthX, lengthY, 0x8888bc );
            wall2.rotation.x = Math.PI;
            wall2.position.set(0, lengthY/2, lengthZ/2);
            self.scene.add(wall2);

            var wall4 = self.rectShape( lengthX, lengthY, 0x8888bc );
            wall4.position.set(0, lengthY/2,  -lengthZ/2);
            self.scene.add(wall4);
        }

        self.rectShape = function ( lengthX, lengthY, color ) {
            var rectShape = new THREE.Shape();
            rectShape.moveTo( -lengthX/2,-lengthY/2 );
            rectShape.lineTo( -lengthX/2, lengthY/2 );
            rectShape.lineTo( lengthX/2, lengthY/2 );
            rectShape.lineTo( lengthX/2, -lengthY/2 );
            rectShape.lineTo( -lengthX/2, -lengthY/2 );
            var rectGeom = new THREE.ShapeGeometry( rectShape );
            return new THREE.Mesh( rectGeom, new THREE.MeshBasicMaterial( { color } ) ) ;
        }

        self.fixZPosition = function ( model ) {
            var bedLowMinZ = 0.0;
            var boundaryBox = new THREE.Box3().setFromObject(model);
            boundaryBox.min.sub(model.position);
            boundaryBox.max.sub(model.position);
            model.position.y -= model.position.y + boundaryBox.min.y - bedLowMinZ;
        }

        self.slice = function() {
            model = self.models[0];

            // Create request
            var form = new FormData();
            form.append("file", self.blobFromModel(model), self.slicingViewModel.file());
            // Send request
            $.ajax({
                url: API_BASEURL + "files/local",
                type: "POST",
                data: form,
                processData: false,
                contentType: false,
                // On success
                success: function(data) {
                    self.slicingViewModel.slice();
                }
            });
        };

        self.blobFromModel = function( model ) {
    	    var exporter = new THREE.STLBinaryExporter();
    	    return new Blob([exporter.parse(model)], {type: "text/plain"});
        }

        self.render = function() {
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
        [ "slicingViewModel", /* "loginStateViewModel", "settingsViewModel" */ ],

        // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
        [ "#slicer" ]
    ]);
});
