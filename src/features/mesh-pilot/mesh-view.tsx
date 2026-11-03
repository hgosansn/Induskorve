import { useEffect, useRef } from 'react';
import { readPalette, type Palette } from '../../rendering/palette';

export interface MeshScene {
  schemaVersion: number;
  assetId: string;
  candidateId: string;
  bounds: { min: number[]; max: number[] };
  objects: {
    id: string;
    role: string;
    material: keyof Palette;
    positions: number[];
    normals: number[];
    indices: number[];
  }[];
  sockets: { id: string; service: string; point: number[]; normal: number[] }[];
}
const vertex = `#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 projection;
out vec3 n;
void main(){ n=normal; gl_Position=projection*vec4(position,1.0); }`;
const fragment = `#version 300 es
precision highp float;
in vec3 n;
uniform vec3 color;
uniform vec3 lightColor;
out vec4 outputColor;
void main(){
 vec3 N=normalize(n); vec3 L=normalize(vec3(-0.35,0.65,1.0));
 float diffuse=max(dot(N,L),0.0);
 float rim=pow(max(dot(N,normalize(vec3(0.8,-0.2,0.5))),0.0),12.0);
 outputColor=vec4(color*(0.32+diffuse*0.72)+lightColor*rim*0.10,1.0);
}`;
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
let sharedGpuCanvas: HTMLCanvasElement | undefined;

export function paintRetainedMesh(
  el: HTMLCanvasElement,
  scene: MeshScene,
  angle = 0,
  active = true,
) {
  const gpu = (sharedGpuCanvas ??= document.createElement('canvas'));
  const gl = gpu.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw Error('WebGL2 is required for retained mesh inspection');
  const shader = (type: number, source: string) => {
    const result = gl.createShader(type)!;
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(result) ?? 'Shader compile failed');
    return result;
  };
  const vs = shader(gl.VERTEX_SHADER, vertex),
    fs = shader(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(program) ?? 'Shader link failed');
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  const palette = readPalette();
  const objects = scene.objects.map((object) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    for (const [name, data] of [
      ['position', object.positions],
      ['normal', object.normals],
    ] as const) {
      const buffer = gl.createBuffer()!;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    }
    const indices = gl.createBuffer()!;
    buffers.push(indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint32Array(object.indices),
      gl.STATIC_DRAW,
    );
    const token =
      !active && object.material === 'production' ? 'surface' : object.material;
    if (!palette[token]) throw Error(`Unknown mesh material ${token}`);
    return {
      vao,
      buffers,
      count: object.indices.length,
      color: rgb(palette[token]),
    };
  });
  let framing = { scale: 1, minH: 0, maxH: 0, minV: 0, maxV: 0 };
  const draw = () => {
    el.width = Math.round(
      (el.clientWidth || el.width) * Math.min(devicePixelRatio, 2),
    );
    el.height = Math.round(
      (el.clientHeight || el.height) * Math.min(devicePixelRatio, 2),
    );
    gpu.width = el.width;
    gpu.height = el.height;
    gl.viewport(0, 0, el.width, el.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const a = (angle * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a);
    // Default camera is exactly the city's affine projection in local units.
    const horizontal = [2.25 * (c - s), -2.25 * (c + s), 0];
    const vertical = [1.125 * (c + s), 1.125 * (c - s), -3];
    const depth = [c + s, c - s, 0.75];
    const corners = [0, 1].flatMap((x) =>
      [0, 1].flatMap((y) =>
        [0, 1].map((z) => [
          scene.bounds[x ? 'max' : 'min'][0]!,
          scene.bounds[y ? 'max' : 'min'][1]!,
          scene.bounds[z ? 'max' : 'min'][2]!,
        ]),
      ),
    );
    const dot = (a: number[], b: number[]) =>
      a.reduce((v, n, i) => v + n * b[i]!, 0);
    const h = corners.map((p) => dot(p, horizontal)),
      v = corners.map((p) => dot(p, vertical)),
      d = corners.map((p) => dot(p, depth));
    const minH = Math.min(...h),
      maxH = Math.max(...h),
      minV = Math.min(...v),
      maxV = Math.max(...v);
    const scale =
      Math.min(el.width / (maxH - minH), el.height / (maxV - minV)) * 0.84;
    framing = { scale, minH, maxH, minV, maxV };
    const sx = (2 * scale) / el.width,
      sy = (-2 * scale) / el.height,
      sz = -1.8 / (Math.max(...d) - Math.min(...d));
    const matrix = new Float32Array([
      horizontal[0]! * sx,
      vertical[0]! * sy,
      depth[0]! * sz,
      0,
      horizontal[1]! * sx,
      vertical[1]! * sy,
      depth[1]! * sz,
      0,
      0,
      vertical[2]! * sy,
      depth[2]! * sz,
      0,
      (-(minH + maxH) / 2) * sx,
      (-(minV + maxV) / 2) * sy,
      (-(Math.min(...d) + Math.max(...d)) / 2) * sz,
      1,
    ]);
    gl.useProgram(program);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'projection'),
      false,
      matrix,
    );
    gl.uniform3fv(
      gl.getUniformLocation(program, 'lightColor'),
      rgb(palette['concrete-light']),
    );
    for (const object of objects) {
      gl.bindVertexArray(object.vao);
      gl.uniform3fv(gl.getUniformLocation(program, 'color'), object.color);
      gl.drawElements(gl.TRIANGLES, object.count, gl.UNSIGNED_INT, 0);
    }
    el.dataset.rendered = 'true';
  };
  draw();
  // One reusable GPU context rasterizes all candidates. Keeping a separate
  // context for every idle/context/inspector view exhausts browser GPU limits.
  const output = el.getContext('2d')!;
  output.clearRect(0, 0, el.width, el.height);
  output.drawImage(gpu, 0, 0);
  for (const object of objects) {
    gl.deleteVertexArray(object.vao);
    object.buffers.forEach((b) => gl.deleteBuffer(b));
  }
  gl.deleteProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return framing;
}

