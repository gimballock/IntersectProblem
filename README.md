# Intersect problem

`For some specified pair of shapes, write a program that determines if they are intersecting or not-intersecting or neither (ambiguous). `

_Disclaimer_: I haven't written 3D graphics code in 15 years and I haven't written a project in node.js in probably 6 years. I have previously used OpenGL and DirectX with C++ in school and also the java 3d rendering libraries.

Tl;dr: Video [demo](https://photos.google.com/share/AF1QipPlIuUlWe_RPehW9lifvbO9RtCvE6RQqrQFOueIU0qf17jSkbr8M8iz94kUjQrqgA/photo/AF1QipOw5gkr0U1WnpupLN14vWw2YFb_vsc2g9QMbdqQ?key=RDdDdTVXbGNCbnZua2kydXdwVDVGWXBUVmtJbzVR)

I found `THREE.js` looking for a 3D rendering engine to leverage for this problem. Being web based simplified deployment by having support for web browsers.

- Supports 2d, 3d, bounding box, bounding sphere, lots of shapes
- Pretty well supported by the community
- easily to deploy (no compiling, complex build process)

Types of shapes I could potentially use:

- spheres,
- boxes,
- convex polyhedrons,
- non-convex faceted shapes

More realistically you would use whatever shape you want, for example in a video game. Then to detect collisions in real time you would use a simpler shape that surrounds/approximates the original. This _bounding volume_ is faster and simpler to calculate intersections with at the expense of some precision.

**Bounding Sphere**: Intersections are computed using the radius and center of each circle

1.  With d > r1 + r2 circles do not touch: NO-INTERSECT

2.  With d = r2 + r1 circles touch from outside: AMBIGUOUS

3.  With r2 - r1 < d < r1 + r2 circles interlinked: INTERSECT
    impossible with r1 = 0, works w/ r1 = r2

4.  With d = r2 - r1 circles touch from inside: AMBIGUOUS

5.  With d < r2 - r1 circles don't touch from inside: NO-INTERSECT
    impossible with r1 = r2, works w/ r1 = 0

        let isTouchingOutside = (d - (r2 + r1) <= ERROR)
        let isTouchingInside = (d - (r2 - r1) <= ERROR)
        if(isTouchingInside || isTouchingOutside)
        return AMBIGUOUS

        // spheres are disconnected from inside or outside
        if(d > (r1 + r2) || d < (r2 - r1))
        return NO-INTERSECT

        // Finally it must be the case that: r2 - r1 < d < r1 + r2
        return INTERSECT

**Bounding Box** (axis-aligned): These boxes remain oriented to the XYz axis despite the orientation of the interior object. Parameterized by height, width and depth.

- _Ambiguous_: Boxes are just touching if their distance apart is the sum of their lengths for a given dimension.
- _Not intersecting_: Boxes are more than r1 + r2 distance away from each other
- _Intersecting_: Boxes are less than r1 + r2 distance away from each other

To combine the vertical and horizontal intersections use the following table:

|                      | **Intersecting** | **Ambiguous**    | **Non-Intersecting** |
| -------------------- | ---------------- | ---------------- | -------------------- |
| **Intersecting**     | intersecting     | ambiguous        | non-intersecting     |
| **Ambiguous**        | ambiguous        | ambiguous        | non-intersecting     |
| **Non-Intersecting** | non-intersecting | non-intersecting | non-intersecting     |

In 3D it's more complicated but the same patterns persist:

- If any dimension is non-intersecting then the overall status is `non-intersecting`
- Otherwise if any dimension is ambiguous then the overall status is `ambiguous`
- The only remaining alternative is that all dimensions are `intersecting`

---

**Update**: I misread the assignment initially, this is the ammended analysis: Hollow intersect instead of solid intersect

Provided a triple of single-dimensional intersect statuses, one for each dimension (x,y,z) where each can be any of (to, ti, nto, nti), this function returns an overall status from the set (NO_INTERSECT, INTERSECT, AMBIGUOUS)

Single dimension statuses are defined as follows:

Touching from the outside (TO)

      |    +--+----+   min_1 + size_1 = min_2

Touching from the inside (TI)

      |    +--------+   min_1 + size_1 = min_2 + size_2
      |       +-----+

OR

      |    +--------+   min_1 = min_2 && size_1 != size_2
      |    +----+

Not touching from the outside (NTO)

      |    +--+  +--+   min_1 + size_1 < min_2

Not touching from the inside (NTI)

      |    +--------+   min_1 + size_1 > min_2  &&  size_1 > size_2
      |       +--+

Intersect (I)

      |    +-----+      min_1 + size_1 > min_2  &&  size_1 < size_2
      |       +-----+

This table considers all the ways pairs of objects can be combined for 2 dimensions:

|     | nto | to  | i   | ti  | nti |
| --- | --- | --- | --- | --- | --- |
| nto | nto | nto | nto | nto | nto |
| to  | nto | to  | to  | to  | to  |
| i   | nto | to  | i   | i   | i   |
| ti  | nto | to  | i   | ti  | ti  |
| nti | nto | to  | i   | ti  | nti |

These convert to the overall-state like this:

- nto, nti --> NO_INTERSECT
- to, ti --> AMBIGUOUS
- i --> INTERSECT

These actually condense down into a couple simple rules:
The algorithm:

1. If any dimension is NTO --> NO_INTERSECT
2. else if any dimension is TO --> AMBIGUOUS
3. else if any dimension is I --> INTERSECT
4. else if any dimension is TI --> AMBIGUOUS
5. else all dimension must be NTI --> NO_INTERSECT

**Convex-hulls**: Bounding shape that shrink wraps the interior object leaving no concavities on the surface.

- e.g. a 5-sided star would become a pentagon
- Non-convex shapes can be decomposed into convex ones, so this is a building block for more general shapes.
- Two main algorithms used widely:
- SAT: Separating Axis Theorem

  - Does there exist a line / plane separating the two objects?
  - Actually SAT seeks to find a plane / line to project the two shapes onto such that they form 1-dimensional ranges where it's easy to see if they intersect or not.
  - SAT considers the lines / planes of each face of the two shapes.
  - This is a natural extension from the previous two techniques because it uses the same range checks as bounding sphere and bounding boxes.
  - One optimization I thought of might be to sort the faces / lines by their orientation to the distance vector between the shapes (cosine similarity).
  - Faces roughly parallel to the direction vector are more likely to expose non intersections.
  - To combine the different dimensions use the same logic as with bounding boxes.

- GJK:

  - Solves a related geometrical problem on a composite shape formed from the original two using something called the Minkowski difference.
  - Detailed explanation here: https://www.youtube.com/watch?v=ajv46BSqcK4
  - This method is more efficient but less intuitive

- Here is another method I came across, not sure what it's called:
  - https://www.bowdoin.edu/~ltoma/teaching/cs3250-CompGeom/spring17/Lectures/cg-convexintersection.pdf
  - This method extends to 3d by searching connected sequences of faces. Like peeling an orange, except you peel two oranges at the same time until you find that one is intersecting the other.

**General closed polygonal shapes**:

- Set of vertices, edges, faces forming a closed surface.
- Use exact methods to compute intersections of lines and planes with other lines and planes.
- Find coincident geometry:
  - point-point, point-edges, point-faces, edge-face, face-face
  - These would indicate _ambiguous_ status.
- Find actual intersections:
  - edge-edge, edge-face, face-face
- Strategy:
  - Recall that finding any evidence that the shapes do not intersect means you can stop searching and return that result.
  - Use a bounding volume method above to "fail fast"
  - If you do not find a _non-intersection_ result note that an _ambiguous_ or _intersection_ result may actually be non-intersecting on the underlying shapes.
  - If ambiguous bounding volume search the underlying geometry for coincident objects. If something from each object is touching the coincident points/edges/faces of the bounding volumes then you have proved _ambiguous_ intersection and can stop searching.
  - Finally if the bounding volumes result in an intersection you can use the intersected region-of-space to eliminate vertices, associated edges and faces that lie outside of that volume.
  - From here you have to brute-force try all the combinations of things between the two objects.

## To build

Use `npm` to install dependencies referenced in `package.json`, namely `webpack` and `THREE.js`. Also specified in `package.json` is the mapping for the build task which calls `webpack` to bundle `src/index.js` with it's dependencies into `dist/main.js`.

    brew install npm
    npm install
    npm run build

### Development tasks

To add new dependency to package.json use:

    npm install --save <my-dependency>

### Misc files

`webpack.config.js`: Specifies that `src/index.js` is the "main" input to be repackaged as `dist/main.js`.

`.gitignore`: Hides generated files from `git status` to avoid data bloat.

`package.json`: Config file holds the `npm` dependencies and the build script to trigger a `webpack` "build".

`package-lock.json`: Documents npm packages installed along with their versions. Used by `npm` to allow users to exactly reproduce the build.

`dist/index.html`: Wrapper script to read main.js, can probably generate this somehow.

## To run

### _Method 1_: Directly from a local file

The `index.html` file within `dist` can be loaded directly by the browser. If at some point 3d models are loaded from a separate file you may be forced to use a webserver.

    open dist/index.html

### _Method 2_: From a local webserver

Any webserver can work. I used one available from `npm` called `five-server` for no particular reason. It will try to automatically open a browser window and dynamically reload if any files are changed in the background.

    npm -g i five-server
    cd dist
    five-server . &

## Usage

Once the html page is open you will see:

- 3 grey planes: floor and two walls showing the origin and standard axis.
- 2 shapes spinning around:
  - The toroidal knot spinning in place, this is the main object.
  - The dodecahedron is also spinning and moving along one of the planes in a loop repeatedly passing through the main object.
- Both shapes have their own color but when they touch or intersect they change color. Red for intersection and yellow for "ambiguous".
- Bounding volumes around each object indicate the intersection method used.
- Using your mouse/track pad you can grab the toroidal knot and drag it along the floor plane to more precisely control how it contacts the other shape.

In the browser's [developer console](https://balsamiq.com/support/faqs/browserconsole/) you can see some log messages indicating the results of the live intersection tests:

    20 Bounding Box Overlapping
    21 Bounding Box Overlapping
    21 Bounding Box ...
    21 Bounding Box Touching
    21 Bounding Box Overlapping
    22 Bounding Box Overlapping
    ...

Using the keyboard to cycle through available intersection modes:

- The 'N' and 'P' keys switch to the next or previous intersection mode in a cycle.
- Intersection mode controls the wire frame surrounding the object and the intersection test method used to detect collisions.
