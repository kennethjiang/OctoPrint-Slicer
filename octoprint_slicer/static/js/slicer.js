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

        // TODO: Implement your plugin's view model here.
        $(document).on("click", ".btn-mini[title='Slice']", function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            $('a[href="#tab_plugin_slicer"]').tab('show');
        });


        var container;

        var camera, cameraTarget, scene, renderer, orbitControl, transformControl,
        CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;

        init();
        render();

        function init() {
            container = document.getElementById( 'slicer-canvas' );

            camera = new THREE.PerspectiveCamera( 35, 1.0, 0.1, 100 );
            camera.position.set( 3, 0.15, 3 );
            scene = new THREE.Scene();
            scene.add( new THREE.GridHelper( 10, 0.2 ) );

            var loader = new THREE.STLLoader();
            loader.load(BASEURL + "downloads/files/" + "local" + "/" + "fish_fossilz.stl", function ( geometry ) {

                var material = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.scale.set( 0.02, 0.02, 0.02 );

                scene.add( mesh );
                transformControls.attach(mesh);
                render();
            } );


            // Lights

            scene.add( new THREE.AmbientLight(0xffffff, 1.0) );

            // renderer

            renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
            renderer.setPixelRatio( window.devicePixelRatio );

            renderer.gammaInput = true;
            renderer.gammaOutput = true;

            $("#slicer-viewport").empty().append(`
                    <div class="model">
                    <button class="translate disabled" title="Translate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/translate.png"></button>
                    <button class="rotate" title="Rotate"><img src="` + PLUGIN_BASEURL + `slicer/static/img/rotate.png"></button>
                    <button class="scale" title="Scale"><img src="` + PLUGIN_BASEURL + `slicer/static/img/scale.png"></button>
                    </div>
                    <div class="values translate">
                    <div>
                    <p><span class="axis x">X</span><input type="number" step="any" name="x" min=""><span title="">mm</span></p>
                    <p><span class="axis z">Z</span><input type="number" step="any" name="z" min=""><span title="">mm</span></p>
                    <span></span>
                    </div>
                    </div>
                    `);

            $("#slicer-viewport").append(renderer.domElement);
            orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.25;
            orbitControls.enablePan = false;
            orbitControls.addEventListener("change", render);

            transformControls = new THREE.TransformControls(camera, renderer.domElement);
            transformControls.space = "world";
            transformControls.setAllowedTranslation("XZ");
            transformControls.setRotationDisableE(true);
            transformControls.addEventListener("change", render);
            transformControls.addEventListener("mouseDown", startTransform);
            transformControls.addEventListener("mouseUp", endTransform);
            //transformControls.addEventListener("mouseUp", this.fixModelY);
            //transformControls.addEventListener("change", this.updateModelChanges);
            scene.add(transformControls);

            $("#slicer-viewport button.translate").click(function(event) {
                // Set selection mode to translate
                transformControls.setMode("translate");
                $("#slicer-viewport button.translate").removeClass("disabled");
                $("#slicer-viewport div.values").removeClass("translate rotate scale").addClass(transformControls.getMode());
                $("#slicer-viewport div.values div").addClass("show").children('p').addClass("show");
            });
            // Start transform
        }
        function startTransform() {
            // Disable orbit controls
            orbitControls.enabled = false;
        }

        function endTransform() {
            // Enable orbit controls
            orbitControls.enabled = true;
        }
        function render() {
            orbitControls.update();
            transformControls.update();
            renderer.render( scene, camera );
        }

    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
            SlicerViewModel,

            // e.g. loginStateViewModel, settingsViewModel, ...
            [ /* "loginStateViewModel", "settingsViewModel" */ ],

            // e.g. #settings_plugin_slicer, #tab_plugin_slicer, ...
            [ /* ... */ ]
    ]);
});
