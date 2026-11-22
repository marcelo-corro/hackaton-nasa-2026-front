// Grilla de sectores de 1 km del back (firecal.sectores.grilla): celdas cuadradas en la proyección cónica de Albers
// de área igual para Sudamérica (ESRI:102033). El back publica cada sector como índices (ix, iy) de esa grilla; aquí
// se pasan sus esquinas a longitud/latitud para dibujarlos. Fórmulas de Snyder (1987), como en PROJ y proj4js.

// +proj=aea +lat_0=-32 +lon_0=-60 +lat_1=-5 +lat_2=-42 +x_0=0 +y_0=0 +ellps=aust_SA +units=m
const A = 6378160; // elipsoide aust_SA (Sudamericano de 1969)
const RF = 298.25;
const RAD = Math.PI / 180;
const LAT0 = -32 * RAD;
const LON0 = -60 * RAD;
const LAT1 = -5 * RAD;
const LAT2 = -42 * RAD;

const ES = 2 / RF - 1 / (RF * RF); // e²
const E = Math.sqrt(ES);

const msfnz = (sen: number, cos: number) => cos / Math.sqrt(1 - ES * sen * sen);
const qsfnz = (sen: number) => {
  const con = E * sen;
  return (1 - ES) * (sen / (1 - con * con) - (0.5 / E) * Math.log((1 - con) / (1 + con)));
};

const MS1 = msfnz(Math.sin(LAT1), Math.cos(LAT1));
const MS2 = msfnz(Math.sin(LAT2), Math.cos(LAT2));
const QS1 = qsfnz(Math.sin(LAT1));
const QS2 = qsfnz(Math.sin(LAT2));
const QS0 = qsfnz(Math.sin(LAT0));
const NS0 = (MS1 * MS1 - MS2 * MS2) / (QS2 - QS1);
const C = MS1 * MS1 + NS0 * QS1;
const RH = (A * Math.sqrt(C - NS0 * QS0)) / NS0;

/** Latitud (radianes) a partir de q, por iteración (converge en pocas vueltas). */
function phi1z(qs: number): number {
  let phi = Math.asin(0.5 * qs);
  for (let i = 0; i < 30; i++) {
    const sen = Math.sin(phi);
    const con = E * sen;
    const com = 1 - con * con;
    const dphi =
      ((0.5 * com * com) / Math.cos(phi)) * (qs / (1 - ES) - sen / com + (0.5 / E) * Math.log((1 - con) / (1 + con)));
    phi += dphi;
    if (Math.abs(dphi) <= 1e-12) break;
  }
  return phi;
}

// Datum: ESRI:102033 está sobre SAD69. PROJ pasa a WGS84 con una traslación cartesiana que depende de la zona (en
// Chile, una por franja de latitud; difieren en ~10 m y sin ninguna los cuadrados quedan ~70 m corridos). El back
// publica en cada archivo fijo la que PROJ usa en esa comuna (`sad69_a_wgs84`); por defecto, "SAD69 to WGS 84 (1)".
export type Traslacion = [number, number, number];
const TRASLACION_GENERAL: Traslacion = [-57, 1, -41];
const A_WGS = 6378137;
const F_WGS = 1 / 298.257223563;
const ES_WGS = 2 * F_WGS - F_WGS * F_WGS;

/** Latitud/longitud SAD69 (radianes, altura 0) → latitud/longitud WGS84 (radianes). */
function sad69AWgs84(lon: number, lat: number, [dx, dy, dz]: Traslacion): [number, number] {
  const sen = Math.sin(lat);
  const n = A / Math.sqrt(1 - ES * sen * sen);
  const x = n * Math.cos(lat) * Math.cos(lon) + dx;
  const y = n * Math.cos(lat) * Math.sin(lon) + dy;
  const z = n * (1 - ES) * sen + dz;
  const p = Math.hypot(x, y);
  let phi = Math.atan2(z, p * (1 - ES_WGS));
  for (let i = 0; i < 10; i++) {
    const s = Math.sin(phi);
    const nw = A_WGS / Math.sqrt(1 - ES_WGS * s * s);
    const h = p / Math.cos(phi) - nw;
    phi = Math.atan2(z, p * (1 - (ES_WGS * nw) / (nw + h)));
  }
  return [Math.atan2(y, x), phi];
}

/** Metros de ESRI:102033 → [longitud, latitud] WGS84 en grados (lo mismo que geopandas `to_crs("EPSG:4326")`). */
export function albersALonLat(x: number, y: number, traslacion: Traslacion = TRASLACION_GENERAL): [number, number] {
  const py = RH - y;
  const signo = NS0 >= 0 ? 1 : -1;
  const rh1 = signo * Math.sqrt(x * x + py * py);
  const theta = rh1 !== 0 ? Math.atan2(signo * x, signo * py) : 0;
  const con = (rh1 * NS0) / A;
  const [lon, lat] = sad69AWgs84(theta / NS0 + LON0, phi1z((C - con * con) / NS0), traslacion);
  return [lon / RAD, lat / RAD];
}

const redondear = (v: number) => Math.round(v * 1e5) / 1e5;

/** Anillo cerrado (lon/lat, 5 decimales, antihorario como el back) de la celda (ix, iy) de lado `lado` metros. */
export function anilloCelda(ix: number, iy: number, lado: number, traslacion?: Traslacion): [number, number][] {
  const esquinas: [number, number][] = [
    [ix + 1, iy],
    [ix + 1, iy + 1],
    [ix, iy + 1],
    [ix, iy],
    [ix + 1, iy],
  ];
  return esquinas.map(([i, j]) => {
    const [lon, lat] = albersALonLat(i * lado, j * lado, traslacion);
    return [redondear(lon), redondear(lat)];
  });
}

/** Centro de la celda (ix, iy) en [longitud, latitud]. */
export function centroCelda(ix: number, iy: number, lado: number, traslacion?: Traslacion): [number, number] {
  const [lon, lat] = albersALonLat((ix + 0.5) * lado, (iy + 0.5) * lado, traslacion);
  return [redondear(lon), redondear(lat)];
}
