"use client";
import * as React from "react";
import * as THREE from "three";

// Brand-tinted 3D scene: a drifting cyan particle field + rotating cyan/orange wireframe
// icosahedra, with subtle mouse parallax, over a deep-navy radial gradient. Renders behind the
// glass login card. Cleaned up fully on unmount.
export default function ThreeBackground() {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = () => mount.clientWidth;
    const height = () => mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1f4d, 0.055);

    const camera = new THREE.PerspectiveCamera(58, width() / height(), 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width(), height());
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mount.appendChild(renderer.domElement);

    // Particle field
    const COUNT = 1100;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 3; i++) positions[i] = (Math.random() - 0.5) * 22;
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x35c5f0, size: 0.03, transparent: true, opacity: 0.85, depthWrite: false });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Wireframe icosahedra
    const icoOuter = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.15, 1),
      new THREE.MeshBasicMaterial({ color: 0x00a9e0, wireframe: true, transparent: true, opacity: 0.32 }),
    );
    const icoInner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 0),
      new THREE.MeshBasicMaterial({ color: 0xf7a81b, wireframe: true, transparent: true, opacity: 0.28 }),
    );
    scene.add(icoOuter);
    scene.add(icoInner);

    // Mouse parallax
    let targetX = 0;
    let targetY = 0;
    const onMove = (e: MouseEvent) => {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      icoOuter.rotation.x = t * 0.12;
      icoOuter.rotation.y = t * 0.16;
      icoInner.rotation.x = -t * 0.22;
      icoInner.rotation.y = t * 0.11;
      particles.rotation.y = t * 0.025;
      camera.position.x += (targetX * 1.6 - camera.position.x) * 0.045;
      camera.position.y += (-targetY * 1.6 - camera.position.y) * 0.045;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      particleGeo.dispose();
      particleMat.dispose();
      icoOuter.geometry.dispose();
      (icoOuter.material as THREE.Material).dispose();
      icoInner.geometry.dispose();
      (icoInner.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      style={{ background: "radial-gradient(circle at 32% 28%, #14336f 0%, #0b1f4d 52%, #060f26 100%)" }}
    />
  );
}
