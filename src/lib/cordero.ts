export interface CompraCordero {
  mediasReses: number;
  pesoTotalKg: number;
  descripcion: string;
}

const MEDIA_RES_KG = 6.25;

export function calcularCordero(comensales: number, kgCrudosObjetivo = comensales * 0.75): CompraCordero {
  if (comensales <= 0 || kgCrudosObjetivo <= 0) {
    return {
      mediasReses: 0,
      pesoTotalKg: 0,
      descripcion: '0 medias reses',
    };
  }

  const medias = Math.ceil(kgCrudosObjetivo / MEDIA_RES_KG);
  const enteros = Math.floor(medias / 2);
  const resto = medias % 2;

  let descripcion = '';
  if (enteros === 0 && resto === 1) {
    descripcion = '1 media res';
  } else if (enteros > 0 && resto === 0) {
    descripcion = `${enteros} cordero${enteros > 1 ? 's' : ''} entero${enteros > 1 ? 's' : ''}`;
  } else if (enteros > 0 && resto === 1) {
    descripcion = `${enteros} cordero${enteros > 1 ? 's' : ''} y medio (${medias} medias reses)`;
  } else {
    descripcion = `${medias} medias reses`;
  }

  return {
    mediasReses: medias,
    pesoTotalKg: medias * MEDIA_RES_KG,
    descripcion,
  };
}
