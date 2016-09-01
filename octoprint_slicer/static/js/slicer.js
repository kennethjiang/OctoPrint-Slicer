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

        self.slicingViewModel.show = function(target, file, force) {
            $('a[href="#tab_plugin_slicer"]').tab('show');
            self.loadSTL(target, file, force);
        };

        var CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;

        self.init = function() {
            self.parts = [];
            self.container = document.getElementById( 'slicer-canvas' );

            self.camera = new THREE.PerspectiveCamera( 45, 1.0, 0.1, 100 );
            self.camera.up.set( 0, 0, 1 );
            self.camera.position.set( 2, 6, 4 );
            self.scene = new THREE.Scene();
            self.drawBedFloor(4, 4);
            self.drawWalls(4, 4, 4);

            // Lights
            self.scene.add( new THREE.AmbientLight(0xffffff, 1.0) );

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
            self.transformControls.setAllowedTranslation("XY");
            self.transformControls.setRotationDisableE(true);
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

        };

        self.loadSTL = function(target, file, force=true) {
            if (force) {
                self.parts.forEach((part) => {
                    self.scene.remove(part);
                });
            }

            var loader = new THREE.STLLoader();
            loader.load(BASEURL + "downloads/files/" + target + "/" + file, function ( geometry ) {
                var material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.scale.set( 0.02, 0.02, 0.02 );
                self.parts.push(mesh);

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
                } else if (input.closest(".values").hasClass("translate")) {
                    switch(input.attr("name")) {
                        case "x":
                            model.position.x = -parseFloat(input.val());
                            break;
                        case "y":
                            model.position.y = -parseFloat(input.val());
                            break;
                    }
                }
                render();
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
            $("#slicer-viewport .translate.values input[name=\"x\"]").val((model.position.x.toFixed(3) == 0 ? 0 : -model.position.x).toFixed(3)).attr("min", '');
            $("#slicer-viewport .translate.values input[name=\"y\"]").val(model.position.y.toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"x\"]").val((model.rotation.x * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"y\"]").val((model.rotation.y * 180 / Math.PI).toFixed(3)).attr("min", '');
            $("#slicer-viewport .rotate.values input[name=\"z\"]").val((model.rotation.z * 180 / Math.PI).toFixed(3)).attr("min", '');
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
            self.scene.add(new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials)));
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
            [ "slicingViewModel", /* "loginStateViewModel", "settingsViewModel" */ ],

            // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
            [ /* ... */ ]
    ]);
});
