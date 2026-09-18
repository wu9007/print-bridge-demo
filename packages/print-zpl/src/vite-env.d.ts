/// <reference types="vite/client" />

declare module "*.TTF?url" {
  const src: string;
  export default src;
}

interface FontFaceSet {
  add(font: FontFace): FontFaceSet;
}
