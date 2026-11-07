# @react-three/postprocessing

**Repository:** [https://github.com/pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing)  
**Docs:** [https://docs.pmnd.rs/react-postprocessing](https://docs.pmnd.rs/react-postprocessing)

Postprocessing effects for React Three Fiber (R3F) animations and motion design videos.

## Installation:
```bash
npm install @react-three/postprocessing postprocessing three
```

## Cinematic Effects Stack:
- **Bloom**: Glowing elements, neon lines, futuristic tech highlights.
- **DepthOfField**: Camera focus and cinematic bokeh blur.
- **Noise**: Subtle film grain.
- **Vignette**: Darkened lens borders for cinematic focus.
- **ChromaticAberration**: Stylized lens distortion.

## Quickstart Code:
```jsx
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField, Vignette, Noise } from '@react-three/postprocessing';

export function CinematicScene() {
  return (
    <Canvas>
      {/* 3D Meshes, Models, Lights */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {/* Postprocessing Chain */}
      <EffectComposer>
        <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </Canvas>
  );
}
```
