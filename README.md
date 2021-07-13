# Intersect problem

`For some specified pair of shapes, write a program that determins if they are intersecting or not-intersecting or neither (ambigious). `

_Disclaimer_: I haven't written 3D graphics code in 15 years and I haven't written a project in node.js in probably 6 years. I have previously used OpenGL and DirectX with c++ in school and also the java 3d rendering libraries.

I found `THREE.js` looking for a 3D rendering engine to leverage for this problem. Being web based simplified deployment by having support for web browsers.

- supports 2d, 3d, bounding box, bounding sphere, lots of shapes
- Pretty well supported by the community
- easily to deploy (no compiling, complex build process)

Types of shapes I could potentially use:

- spheres,
- boxes,
- convex polyhedra,
- non-convex facetid shapes

More realistically you would use whatever shape you want, for example in a video game. Then to detect collisions in real time you would use a simpler shape that surrounds/approximates the original. This _bounding volume_ is faster and simpler to calculate intersections with at the expense of some precision.

**Bounding Sphere**: Intersections are computed using the radius and center of each circles

- _Ambigious_: circles are just touching, i.e. Their distance apart is the same as r1 + r2
- _Not intersecting_: circles are more than r1 + r2 distance away from each other
- _Intersecting_: circles are less than r1 + r2 distance away from each other

**Bounding Box** (axis-aligned): These boxes remain oriented to the XYz axies despite the orientation of the interion object. Parameterized by height, width and depth.

- _Ambigious_: Boxes are just touching if thier distance apart is the sum of their lengths for a given dimension.
- _Not intersecting_: Boxes are more than r1 + r2 distance away from each other
- _Intersecting_: Boxes are less than r1 + r2 distance away from each other

To combine the vertical and horizontal intersections use the following table:

|                      | **Intersecting** | **Ambigious**    | **Non-Intersecting** |
| -------------------- | ---------------- | ---------------- | -------------------- |
| **Intersecting**     | intersecting     | ambigious        | non-intersecting     |
| **Ambigious**        | ambigious        | ambigious        | non-intersecting     |
| **Non-Intersecting** | non-intersecting | non-intersecting | non-intersecting     |

In 3D it's more complicated but the same patterns persist:

- If any dimension is non-intersecting then the overall status is `non-intersecting`
- Otherwise if any dimension is ambigious then the overall status is `ambigious`
- The only remaining alternative is that all dimensions are `intersecting`

**Convex-hulls**: Bounding shape that shrink wraps the interior object leaving no concavities on the surface.

- e.g. a 5-sided start would become a pentagon
- Non-convex shapes can be decomposed into convex ones, so this is a building block for more general shapes.
- Two main algorithms used widely:
- SAT: Separating Axis Theorem

  - Does there exist a line / plane seperating the two objects?
  - Actually SAT seeks to find a plane / line to project the two shapes onto such that they form 1-dimensional ranges where it's easy to see if they intersect or not.
  - SAT considers the lines / planes of each face of the two shapes.
  - This is a natural extension from the previous two techiques because it uses the same range checks as bounding sphere and bounding boxes.
  - One optimization might be to sort the faces / lines by thier orientation to the distance vector between the shapes.
  - Faces roughly parallel to the direction vector are more likely to expose non intersections.
  - To combine the different dimensions use the same logic as with bounding boxes.

- GJK:

  - Solves a related geometrical problem on a composite shape formed from the original two using someting called the Minkowsky difference.
  - Detailed explination here: https://www.youtube.com/watch?v=ajv46BSqcK4
  - This method is more efficient but less intuitive

- Here is another 2d method I ame across:
  - https://www.bowdoin.edu/~ltoma/teaching/cs3250-CompGeom/spring17/Lectures/cg-convexintersection.pdf

Non-convex facited shape:

- Set of verticies, edges, faces forming a closed surface.
- Use exact methods to compute intersectons of lines and planes with other lines and planes.
- Can use bounding volume methods above to "fail fast"
- Bounding volume intersections provides a region of space to search for intersecting geometry using exact intersect methods.
- Find coincident geometry:
  - point-point, point-edges, point-faces, edge-face, face-face
  - These would indicate _ambigious_ status.
- Find actual intersections:
  - edge-edge, edge-face, face-face

## To build

Use `npm` to install dependencies referenced in `package.json`, namily `webpack` and `THREE.js`. Also specified in `package.json` is the mapping for the build task which calls `webpack` to bundle `src/index.js` with it's dependencise into `dist/main.js`.

    brew install npm
    npm install
    npm run build

## To run

### _Method 1_: Directly from a local file

The `index.html` file within `dist` can be loaded directly by the browser. If at some point 3d models are loaded from a seperate file you may be forced to use a webserver.

    open dist/index.html

### _Method 2_: From a local webserver

Any webserver can work. I used one available from `npm` called `five-server` for no particular reason. It will try to automatically open a browser window and dynamically reload if any files are changed in the background.

    npm -g i five-server
    cd dist
    five-server . &

## Project setup

To add new dependency to package.json use:

    npm install --save <my-dependency>

## Misc files

`webpack.config.js`: Specifies that `src/index.js` is the "main" input to be repackaged as `dist/main.js`

`.gitignore`: Hides generated files from git status to avoid data bloat

`package.json`: Node package manager config file holds the npm dependencies and the build script to trigger webpack

`dist/index.html`: Wrapper script to read main.js, can probably generate this somehow
