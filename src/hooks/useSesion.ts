"use client";

import { useEffect, useRef, useState } from "react";
import { guardarSesion, leerSesion, type Sesion } from "@/lib/sesion";

export function useSesion() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [preparada, setPreparada] = useState(false);
  const [errorPersistencia, setErrorPersistencia] = useState<string | null>(null);
  const ultimaSesion = useRef<Sesion | null>(null);

  useEffect(() => {
    let activa = true;
    leerSesion()
      .then((guardada) => {
        if (!activa) return;
        ultimaSesion.current = guardada;
        setSesion(guardada);
      })
      .catch(() => {
        if (activa) setErrorPersistencia("No se ha podido recuperar la sesión guardada en este navegador.");
      })
      .finally(() => {
        if (activa) setPreparada(true);
      });
    return () => { activa = false; };
  }, []);

  useEffect(() => {
    if (!preparada || sesion === ultimaSesion.current) return;
    ultimaSesion.current = sesion;
    guardarSesion(sesion)
      .then(() => setErrorPersistencia(null))
      .catch(() => setErrorPersistencia("No se han podido guardar los últimos cambios en este navegador. Si recargas, podrían perderse."));
  }, [preparada, sesion]);

  return { sesion, setSesion, preparada, errorPersistencia };
}
