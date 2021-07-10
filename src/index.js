import {
    WebGLRenderer, Scene, PerspectiveCamera,
    ConeGeometry, TorusKnotGeometry, BoxBufferGeometry,
    MeshPhongMaterial, MeshNormalMaterial,
    Vector3,
    DirectionalLight,
    Mesh,
    BoxHelper, AxesHelper
} from "three";

import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { WEBGL } from 'three/examples/jsm/WebGL.js';

// Used to print status message every <LOG_INTERVAL> seconds 
// by comparing current time to previous time whenever render() is called
const LOG_INTERVAL = 5
let prevTime = 0

let renderer, scene, camera;
let helpers = new Map();

let primaryObj, secondaryObj;

/**
 * Length of the path the secondary object traverses in it's motion loop
 */
let pathLength = 20

let velocity = new Vector3(0, 0, -1);  

function makeInstance(geometry, color, x, y) {
    const material = new MeshPhongMaterial({ color });
    const objMesh = new Mesh(geometry, material);
    
    objMesh.position.x = x;
    objMesh.position.y = y;
    
    scene.add(objMesh);
    
    helpers.set( objMesh, new BoxHelper( objMesh ) );    
    scene.add(helpers.get(objMesh));

    return objMesh;
}

function init() {
    // Test for WEBGL availability
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
        return;
    }

    // Setup the renderer and scene
    renderer = new WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( window.devicePixelRatio );
    document.body.appendChild( renderer.domElement );

    scene = new Scene();


    // Setup the camera
    camera = new PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set( 10, 10, 10 );
    camera.lookAt( scene.position );

    camera.position.z = 15;


    // Create a light
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    scene.add(light);

    // Draw the 3 axes
    scene.add( new AxesHelper( 20 ) );

    const primaryGeom = new TorusKnotGeometry();
    primaryObj = makeInstance(primaryGeom, 0x44aa88, 0, 0);
    //primaryObj.rotation.y = Math.PI * 0.25;

    const secondaryGeom = new ConeGeometry();
    secondaryObj = makeInstance(secondaryGeom, 0x8844aa, 0, 0)

    const controls = new DragControls( [ primaryObj ], camera, renderer.domElement );
    controls.addEventListener( 'drag', () => {
        requestAnimationFrame(render);
    } );

}

/**
 * Update the position and orientation of the elements in the scene
 * @param {float} time seconds since start of program
 */
function updateScene(time) {    
    // update rotation
    const speed = 1.1;
    const rot = time * speed;

    // to show how the bounding shapes change over time
    primaryObj.rotation.x = rot;
    primaryObj.rotation.y = rot;

    secondaryObj.rotation.x = -rot;
    secondaryObj.rotation.y = -rot;

    // update positions
    // secondary object should move past the primary object centered at the origin 
    // - modulate the time by the length of the path you want it to traverse
    // - now subtract half of the total path length to center the path on the origin
    let t = time % pathLength
    secondaryObj.position.z = t - pathLength / 2 
}

function render(time) {
    time *= 0.001;  // convert time to seconds

    updateScene(time)

    

    // ------------------- PROCESS INTERSECTIONS HERE ----------------------
    //OPTIONAL TODO: Add velocity vector to each object to bounce them off each other

    // Types of shapes or approximate bounding volume: 
    // - spheres, 
    // - boxes, 
    // - convex polyhedra, 
    // - faceted closed non-self-intersecting

    // Bounding Sphere: intersections are computed using r1 and r2 for the radius of circles 1 and 2 respectively.
    // - ambigious:        circles are just touching of they are exactly r1 + r2 distance away from each other
    // - not intersecting: circles are more than r1 + r2 distance away from each other
    // - intersecting:     circles are less than r1 + r2 distance away from each other

    // Bounding Boxe (axis-aligned): Box doesn't rotate as the bounded object changes, parameters (h, w) for each obj
    // - ambigious:        boxes are just touching if they are exactly w1 + w2 distance apart horizontally 
    //                     and/or h1 + h2 distance apart vertically
    // - not intersecting: boxes are more than r1 + r2 distance away from each other
    // - intersecting:     circles are less than r1 + r2 distance away from each other
    
    // Convex-hulls: Compute bounding shape that ignores all concavity, 
    // - e.g. a 5-sided start would become a pentagon, pacman w/ a face mask  
    // - https://www.bowdoin.edu/~ltoma/teaching/cs3250-CompGeom/spring17/Lectures/cg-convexintersection.pdf

    // Ray-casting: ?
    //   - if bb (or bc) is not intersecting then return not intersecting
    //   - find verticies from one of the objects within the region of intersection
    //   -  cast a ray from each point and use ray-intersection test against the other object
    //      - i guess you can bound the "length" of the ray so that it's not an infinite beam


    // looped status log
    if (time > (prevTime + LOG_INTERVAL)) {
        console.log(Math.trunc(time), "Obj1", 
            primaryObj.position.x, primaryObj.position.y, 
            primaryObj.geometry.boundingBox, primaryObj.geometry.boundingSphere);
        console.log(Math.trunc(time), "Obj2", 
            secondaryObj.position.x, secondaryObj.position.y, 
            secondaryObj.geometry.boundingBox, secondaryObj.geometry.boundingSphere);
        prevTime = time
    }

    // -------------------------------------------------------------------

    helpers.forEach((helper) => { helper.update() })

    // draw scene
    renderer.render(scene, camera);

    // get the next frame
    requestAnimationFrame(render);
}

init()
requestAnimationFrame(render);