// Retained, depth-tested indexed triangles: this inspector renders the exported
// geometry, not the primitive boxes from the city's conservative assembly model.
export function MeshView({
  scene,
  angle = 0,
  active = true,
}: {
  scene: MeshScene;
  angle?: number;
  active?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!;
    const draw = () => paintRetainedMesh(el, scene, angle, active);
    const resize = new ResizeObserver(draw);
    resize.observe(el);
    draw();
    return () => resize.disconnect();
  }, [scene, angle, active]);
  return (
    <canvas
      ref={canvas}
      className="h-96 w-full"
      aria-label="Retained mesh inspector"
    />
  );
}

export function BakedView({
  src,
  pixelWidth,
}: {
  src: string;
  pixelWidth: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext('2d')!,
      image = new Image();
    let disposed = false;
    image.onload = () => {
      if (disposed) return;
      const source = document.createElement('canvas');
      source.width = image.width;
      source.height = image.height;
      const input = source.getContext('2d')!;
      input.drawImage(image, 0, 0);
      const pixels = input.getImageData(0, 0, image.width, image.height).data;
      let left = image.width,
        top = image.height,
        right = 0,
        bottom = 0;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++)
          if (pixels[(y * image.width + x) * 4 + 3]! > 16) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      if (right < left) throw Error('Empty baked image');
      const height = Math.ceil(
        (pixelWidth * (bottom - top + 1)) / (right - left + 1),
      );
      el.width = pixelWidth;
      el.height = height;
      el.style.width = `${pixelWidth}px`;
      el.style.height = `${height}px`;
      ctx.drawImage(
        image,
        left,
        top,
        right - left + 1,
        bottom - top + 1,
        0,
        0,
        pixelWidth,
        height,
      );
      el.dataset.rendered = 'true';
    };
    image.src = src;
    return () => {
      disposed = true;
      image.src = '';
    };
  }, [src, pixelWidth]);
  return (
    <canvas ref={canvas} aria-label={`Baked mesh at ${pixelWidth} pixels`} />
  );
}
