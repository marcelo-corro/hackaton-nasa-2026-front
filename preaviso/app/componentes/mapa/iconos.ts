// Íconos dibujados en canvas para el mapa: el pulso de los incendios activos y la flecha de viento fuerte.
import type { Map as MapaLibre, StyleImageInterface } from "maplibre-gl";

const movimientoReducido = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Punto con una onda que se expande: se redibuja en cada cuadro (salvo con movimiento reducido). */
function pulso(mapa: MapaLibre, rgb: string, borde: string): StyleImageInterface {
  const lado = 96;
  let ctx: CanvasRenderingContext2D | null = null;
  const imagen: StyleImageInterface & { data: Uint8Array | Uint8ClampedArray } = {
    width: lado,
    height: lado,
    data: new Uint8Array(lado * lado * 4),
    onAdd() {
      const canvas = document.createElement("canvas");
      canvas.width = lado;
      canvas.height = lado;
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    },
    render() {
      if (!ctx) return false;
      const quieto = movimientoReducido();
      const t = quieto ? 0.35 : (performance.now() % 2000) / 2000;
      const r = lado * 0.12;
      ctx.clearRect(0, 0, lado, lado);
      ctx.beginPath();
      ctx.arc(lado / 2, lado / 2, r + (lado / 2 - r) * t, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${0.45 * (1 - t)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lado / 2, lado / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.strokeStyle = borde;
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();
      imagen.data = ctx.getImageData(0, 0, lado, lado).data;
      if (!quieto) mapa.triggerRepaint();
      return true;
    },
  };
  return imagen;
}

/** Flecha que apunta hacia arriba (norte); el mapa la gira según hacia dónde sopla el viento. */
function flecha(color: string, borde: string) {
  const ancho = 40;
  const alto = 56;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(ancho / 2, 4);
  ctx.lineTo(ancho - 6, 26);
  ctx.lineTo(ancho / 2 + 6, 22);
  ctx.lineTo(ancho / 2 + 6, alto - 6);
  ctx.lineTo(ancho / 2 - 6, alto - 6);
  ctx.lineTo(ancho / 2 - 6, 22);
  ctx.lineTo(6, 26);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = borde;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fill();
  return { width: ancho, height: alto, data: ctx.getImageData(0, 0, ancho, alto).data };
}

export function agregarIconos(mapa: MapaLibre, oscuro: boolean) {
  const rgb = oscuro ? "196, 181, 253" : "109, 40, 217";
  const borde = oscuro ? "#0e1012" : "#ffffff";
  if (!mapa.hasImage("pulso")) mapa.addImage("pulso", pulso(mapa, rgb, borde), { pixelRatio: 2 });
  if (!mapa.hasImage("flecha")) mapa.addImage("flecha", flecha(`rgb(${rgb})`, borde), { pixelRatio: 2 });
}
