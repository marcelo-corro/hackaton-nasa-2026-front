import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

/**
 * true solo en el navegador, después de hidratar. Las páginas se generan al compilar (en Node), donde no hay
 * WebGL ni window: los mapas se montan solo cuando esto es true.
 */
export const useEnCliente = () =>
  useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
