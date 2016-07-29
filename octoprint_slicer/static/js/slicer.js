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


var container, camera, scene, renderer, mesh,

    objects = [],
    
    count = 0,

    CANVAS_WIDTH = 588,
    CANVAS_HEIGHT = 588;

container = document.getElementById( 'slicer-canvas' );

renderer = new THREE.WebGLRenderer();
renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
container.appendChild( renderer.domElement );

scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera( 50, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 1000 );
camera.position.y = 150;
camera.position.z = 500;
camera.lookAt( scene.position );

mesh = new THREE.Mesh( 
    new THREE.BoxGeometry( 200, 200, 200, 1, 1, 1 ), 
    new THREE.MeshBasicMaterial( { color : 0xff0000, wireframe: true } 
) );
scene.add( mesh );
objects.push( mesh );

// find intersections
var vector = new THREE.Vector3();
var raycaster = new THREE.Raycaster();

function render() {

    mesh.rotation.y += 0.01;
    
    renderer.render( scene, camera );

}

(function animate() {

    requestAnimationFrame( animate );

    render();

})();

//        self.loadSTL(BASEURL + "downloads/files/" + "local" + "/" + "fish_fossilz.stl");
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
