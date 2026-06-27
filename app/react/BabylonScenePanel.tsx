import React, { useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders";

export default function BabylonScenePanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Booting Babylon.js scene...");

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.display = "block";
    containerRef.current.replaceChildren(canvas);

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.05, 0.11, 1);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 14;
    camera.wheelPrecision = 50;

    const hemisphere = new HemisphericLight("hemisphere", new Vector3(0, 1, 0), scene);
    hemisphere.intensity = 0.8;

    const sun = new DirectionalLight("sun", new Vector3(-1, -2, -0.5), scene);
    sun.intensity = 0.35;

    const ground = MeshBuilder.CreateGround("ground", { width: 14, height: 14, subdivisions: 2 }, scene);
    const groundMat = new StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new Color3(0.08, 0.14, 0.2);
    ground.material = groundMat;

    const hero = MeshBuilder.CreateBox("hero", { size: 1.2 }, scene);
    hero.position = new Vector3(0, 0.6, 0);
    const heroMat = new StandardMaterial("heroMat", scene);
    heroMat.diffuseColor = new Color3(0.23, 0.67, 0.93);
    hero.material = heroMat;

    const rival = MeshBuilder.CreateSphere("rival", { diameter: 0.9 }, scene);
    rival.position = new Vector3(1.6, 0.45, -1.2);
    const rivalMat = new StandardMaterial("rivalMat", scene);
    rivalMat.diffuseColor = new Color3(0.92, 0.26, 0.33);
    rival.material = rivalMat;

    const ring = MeshBuilder.CreateTorus("ring", { diameter: 1.8, thickness: 0.16, tessellation: 16 }, scene);
    ring.position = new Vector3(-1.4, 0.4, 1.2);
    const ringMat = new StandardMaterial("ringMat", scene);
    ringMat.diffuseColor = new Color3(0.97, 0.75, 0.2);
    ring.material = ringMat;

    const platform = MeshBuilder.CreateCylinder("platform", { height: 0.2, diameter: 2.6, tessellation: 16 }, scene);
    platform.position = new Vector3(0, 0.1, 0);
    const platformMat = new StandardMaterial("platformMat", scene);
    platformMat.diffuseColor = new Color3(0.12, 0.18, 0.3);
    platform.material = platformMat;

    scene.registerBeforeRender(() => {
      hero.rotation.y += 0.01;
      rival.rotation.y -= 0.008;
      ring.rotation.x += 0.008;
      ring.rotation.z += 0.004;
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    setStatus("Babylon.js runtime ready — WebGL scene active");

    return () => {
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>BABYLON 3D PREVIEW</div>
          <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, marginTop: 2 }}>Browser-native scene sandbox</div>
        </div>
        <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>{status}</span>
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", height: 280, borderRadius: 12, overflow: "hidden", background: "radial-gradient(circle at top, #1e293b 0%, #0f172a 60%, #020617 100%)" }}
      />
      <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
        Babylon.js is now embedded in the studio shell so 3D scenes can be previewed in-browser with WebGL-based rendering and model-loading hooks for future GLB/GLTF assets.
      </div>
    </div>
  );
}
