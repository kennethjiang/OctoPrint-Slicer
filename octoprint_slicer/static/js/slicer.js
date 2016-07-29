/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
$(function() {
    function SlicerViewModel(parameters) {
        var self = this;

        var container, camera, scene, renderer, mesh,
            objects = [],
            CANVAS_WIDTH = 588,
            CANVAS_HEIGHT = 588;

        // assign the injected parameters, e.g.:
        // self.loginStateViewModel = parameters[0];
        // self.settingsViewModel = parameters[1];

        // TODO: Implement your plugin's view model here.
        $(document).on("click", ".btn-mini[title='Slice']", function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            $('a[href="#tab_plugin_slicer"]').tab('show');
        });


        self.loadSTL = function(url) {
            var loader = new THREE.STLLoader();
            renderer = viewport.init(url);
            container = document.getElementById( 'slicer-canvas' );
            container.appendChild( renderer.domElement );

            /*
            viewport.modelLoaded = false;
            loader.load(url, function(geometry) {
                geometry.center();
                var mesh = new THREE.Mesh(geometry);
                mesh.rotation.set(3 * Math.PI / 2, 0, Math.PI);
                mesh.updateMatrix();
                mesh.geometry.applyMatrix(mesh.matrix);
                mesh.position.set(0, 0, 0);
                mesh.rotation.set(0, 0, 0);
                mesh.scale.set(1, 1, 1);
                mesh.renderOrder = 0;

                // Add model to scene
                viewport.scene[0].add(mesh);

                // Append model to list
                viewport.models.push({
                    mesh: mesh,
                    type: type,
                    glow: null,
                    adhesion: viewport.createPlatformAdhesion(mesh)
                });
                // Select model
                viewport.removeSelection();
                viewport.selectModel(mesh);

                // Fix model's Y
                viewport.fixModelY();
                // Set model loaded
                viewport.modelLoaded = true;
            });
            */
        }
        self.loadSTL(BASEURL + "downloads/files/" + "local" + "/" + "fish_fossilz.stl");
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
