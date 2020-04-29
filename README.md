# VVGL Player

WebGL Player for VVID files

VVGL is a WebGL based rendering engine for LRN files. This should be considered an alternative rendering engine to SVG, one of the major components of vv.js.

## Getting started

VVGL uses a node, webpack build environment. Make sure Node, Webpack, Yarn etc... are all installed

**Install dependencies**

    npm install

**data.json**

You need a specially formatted JSON file. One is already included in the vvid folder, and you can generate more from src/encoder.js, which takes in the outputs from vectorization, and outputs a data.json file

*Run demo file*


    yarn JSONFILE=vvid/data.json demo:serve


## Background

**WebGL**
To understand the VVGL player, you'll need to learn the fundamentals of WebGL.  [WebGL Fundamentals](https://webglfundamentals.org/) has a great introduction to WebGL. In addition, [Khronos.org](https://www.khronos.org/opengl/wiki) and [Mozilla Developer Network](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/) are good references for OpenGL, and the WebGL API respectively.

**Bezier curves**
On top of WebGL, it's critical that you understand Bezier curves (and specifically Cubic Bezier curves). There is a good animation [here](https://www.jasondavies.com/animated-bezier/), a few [videos](https://www.youtube.com/watch?v=pnYccz1Ha34).

**Linear Algebra**
It's also helpful to have a background in basic linear algebra, and specifically vector and matrix multiplication.


## Theory

To understand how the WebGL player works at a theory level, you only need to know two things:

* How to render a bezier curve using linear algebra
* How to render complex polygons as a series of triangles

**Bezier Curves as Linear Algebra**

The formula for a cubic Bezier curve is as follows

![bezier](docs/bezier.svg)

You can substitute the t-values with easier to read variables

![coefficients](docs/coefficients.gif)

The bezier curve equation then becomes

![](docs/linalg1.gif)

Of course, a,b,c,d are still functions of t, but they now look more like linear algebra equations.

You can now treat the bezier equation as matrix multiplication, as below

![](docs/linalg2.gif)

Of course, while the points are actual numbers, a,b,c,d are just functions of t. The key here is to now evaluate a,b,c and d for different values of t, from 0 to 1

![](docs/linalg3.gif)

Here, each value in the matrices is now a concrete number. To be even more explicit, the equation B(t) now results in a vector of the different points along the bezier curve

![](docs/linalg4.gif)

Finally, remember that a, b, c and d are just functions of t, and aren't dependent on the control points. The a,b,c,d matrix therefore doesn't change between bezier curves, and you can therefore consider it a constant

![](docs/t.gif)

Every bezier curve, therefore, can be calculated by multiplying the 4 control points by a constant matrix T

![](docs/linalg5.gif)

In this way, you can feed hundreds of thousands of bezier curves to the GPU in parallel, and it will output millions of vertex points efficiently (in less than 1 ms), becuase it's just about multiplying 10^5 vectors by a constant matrix


**Complex polygons as a series of triangles**

WebGL and OpenGL only really understand lines and triangles. Everything that is rendered in WebGL therefore needs to be broken down into triangles.

The obvious solution is to use triangulation, and there are [libraries](https://github.com/mapbox/earcut) which can triangulate large polygons efficiently. These algorithms use the CPU however, and the runtime for thousands of objects (as in a typical animated scene) ends up being ~30ms per frame

The non-obvious solution is to use a neat feature of geometry theory: For any arbitrary polygon, if you draw a [triangle fan](https://en.wikipedia.org/wiki/Triangle_fan), that is - the series of triangles made by connecting a vertex to every subsequent pair of vertices (as shown below)

![](docs/Image142.gif)

where the triangles in triangle fan are 1-2-3, 1-3-4, 1-4-5, 1-5-6 and 1-6-7, the areas inside the polygon will be covered by an odd number of triangles. The areas outside the polygon will be covered by an even number of triangles.

This neat quirk lets you take advantage of 2 OpenGL/WebGL features to draw any closed 2d shape:
* Triangle Fans
* Stencil Buffers

For the stencil buffer, you can use the Stencil mask function to mark any pixel with an 8-bit id without drawing it. You can also use the Stencil INVERT function to do a bitwise flip of any pixel drawn by a triangle, and the stencil test to draw only draw triangles on pixels where the stencil id is equal to a certain value.

What you can do therefore, is to draw a triangle fan for every polygon, using the stencil mask to set the pixels to a given id, and the stencil invert function to flip the pixel ids every time a triangle is drawn. Because of the neat quirk mentioned above, every pixel inside the polygon will have the same stencil id, and everything outside the polygon will remain unaffected, because they will have undergone an even number of inverts.

This idea comes from the [GL Programming textbook](http://www.glprogramming.com/red/chapter14.html#name13), which you can look at for reference.


**Drawing everything on the GPU**

If you understand both points of theory above, the algorithm from here is exceedingly simple. Every shape is a series of bezier curves. For each shape, you supply a list of the bezier curve control points, and the GPU will calculate the points along each bezier curve. These points are now the vertices of a very complex polygon, and you do the stencil buffer method mentioned above to get an individual shape























## Implementation


## Issues


https://github.com/Vectorly/web-gl-experiments/tree/master/full_frame_holes